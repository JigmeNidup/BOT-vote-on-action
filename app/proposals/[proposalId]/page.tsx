"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useAuditMode } from "@/components/AuditMode";
import { AuditDossier } from "@/components/AuditView";
import { ContractGate, ErrorText, Loading, Page, TxStatus } from "@/components/ContractGate";
import { VoteBar } from "@/components/VoteBar";
import { botChain, explorerUrl } from "@/lib/chain";
import { contractAddress, hasContract, proposalStatus, voteChoice, voteOnActionAbi } from "@/lib/contract";
import { formatTime, sameAddress, shortAddress } from "@/lib/format";
import { txError, useContractWrite } from "@/lib/hooks";
import type { Proposal, Team, VoteRecord } from "@/lib/types";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

function choiceLabel(record?: VoteRecord) {
  if (!record?.hasVoted) return "Not voted";
  if (record.choice === voteChoice.yes) return "Yes";
  if (record.choice === voteChoice.no) return "No";
  return "Not voted";
}

export default function ProposalDetailPage() {
  const params = useParams<{ proposalId: string }>();
  const idText = params.proposalId;
  const valid = /^\d+$/.test(idText) && idText !== "0";
  const proposalId = valid ? BigInt(idText) : undefined;
  const { audit } = useAuditMode();
  const { address, isConnected, chainId } = useAccount();
  const onBotChain = isConnected && chainId === botChain.id;

  const proposalQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getProposal",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: hasContract && Boolean(proposalId) },
  });
  const proposal = proposalQuery.data as Proposal | undefined;
  const teamQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getTeam",
    args: proposal ? [proposal.teamId] : undefined,
    query: { enabled: hasContract && Boolean(proposal) },
  });
  const team = teamQuery.data as Team | undefined;
  const votersQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getEligibleVoters",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: hasContract && Boolean(proposalId) },
  });
  const voters = (votersQuery.data ?? []) as `0x${string}`[];
  const voteReads = useReadContracts({
    contracts: voters.map((voter) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "getVote" as const,
      args: [proposalId!, voter] as const,
    })),
    query: { enabled: hasContract && Boolean(proposalId) && voters.length > 0 },
  });
  const eligibleQuery = useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "isEligible",
    args: proposalId && address ? [proposalId, address] : undefined,
    query: { enabled: hasContract && Boolean(proposalId && address) },
  });

  const [suggestion, setSuggestion] = useState("");
  const [localError, setLocalError] = useState("");
  const write = useContractWrite();
  const busy = write.isPending || write.receipt.isLoading;
  const records = voters.map((voter, index) => ({
    voter,
    record: voteReads.data?.[index]?.result as VoteRecord | undefined,
  }));
  const suggestions = records.filter(
    (entry) => entry.record?.hasVoted && entry.record.choice === voteChoice.no && entry.record.suggestion,
  );

  async function send(functionName: "voteYes" | "voteNo" | "closeProposal") {
    if (!proposalId || !contractAddress) return;
    setLocalError("");
    if (functionName === "voteNo" && !suggestion.trim()) {
      setLocalError("A suggestion is required when voting no.");
      return;
    }
    write.reset();
    try {
      if (functionName === "voteYes") {
        await write.writeContractAsync({
          address: contractAddress,
          abi: voteOnActionAbi,
          functionName: "voteYes",
          args: [proposalId],
        });
        return;
      }
      if (functionName === "voteNo") {
        await write.writeContractAsync({
          address: contractAddress,
          abi: voteOnActionAbi,
          functionName: "voteNo",
          args: [proposalId, suggestion.trim()],
        });
        setSuggestion("");
        return;
      }
      await write.writeContractAsync({
        address: contractAddress,
        abi: voteOnActionAbi,
        functionName: "closeProposal",
        args: [proposalId],
      });
    } catch {
      // The write hook surfaces the wallet or contract error.
    }
  }

  const votesState = !votersQuery.isSuccess
    ? votersQuery.isError
      ? "error"
      : "loading"
    : voters.length === 0
      ? "ready"
      : voteReads.isSuccess
        ? "ready"
        : voteReads.isError
          ? "error"
          : "loading";
  const active = proposal?.status === proposalStatus.active;
  const myRecord = records.find((entry) => sameAddress(entry.voter, address))?.record;
  const waitingForMyVote = voters.some((voter) => sameAddress(voter, address)) && voteReads.isLoading;
  const canVote = Boolean(active && onBotChain && eligibleQuery.data && !myRecord?.hasVoted && !waitingForMyVote);
  const canClose = Boolean(
    active &&
      onBotChain &&
      proposal &&
      team &&
      (sameAddress(address, proposal.proposer) || sameAddress(address, team.owner)),
  );
  const yes = Number(proposal?.yesCount ?? 0n);
  const no = Number(proposal?.noCount ?? 0n);
  const total = yes + no;

  return (
    <Page>
      <Link href="/proposals" className="text-sm font-semibold text-muted hover:text-ink">
        ← Ledger
      </Link>
      <ContractGate>
        {!valid ? <div className="mt-6"><ErrorText message="This proposal does not exist." /></div> : null}
        {valid && proposalQuery.isLoading ? <div className="mt-6"><Loading /></div> : null}
        {valid && proposalQuery.error ? <div className="mt-6"><ErrorText message="This proposal does not exist." /></div> : null}
        {proposal && audit ? (
          <AuditDossier
            proposal={proposal}
            team={team}
            records={records}
            votesState={votesState}
            snapshotReady={votersQuery.isSuccess}
          />
        ) : null}
        {proposal && !audit ? (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <header>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="kicker">{team?.name ?? `Team ${proposal.teamId.toString()}`}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-moss text-white" : "bg-white text-muted"}`}>
                    {active ? "Open" : "Closed"}
                  </span>
                </div>
                <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{proposal.title}</h1>
                <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink/90">
                  {proposal.description || "No description."}
                </p>
                <p className="mt-4 text-sm text-muted">
                  Proposed by{" "}
                  <a className="font-mono text-ink underline decoration-line" href={`${explorerUrl}/address/${proposal.proposer}`}>
                    {shortAddress(proposal.proposer)}
                  </a>
                  {" · "}
                  Opened {formatTime(proposal.createdAt)}
                  {proposal.closedAt > 0n ? ` · Closed ${formatTime(proposal.closedAt)}` : ""}
                </p>
              </header>

              <section className="panel p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <h2 className="font-serif text-3xl">Tally</h2>
                  <p className="text-sm text-muted">{total} {total === 1 ? "vote" : "votes"}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <p className="rounded-2xl bg-moss/10 px-4 py-3">
                    <span className="kicker text-moss">Yes</span>
                    <span className="mt-1 block font-serif text-4xl">{yes}</span>
                  </p>
                  <p className="rounded-2xl bg-ember/10 px-4 py-3">
                    <span className="kicker text-ember">No</span>
                    <span className="mt-1 block font-serif text-4xl">{no}</span>
                  </p>
                </div>
                <div className="mt-4">
                  <VoteBar yes={yes} no={no} />
                </div>
              </section>

              <section className="panel p-5 sm:p-6">
                <h2 className="font-serif text-3xl">Suggestions</h2>
                {suggestions.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No alternatives have been recorded yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {suggestions.map((entry) => (
                      <li key={entry.voter} className="rounded-2xl bg-paper p-4">
                        <p className="text-base leading-relaxed">{entry.record?.suggestion}</p>
                        <p className="mt-2 font-mono text-xs text-muted">
                          {shortAddress(entry.voter)} · {formatTime(entry.record?.votedAt ?? 0n)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel p-5 sm:p-6">
                <h2 className="font-serif text-3xl">Snapshot</h2>
                <p className="mt-2 text-sm text-muted">These wallets could vote when the proposal was created.</p>
                <ul className="mt-4 divide-y divide-line">
                  {records.map((entry) => (
                    <li key={entry.voter} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <a className="font-mono text-xs underline decoration-line sm:text-sm" href={`${explorerUrl}/address/${entry.voter}`}>
                        {shortAddress(entry.voter)}
                      </a>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        entry.record?.choice === voteChoice.yes
                          ? "bg-moss/10 text-moss"
                          : entry.record?.choice === voteChoice.no
                            ? "bg-ember/10 text-ember"
                            : "bg-paper text-muted"
                      }`}>
                        {choiceLabel(entry.record)}
                        {entry.record?.votedAt ? ` · ${formatTime(entry.record.votedAt)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="panel p-5 sm:sticky sm:top-6 sm:p-6">
              <h2 className="font-serif text-3xl">Your vote</h2>
              {!isConnected ? <p className="mt-3 text-sm text-muted">Connect a snapshotted wallet to vote.</p> : null}
              {isConnected && !onBotChain ? (
                <p className="mt-3 text-sm text-ember">Switch to {botChain.name} before voting.</p>
              ) : null}
              {isConnected && eligibleQuery.data === false ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  This wallet was not on the voter list when the proposal was created.
                </p>
              ) : null}
              {myRecord?.hasVoted ? (
                <p className="mt-3 rounded-2xl bg-paper p-3 text-sm">
                  You voted <span className="font-semibold">{choiceLabel(myRecord)}</span>
                  {myRecord.suggestion ? `: ${myRecord.suggestion}` : ""}.
                </p>
              ) : null}
              {!active ? <p className="mt-3 text-sm text-muted">This proposal is closed.</p> : null}
              {canVote ? (
                <div className="mt-5 space-y-3">
                  <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void send("voteYes")}>
                    Vote yes
                  </button>
                  <label className="block text-sm font-semibold" htmlFor="suggestion">
                    Suggestion, required to vote no
                  </label>
                  <textarea
                    id="suggestion"
                    className="field min-h-28"
                    placeholder="What should happen instead?"
                    value={suggestion}
                    onChange={(event) => setSuggestion(event.target.value)}
                  />
                  <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => void send("voteNo")}>
                    Vote no
                  </button>
                </div>
              ) : null}
              {canClose ? (
                <button type="button" className="btn btn-danger mt-4 w-full" disabled={busy} onClick={() => void send("closeProposal")}>
                  Close proposal
                </button>
              ) : null}
              {localError ? <p className="mt-3 text-sm text-ember">{localError}</p> : null}
              <div className="mt-3">
                <TxStatus
                  pending={write.isPending}
                  confirming={write.receipt.isLoading}
                  success={write.receipt.isSuccess}
                  error={write.error || write.receipt.error ? txError(write.error ?? write.receipt.error) : undefined}
                />
              </div>
            </aside>
          </div>
        ) : null}
      </ContractGate>
    </Page>
  );
}
