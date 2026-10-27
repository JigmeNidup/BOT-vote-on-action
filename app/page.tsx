"use client";

import Link from "next/link";
import { useAuditMode } from "@/components/AuditMode";
import { AuditIndex } from "@/components/AuditView";
import { ContractGate, EmptyState, ErrorText, Loading, Page, PageHeader } from "@/components/ContractGate";
import { ProposalList } from "@/components/ProposalList";
import { botChain } from "@/lib/chain";
import { proposalStatus } from "@/lib/contract";
import { txError, useWalletScope } from "@/lib/hooks";

export default function HomePage() {
  const { audit } = useAuditMode();
  const scope = useWalletScope();
  const active = scope.myProposals.filter((proposal) => proposal.status === proposalStatus.active);
  const yes = active.reduce((sum, proposal) => sum + Number(proposal.yesCount), 0);
  const no = active.reduce((sum, proposal) => sum + Number(proposal.noCount), 0);
  const ready = scope.isConnected && !scope.loading && !scope.error;

  return (
    <Page>
      {audit ? (
        <PageHeader
          eyebrow="On-chain proof"
          title="Do the records agree?"
          text="Stored counters are checked against Voted events for proposals from teams this wallet owns or belongs to."
        />
      ) : (
        <PageHeader
          eyebrow={botChain.name}
          title="Open decisions"
          text="Open proposals for teams this wallet owns or belongs to, including proposals it created."
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
            <Stat label="Teams" value={String(scope.myTeams.length)} />
            <Stat label="Votes cast" value={String(yes + no)} />
          </div>
        ) : null}
        {!scope.isConnected ? (
          <EmptyState title="Connect a wallet" text="Your teams and their open proposals show up after the wallet connects." />
        ) : null}
        {scope.isConnected && scope.loading ? <Loading /> : null}
        {scope.isConnected && scope.error ? <ErrorText message={txError(scope.error)} /> : null}
        {ready && audit ? <AuditIndex proposals={scope.myProposals} teams={scope.myTeams} /> : null}
        {ready && !audit ? (
          <ProposalList
            proposals={active}
            teams={scope.myTeams}
            emptyTitle="Nothing is open"
            emptyText="Create a team, then open a proposal. Only teams this wallet owns or belongs to are listed."
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
