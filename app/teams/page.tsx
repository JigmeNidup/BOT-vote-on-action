"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { ContractGate, ErrorText, Loading, Page, PageHeader, TxStatus } from "@/components/ContractGate";
import { TeamCard } from "@/components/TeamCard";
import { botChainTestnet } from "@/lib/chain";
import { contractAddress, hasContract, voteOnActionAbi } from "@/lib/contract";
import { txError, useContractWrite, useTeams } from "@/lib/hooks";
import type { Team } from "@/lib/types";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

export default function TeamsPage() {
  const teamsQuery = useTeams();
  const teams = (teamsQuery.data ?? []) as Team[];
  const membersQuery = useReadContracts({
    contracts: teams.map((team) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "getMembers" as const,
      args: [team.id] as const,
    })),
    query: { enabled: hasContract && teams.length > 0 },
  });
  const { isConnected, chainId } = useAccount();
  const onBotChain = isConnected && chainId === botChainTestnet.id;
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState("");
  const write = useContractWrite();
  const busy = write.isPending || write.receipt.isLoading;

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (!name.trim()) {
      setLocalError("A team needs a name.");
      return;
    }
    write.reset();
    try {
      await write.writeContractAsync({
        address: contractAddress!,
        abi: voteOnActionAbi,
        functionName: "createTeam",
        args: [name.trim()],
      });
      setName("");
    } catch {
      // The write hook surfaces the wallet or contract error.
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Membership"
        title="Teams"
        text="The connected wallet becomes the owner and the first member. Only that owner can change the roster."
      />
      <ContractGate>
        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <form className="panel p-5 lg:sticky lg:top-6" onSubmit={(event) => void createTeam(event)}>
            <p className="kicker">New team</p>
            <label className="mt-3 block text-sm font-semibold" htmlFor="team-name">
              Name
            </label>
            <input
              id="team-name"
              className="field mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Treasury working group"
            />
            <button type="submit" className="btn btn-primary mt-4 w-full" disabled={!onBotChain || busy}>
              Create team
            </button>
            {!isConnected ? <p className="mt-3 text-sm text-muted">Connect a wallet to create a team.</p> : null}
            {isConnected && !onBotChain ? (
              <p className="mt-3 text-sm text-ember">Switch to BOT Chain testnet before creating a team.</p>
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
          </form>

          <div className="space-y-4">
            {teamsQuery.isLoading ? <Loading /> : null}
            {teamsQuery.error ? <ErrorText message={txError(teamsQuery.error)} /> : null}
            {membersQuery.error ? <ErrorText message={txError(membersQuery.error)} /> : null}
            {!teamsQuery.isLoading && !teamsQuery.error && teams.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-muted">No teams yet.</p>
            ) : null}
            {teams.map((team, index) => (
              <TeamCard
                key={team.id.toString()}
                team={team}
                members={(membersQuery.data?.[index]?.result as `0x${string}`[] | undefined) ?? []}
              />
            ))}
          </div>
        </div>
      </ContractGate>
    </Page>
  );
}
