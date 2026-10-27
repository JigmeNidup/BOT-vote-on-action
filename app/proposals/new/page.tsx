"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { ContractGate, ErrorText, Loading, Page, PageHeader, TxStatus } from "@/components/ContractGate";
import { botChain } from "@/lib/chain";
import { contractAddress, hasContract, voteOnActionAbi } from "@/lib/contract";
import { txError, useContractWrite, useTeams } from "@/lib/hooks";
import type { Team } from "@/lib/types";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

export default function NewProposalPage() {
  const router = useRouter();
  const { address, isConnected, chainId } = useAccount();
  const onBotChain = isConnected && chainId === botChain.id;
  const teamsQuery = useTeams();
  const teams = (teamsQuery.data ?? []) as Team[];
  const membership = useReadContracts({
    contracts: teams.map((team) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "isMember" as const,
      args: [team.id, address ?? zeroAddress] as const,
    })),
    query: { enabled: hasContract && Boolean(address) && teams.length > 0 },
  });
  const mine = teams.filter((_, index) => membership.data?.[index]?.result === true);
  const mineKey = mine.map((team) => team.id.toString()).join(",");
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState("");
  const write = useContractWrite();
  const busy = write.isPending || write.receipt.isLoading;

  useEffect(() => {
    if (!teamId && mine.length > 0) setTeamId(mine[0].id.toString());
  }, [mine, mineKey, teamId]);

  useEffect(() => {
    const receipt = write.receipt.data;
    if (!receipt) return;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: voteOnActionAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "ProposalCreated") {
          router.push(`/proposals/${decoded.args.proposalId.toString()}`);
          return;
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }
  }, [router, write.receipt.data]);

  async function createProposal(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (!teamId) {
      setLocalError("Select a team you belong to.");
      return;
    }
    if (!title.trim()) {
      setLocalError("A proposal needs a title.");
      return;
    }
    write.reset();
    try {
      await write.writeContractAsync({
        address: contractAddress!,
        abi: voteOnActionAbi,
        functionName: "createProposal",
        args: [BigInt(teamId), title.trim(), description.trim()],
      });
    } catch {
      // The write hook surfaces the wallet or contract error.
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="New record"
        title="Open a proposal"
        text="Eligible voters are copied from the team at this moment. People who join later cannot vote on it."
      />
      <ContractGate>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {teamsQuery.isLoading || membership.isLoading ? <Loading /> : null}
            {teamsQuery.error || membership.error ? (
              <ErrorText message={txError(teamsQuery.error ?? membership.error)} />
            ) : null}
            {!isConnected ? <p className="text-sm text-muted">Connect a wallet to create a proposal.</p> : null}
            {isConnected && !teamsQuery.isLoading && !membership.isLoading && mine.length === 0 ? (
              <p className="text-sm text-muted">You are not a member of a team yet. Create one on the Teams page.</p>
            ) : null}
            {mine.length > 0 ? (
              <form className="panel space-y-5 p-5 sm:p-7" onSubmit={(event) => void createProposal(event)}>
                <div>
                  <label className="text-sm font-semibold" htmlFor="team">
                    Team
                  </label>
                  <select id="team" className="field mt-2" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                    {mine.map((team) => (
                      <option key={team.id.toString()} value={team.id.toString()}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="title">
                    Title
                  </label>
                  <input id="title" className="field mt-2" value={title} placeholder="Approve the Q4 vendor" onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    className="field mt-2 min-h-36"
                    placeholder="What should the team decide?"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                {isConnected && !onBotChain ? (
                  <p className="text-sm text-ember">Switch to {botChain.name} before creating a proposal.</p>
                ) : null}
                {localError ? <p className="text-sm text-ember">{localError}</p> : null}
                <TxStatus
                  pending={write.isPending}
                  confirming={write.receipt.isLoading}
                  success={write.receipt.isSuccess}
                  error={write.error || write.receipt.error ? txError(write.error ?? write.receipt.error) : undefined}
                />
                <button type="submit" className="btn btn-primary" disabled={!onBotChain || busy}>
                  Create proposal
                </button>
              </form>
            ) : null}
          </div>
          <aside className="panel h-fit p-5">
            <p className="kicker">What gets locked</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
              <li>Current team members become the only eligible voters.</li>
              <li>Each of them can cast one Yes or one No.</li>
              <li>A No vote must include a suggestion.</li>
              <li>The creator or team owner can close it.</li>
            </ul>
          </aside>
        </div>
      </ContractGate>
    </Page>
  );
}
