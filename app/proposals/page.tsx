"use client";

import { useState } from "react";
import { useAuditMode } from "@/components/AuditMode";
import { AuditIndex } from "@/components/AuditView";
import { ContractGate, EmptyState, ErrorText, Loading, Page, PageHeader } from "@/components/ContractGate";
import { ProposalList } from "@/components/ProposalList";
import { proposalStatus } from "@/lib/contract";
import { txError, useWalletScope } from "@/lib/hooks";

const filters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
] as const;

export default function HistoryPage() {
  const { audit } = useAuditMode();
  const scope = useWalletScope();
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const visible = scope.myProposals.filter((proposal) => {
    if (filter === "open") return proposal.status === proposalStatus.active;
    if (filter === "closed") return proposal.status !== proposalStatus.active;
    return true;
  });
  const ready = scope.isConnected && !scope.loading && !scope.error;

  return (
    <Page>
      {audit ? (
        <PageHeader
          eyebrow="On-chain proof"
          title="The ledger, checked"
          text="Each of your proposals is checked against its Voted events. Open one to see the snapshot, the ballots, and the transactions."
        />
      ) : (
        <PageHeader
          eyebrow="Archive"
          title="The ledger"
          text="Proposals from teams this wallet owns or belongs to, including decisions it created and ones already closed."
        />
      )}
      <ContractGate>
        <div className="mb-6 flex gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "btn btn-primary !px-3 !py-1.5" : "btn btn-ghost !px-3 !py-1.5"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!scope.isConnected ? (
          <EmptyState title="Connect a wallet" text="The ledger shows proposals for teams this wallet owns or belongs to." />
        ) : null}
        {scope.isConnected && scope.loading ? <Loading /> : null}
        {scope.isConnected && scope.error ? <ErrorText message={txError(scope.error)} /> : null}
        {ready && audit ? <AuditIndex proposals={visible} teams={scope.myTeams} /> : null}
        {ready && !audit ? (
          <ProposalList
            proposals={visible}
            teams={scope.myTeams}
            emptyTitle={filter === "all" ? "The ledger is empty" : `No ${filter} proposals`}
            emptyText="Proposals appear here when this wallet creates one or belongs to the team."
          />
        ) : null}
      </ContractGate>
    </Page>
  );
}
