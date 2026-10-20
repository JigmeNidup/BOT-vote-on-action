"use client";

import Link from "next/link";
import { useAuditMode } from "@/components/AuditMode";
import { AuditIndex } from "@/components/AuditView";
import { ContractGate, ErrorText, Loading, Page, PageHeader } from "@/components/ContractGate";
import { ProposalList } from "@/components/ProposalList";
import { proposalStatus } from "@/lib/contract";
import { txError, useProposals, useTeams } from "@/lib/hooks";
import type { Proposal, Team } from "@/lib/types";

export default function HomePage() {
  const { audit } = useAuditMode();
  const teams = useTeams();
  const proposals = useProposals();
  const all = (proposals.data ?? []) as Proposal[];
  const teamList = (teams.data ?? []) as Team[];
  const active = all.filter((proposal) => proposal.status === proposalStatus.active);
  const yes = active.reduce((sum, proposal) => sum + Number(proposal.yesCount), 0);
  const no = active.reduce((sum, proposal) => sum + Number(proposal.noCount), 0);
  const ready = !teams.isLoading && !proposals.isLoading && !teams.error && !proposals.error;

  return (
    <Page>
      {audit ? (
        <PageHeader
          eyebrow="On-chain proof"
          title="Do the records agree?"
          text="Stored yes and no counters are checked against every Voted event on this contract. Open a proposal for each ballot, the snapshot, and the transaction."
        />
      ) : (
        <PageHeader
          eyebrow="BOT Chain testnet"
          title="Open decisions"
          text="Proposals still accepting a single vote from the wallets snapshotted when they were created."
          action={
            <Link href="/proposals/new" className="btn btn-primary">
              New proposal
            </Link>
          }
        />
      )}
      <ContractGate>
        {!audit && ready ? (
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Open" value={String(active.length)} />
            <Stat label="Teams" value={String(teamList.length)} />
            <Stat label="Votes cast" value={String(yes + no)} />
          </div>
        ) : null}
        {teams.isLoading || proposals.isLoading ? <Loading /> : null}
        {teams.error || proposals.error ? <ErrorText message={txError(teams.error ?? proposals.error)} /> : null}
        {ready && audit ? <AuditIndex proposals={all} teams={teamList} /> : null}
        {ready && !audit ? (
          <ProposalList
            proposals={active}
            teams={teamList}
            emptyTitle="Nothing is open"
            emptyText="Create a team, then open a proposal. Eligible voters are locked in at that moment."
          />
        ) : null}
      </ContractGate>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="kicker">{label}</p>
      <p className="mt-2 font-serif text-4xl">{value}</p>
    </div>
  );
}
