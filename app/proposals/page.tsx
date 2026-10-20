"use client";

import { useState } from "react";
import { useAuditMode } from "@/components/AuditMode";
import { AuditIndex } from "@/components/AuditView";
import { ContractGate, ErrorText, Loading, Page, PageHeader } from "@/components/ContractGate";
import { ProposalList } from "@/components/ProposalList";
import { proposalStatus } from "@/lib/contract";
import { txError, useProposals, useTeams } from "@/lib/hooks";
import type { Proposal, Team } from "@/lib/types";

const filters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
] as const;

export default function HistoryPage() {
  const { audit } = useAuditMode();
  const teams = useTeams();
  const proposals = useProposals();
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const all = (proposals.data ?? []) as Proposal[];
  const visible = all.filter((proposal) => {
    if (filter === "open") return proposal.status === proposalStatus.active;
    if (filter === "closed") return proposal.status !== proposalStatus.active;
    return true;
  });
  const ready = !teams.isLoading && !proposals.isLoading && !teams.error && !proposals.error;

  return (
    <Page>
      {audit ? (
        <PageHeader
          eyebrow="On-chain proof"
          title="The ledger, checked"
          text="Each row compares the stored counters with Voted events. Open a proposal to see the snapshot, the ballots, and the transactions."
        />
      ) : (
        <PageHeader
          eyebrow="Archive"
          title="The ledger"
          text="Every proposal on this contract, including decisions that have already been closed."
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
        {teams.isLoading || proposals.isLoading ? <Loading /> : null}
        {teams.error || proposals.error ? <ErrorText message={txError(teams.error ?? proposals.error)} /> : null}
        {ready && audit ? <AuditIndex proposals={visible} teams={(teams.data ?? []) as Team[]} /> : null}
        {ready && !audit ? (
          <ProposalList
            proposals={visible}
            teams={(teams.data ?? []) as Team[]}
            emptyTitle={filter === "all" ? "The ledger is empty" : `No ${filter} proposals`}
            emptyText="Proposals show up here as soon as a team member creates one."
          />
        ) : null}
      </ContractGate>
    </Page>
  );
}
