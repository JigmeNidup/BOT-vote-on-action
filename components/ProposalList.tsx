import Link from "next/link";
import { EmptyState } from "@/components/ContractGate";
import { VoteBar } from "@/components/VoteBar";
import { proposalStatus } from "@/lib/contract";
import { formatTime } from "@/lib/format";
import type { Proposal, Team } from "@/lib/types";

export function ProposalList({
  proposals,
  teams,
  emptyTitle,
  emptyText,
}: {
  proposals: Proposal[];
  teams: Team[];
  emptyTitle: string;
  emptyText: string;
}) {
  if (proposals.length === 0) {
    return <EmptyState title={emptyTitle} text={emptyText} />;
  }

  const names = new Map(teams.map((team) => [team.id.toString(), team.name]));
  const ordered = [...proposals].reverse();

  return (
    <ul className="space-y-4">
      {ordered.map((proposal) => {
        const active = proposal.status === proposalStatus.active;
        const yes = Number(proposal.yesCount);
        const no = Number(proposal.noCount);
        return (
          <li key={proposal.id.toString()}>
            <Link href={`/proposals/${proposal.id.toString()}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-moss/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="kicker">{names.get(proposal.teamId.toString()) ?? `Team ${proposal.teamId.toString()}`}</p>
                  <h2 className="mt-2 font-serif text-3xl leading-tight">{proposal.title}</h2>
                  {proposal.description ? (
                    <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted">{proposal.description}</p>
                  ) : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-moss text-white" : "bg-paper text-muted"}`}>
                  {active ? "Open" : "Closed"}
                </span>
              </div>
              <div className="mt-5">
                <VoteBar yes={yes} no={no} />
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="font-medium text-moss">{yes} yes</span>
                  <span className="font-medium text-ember">{no} no</span>
                  <span>Opened {formatTime(proposal.createdAt)}</span>
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
