"use client";

import Link from "next/link";
import { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { EmptyState, ErrorText } from "@/components/ContractGate";
import { botChain, explorerUrl, rpcUrl } from "@/lib/chain";
import { contractAddress, hasContract, proposalStatus, voteOnActionAbi } from "@/lib/contract";
import { formatTime, sameAddress } from "@/lib/format";
import { txError, useChainProof } from "@/lib/hooks";
import {
  type CheckStatus,
  type VoteProof,
  buildAuditReport,
  choiceName,
  reconcileProposal,
} from "@/lib/audit";
import type { Proposal, Team, VoteRecord } from "@/lib/types";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

const steps = [
  "createProposal copies the team wallets into the proposal snapshot. Later member changes do not rewrite that list.",
  "voteYes and voteNo revert unless the sender is on the snapshot, has not voted, and the proposal is open. A No also needs a suggestion.",
  "The contract stores the ballot, increments yesCount or noCount, and emits Voted with the wallet, choice, suggestion, and time.",
  "This view reads the snapshot, the stored ballots, the counters, and those logs, then checks that they describe the same votes.",
];

export function AuditIndex({ proposals, teams }: { proposals: Proposal[]; teams: Team[] }) {
  const proof = useChainProof();
  const names = new Map(teams.map((team) => [team.id.toString(), team.name]));
  const ordered = [...proposals].reverse();
  const marks = ordered.map((proposal) => {
    if (!proof.data) {
      return {
        proposal,
        status: "pending" as CheckStatus,
        note: proof.isError ? "Voted logs could not be read." : "Reading Voted logs from BOT Chain…",
        eventYes: null as number | null,
        eventNo: null as number | null,
      };
    }
    const logs = proof.data.voted.filter((log) => log.proposalId === proposal.id);
    const result = reconcileProposal(proposal, logs);
    return { proposal, ...result };
  });
  const matched = marks.filter((mark) => mark.status === "pass").length;
  const mismatched = marks.filter((mark) => mark.status === "fail").length;
  const unread = marks.length - matched - mismatched;

  if (ordered.length === 0) {
    return <EmptyState title="Nothing to audit" text="Proposals show up here after a team member creates one." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Match" value={String(matched)} />
        <Stat label="Mismatch" value={String(mismatched)} />
        <Stat label="Unread" value={String(unread)} />
      </div>
      {proof.isError ? <ErrorText message={txError(proof.error)} /> : null}
      <ul className="space-y-4">
        {marks.map((mark) => {
          const yes = Number(mark.proposal.yesCount);
          const no = Number(mark.proposal.noCount);
          const active = mark.proposal.status === proposalStatus.active;
          return (
            <li key={mark.proposal.id.toString()}>
              <Link href={`/proposals/${mark.proposal.id.toString()}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-gold/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="kicker">{names.get(mark.proposal.teamId.toString()) ?? `Team ${mark.proposal.teamId.toString()}`}</p>
                    <h2 className="mt-2 font-serif text-3xl leading-tight">{mark.proposal.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-moss text-white" : "bg-paper text-muted"}`}>
                      {active ? "Open" : "Closed"}
                    </span>
                    <Stamp status={mark.status} />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <p className="rounded-2xl bg-paper px-4 py-3 text-sm">
                    <span className="kicker">Stored counters</span>
                    <span className="mt-1 block font-semibold text-ink">{yes} yes · {no} no</span>
                  </p>
                  <p className="rounded-2xl bg-paper px-4 py-3 text-sm">
                    <span className="kicker">Voted events</span>
                    <span className="mt-1 block font-semibold text-ink">
                      {mark.eventYes === null ? "Reading…" : `${mark.eventYes} yes · ${mark.eventNo} no`}
                    </span>
                  </p>
                </div>
                <p className={`mt-3 text-sm ${mark.status === "fail" ? "text-ember" : "text-muted"}`}>{mark.note}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AuditDossier({
  proposal,
  team,
  records,
  votesState,
  snapshotReady,
}: {
  proposal: Proposal;
  team?: Team;
  records: { voter: `0x${string}`; record?: VoteRecord }[];
  votesState: "loading" | "ready" | "error";
  snapshotReady: boolean;
}) {
  const proof = useChainProof();
  const membersQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getMembers",
    args: [proposal.teamId],
    query: { enabled: hasContract },
  });
  const eligibilityQuery = useReadContracts({
    contracts: records.map((entry) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "isEligible" as const,
      args: [proposal.id, entry.voter] as const,
    })),
    query: { enabled: hasContract && snapshotReady && records.length > 0 },
  });
  const logsState = proof.isError ? "error" : proof.data ? "ready" : "loading";
  const eligibilityState = !snapshotReady
    ? "loading"
    : records.length === 0
      ? "ready"
      : eligibilityQuery.isError
        ? "error"
        : eligibilityQuery.isSuccess
          ? "ready"
          : "loading";
  const voted = proof.data?.voted.filter((log) => log.proposalId === proposal.id) ?? [];
  const created = proof.data?.created.filter((log) => log.proposalId === proposal.id) ?? [];
  const closed = proof.data?.closed.filter((log) => log.proposalId === proposal.id) ?? [];
  const report = buildAuditReport({
    proposal,
    records,
    logs: voted,
    created,
    closed,
    eligibility: records.map((entry, index) => ({
      voter: entry.voter,
      eligible: eligibilityQuery.data?.[index]?.result as boolean | undefined,
    })),
    votesState,
    logsState,
    eligibilityState,
    logsError: proof.error ? txError(proof.error) : undefined,
    undecoded: proof.data?.undecoded ?? 0,
    snapshotReady,
  });
  const members = (membersQuery.data ?? []) as `0x${string}`[];
  const [copied, setCopied] = useState(false);
  const headline =
    report.status === "pass" ? "These records agree." : report.status === "fail" ? "These records do not agree." : "The proof is still incomplete.";
  const lead =
    report.status === "pass"
      ? "Stored counters, stored ballots, and Voted events describe the same votes."
      : (report.checks.find((check) => check.status === report.status)?.detail ?? "");

  async function copyProof() {
    const lines = [
      "Vote on Action audit",
      `Proposal ${proposal.id.toString()}: ${proposal.title}`,
      `Contract ${contractAddress ?? "not set"}`,
      `Chain ${botChain.id} · ${rpcUrl}`,
      `Read at block ${proof.data ? proof.data.blockNumber.toString() : "unknown"}`,
      headline,
      ...report.checks.map((check) => `${check.status.toUpperCase()} — ${check.title}. ${check.detail}`),
      ...report.proofs.map((item) => {
        const tx = item.transactionHash ?? "no transaction";
        const issues = item.issues.length ? item.issues.join(" ") : "agrees with storage";
        return `${choiceName(item.choice)} ${item.voter} · ${tx} · ${issues}`;
      }),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="mt-6 space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="kicker">{team?.name ?? `Team ${proposal.teamId.toString()}`}</p>
          <Stamp status={report.status} />
        </div>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{proposal.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed">{headline}</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{lead}</p>
        <button type="button" className="btn btn-ghost mt-4" onClick={() => void copyProof()}>
          {copied ? "Copied" : "Copy this proof"}
        </button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="panel p-5 sm:p-6">
          <h2 className="font-serif text-3xl">How a vote becomes a record</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm leading-relaxed">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-semibold text-paper">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <dl className="panel space-y-4 p-5 text-sm">
          <Identity label="Contract" value={contractAddress ?? "Not set"} href={contractAddress ? `${explorerUrl}/address/${contractAddress}` : undefined} />
          <Identity label="Chain" value={`${botChain.name} · ${botChain.id}`} />
          <Identity label="Endpoint" value={rpcUrl} />
          <Identity label="Read at block" value={proof.data ? proof.data.blockNumber.toLocaleString() : "Reading…"} />
        </dl>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-serif text-3xl">Three copies of the tally</h2>
        <p className="mt-2 text-sm text-muted">These three reads should show the same numbers. A dash means that read is still in progress.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-muted">
                <th className="py-2 pr-3 font-medium">Choice</th>
                <th className="py-2 pr-3 font-medium">Stored counter</th>
                <th className="py-2 pr-3 font-medium">getVote ballots</th>
                <th className="py-2 font-medium">Voted events</th>
              </tr>
            </thead>
            <tbody>
              <TallyRow label="Yes" counter={Number(proposal.yesCount)} ballots={report.ballotYes} events={report.eventYes} />
              <TallyRow label="No" counter={Number(proposal.noCount)} ballots={report.ballotNo} events={report.eventNo} />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">{snapshotLine(snapshotReady, votesState, logsState, records.length, report.ballotYes, report.ballotNo, report.abstentions.length)}</p>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-serif text-3xl">Checks</h2>
        <ul className="mt-2 divide-y divide-line">
          {report.checks.map((check) => (
            <li key={check.id} className="grid gap-3 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-start">
              <Stamp status={check.status} />
              <div>
                <p className="font-semibold">{check.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-3xl">On-chain receipts</h2>
        <Anchor
          kicker="Opened"
          title={proposal.title}
          detail={`Proposer ${proposal.proposer}`}
          when={formatTime(proposal.createdAt)}
          hash={created[0]?.transactionHash}
          blockNumber={created[0]?.blockNumber}
          missing={logsState === "ready" && created.length === 0}
        />
        {report.proofs.map((item) => (
          <Receipt key={`${item.voter}-${item.logIndex ?? "storage"}`} proof={item} />
        ))}
        {logsState === "loading" ? <p className="text-sm text-muted">Reading Voted logs…</p> : null}
        {logsState === "ready" && report.proofs.length === 0 ? <p className="text-sm text-muted">No ballots have been recorded.</p> : null}
        {proposal.status === proposalStatus.closed || closed.length > 0 ? (
          <Anchor
            kicker="Closed"
            title={closed[0] ? `Closer ${closed[0].closer}` : "Close event not found"}
            detail="The final counters stay on the proposal. The close event records who closed it and when."
            when={formatTime(proposal.closedAt)}
            hash={closed[0]?.transactionHash}
            blockNumber={closed[0]?.blockNumber}
            missing={logsState === "ready" && closed.length === 0}
          />
        ) : null}
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-serif text-3xl">Not cast</h2>
        {votesState !== "ready" || logsState !== "ready" ? (
          <p className="mt-2 text-sm text-muted">Abstentions are listed after both the stored ballots and the logs have loaded.</p>
        ) : report.abstentions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Every snapshotted wallet has a ballot.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {report.abstentions.map((voter) => (
              <li key={voter} className="rounded-2xl bg-paper px-4 py-3">
                <a className="break-all font-mono text-xs" href={`${explorerUrl}/address/${voter}`}>
                  {voter}
                </a>
                <p className="mt-1 text-sm text-muted">No getVote ballot and no Voted event. That is an abstention, not a missing record.</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TeamNote
        records={records}
        members={members}
        state={membersQuery.isError ? "error" : membersQuery.isSuccess && snapshotReady ? "ready" : "loading"}
      />
    </div>
  );
}

function snapshotLine(
  snapshotReady: boolean,
  votesState: "loading" | "ready" | "error",
  logsState: "loading" | "ready" | "error",
  eligible: number,
  ballotYes: number | null,
  ballotNo: number | null,
  abstained: number,
) {
  if (!snapshotReady) return "Reading the snapshot…";
  if (votesState !== "ready" || logsState !== "ready" || ballotYes === null || ballotNo === null) {
    return `${eligible} wallets were eligible. The split between ballots and abstentions is still loading.`;
  }
  const ballots = ballotYes + ballotNo;
  return `${eligible} eligible = ${ballots} ${ballots === 1 ? "ballot" : "ballots"} + ${abstained} not cast`;
}

function TeamNote({
  records,
  members,
  state,
}: {
  records: { voter: `0x${string}` }[];
  members: `0x${string}`[];
  state: "loading" | "ready" | "error";
}) {
  const joinedLater = members.filter((member) => !records.some((entry) => sameAddress(entry.voter, member)));
  const leftLater = records.filter((entry) => !members.some((member) => sameAddress(member, entry.voter))).map((entry) => entry.voter);

  return (
    <section className="panel p-5 sm:p-6">
      <p className="kicker">Context</p>
      <h2 className="mt-2 font-serif text-3xl">The live team is a different list</h2>
      {state === "loading" ? <p className="mt-3 text-sm text-muted">Reading current members…</p> : null}
      {state === "error" ? <p className="mt-3 text-sm text-ember">Current members could not be read.</p> : null}
      {state === "ready" && joinedLater.length === 0 && leftLater.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">The current team still matches this snapshot.</p>
      ) : null}
      {state === "ready" && (joinedLater.length > 0 || leftLater.length > 0) ? (
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p>Membership changed after this proposal opened. Those edits do not add or remove a ballot here.</p>
          {joinedLater.length > 0 ? <AddressList label="Joined the team later" addresses={joinedLater} /> : null}
          {leftLater.length > 0 ? <AddressList label="Left the team after the snapshot" addresses={leftLater} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function AddressList({ label, addresses }: { label: string; addresses: `0x${string}`[] }) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <ul className="mt-1 space-y-1">
        {addresses.map((address) => (
          <li key={address}>
            <a className="break-all font-mono text-xs" href={`${explorerUrl}/address/${address}`}>
              {address}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Receipt({ proof }: { proof: VoteProof }) {
  const agreed = proof.issues.length === 0;
  return (
    <article className={`rounded-3xl border p-5 ${agreed ? "border-line bg-card" : "border-ember/30 bg-ember/5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="kicker">{proof.source === "log" ? "Voted event" : "Storage only"}</p>
          <h3 className="mt-1 font-serif text-4xl">{choiceName(proof.choice)}</h3>
        </div>
        <Stamp status={agreed ? "pass" : "fail"} />
      </div>
      <a className="mt-3 block break-all font-mono text-xs" href={`${explorerUrl}/address/${proof.voter}`}>
        {proof.voter}
      </a>
      <p className="mt-2 text-sm text-muted">{formatTime(proof.votedAt)}</p>
      {proof.suggestion ? <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed">{proof.suggestion}</p> : null}
      <TxLink hash={proof.transactionHash} blockNumber={proof.blockNumber} logIndex={proof.logIndex} />
      {agreed ? (
        <p className="mt-3 text-sm text-moss">On the snapshot. getVote matches this log.</p>
      ) : (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ember">
          {proof.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Anchor({
  kicker,
  title,
  detail,
  when,
  hash,
  blockNumber,
  missing,
}: {
  kicker: string;
  title: string;
  detail: string;
  when: string;
  hash?: `0x${string}`;
  blockNumber?: bigint;
  missing: boolean;
}) {
  return (
    <article className="rounded-3xl border border-line bg-white/70 p-5">
      <p className="kicker">{kicker}</p>
      <h3 className="mt-1 break-all font-serif text-2xl">{title}</h3>
      <p className="mt-2 break-all text-sm leading-relaxed text-muted">{detail}</p>
      <p className="mt-2 text-sm text-muted">{when}</p>
      {missing ? <p className="mt-3 text-sm text-ember">No matching event was returned by the RPC.</p> : <TxLink hash={hash} blockNumber={blockNumber} />}
    </article>
  );
}

function TxLink({ hash, blockNumber, logIndex }: { hash?: `0x${string}`; blockNumber?: bigint; logIndex?: number }) {
  if (!hash) return null;
  const where = [
    blockNumber !== undefined ? `Block ${blockNumber.toLocaleString()}` : "",
    logIndex !== undefined ? `log ${logIndex}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <a className="mt-3 block break-all font-mono text-xs underline decoration-line" href={`${explorerUrl}/tx/${hash}`}>
      {where ? `${where} · ` : ""}
      {hash}
    </a>
  );
}

function TallyRow({
  label,
  counter,
  ballots,
  events,
}: {
  label: string;
  counter: number;
  ballots: number | null;
  events: number | null;
}) {
  return (
    <tr className="border-t border-line">
      <th className="py-3 pr-3 font-semibold">{label}</th>
      <td className="py-3 pr-3 font-serif text-2xl">{counter}</td>
      <Cell value={ballots} expected={counter} />
      <Cell value={events} expected={counter} />
    </tr>
  );
}

function Cell({ value, expected }: { value: number | null; expected: number }) {
  const tone = value === null ? "text-muted" : value === expected ? "text-moss" : "text-ember";
  return <td className={`py-3 pr-3 font-serif text-2xl ${tone}`}>{value === null ? "—" : value}</td>;
}

function Identity({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs">
        {href ? (
          <a className="underline decoration-line" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Stamp({ status }: { status: CheckStatus }) {
  const label = status === "pass" ? "Pass" : status === "fail" ? "Fail" : "Wait";
  const tone = status === "pass" ? "bg-moss text-white" : status === "fail" ? "bg-ember text-white" : "bg-paper text-muted";
  return <span className={`inline-flex h-7 items-center justify-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="kicker">{label}</p>
      <p className="mt-2 font-serif text-4xl">{value}</p>
    </div>
  );
}
