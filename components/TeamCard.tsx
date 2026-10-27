"use client";

import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { useAccount } from "wagmi";
import { TxStatus } from "@/components/ContractGate";
import { botChain, explorerUrl } from "@/lib/chain";
import { contractAddress, voteOnActionAbi } from "@/lib/contract";
import { formatTime, sameAddress, shortAddress } from "@/lib/format";
import { txError, useContractWrite } from "@/lib/hooks";
import type { Team } from "@/lib/types";

export function TeamCard({ team, members }: { team: Team; members: `0x${string}`[] }) {
  const { address, isConnected, chainId } = useAccount();
  const isOwner = sameAddress(address, team.owner);
  const onBotChain = isConnected && chainId === botChain.id;
  const [memberInput, setMemberInput] = useState("");
  const [localError, setLocalError] = useState("");
  const write = useContractWrite();
  const busy = write.isPending || write.receipt.isLoading;

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (!isAddress(memberInput)) {
      setLocalError("Enter a valid wallet address.");
      return;
    }
    write.reset();
    try {
      await write.writeContractAsync({
        address: contractAddress!,
        abi: voteOnActionAbi,
        functionName: "addMember",
        args: [team.id, getAddress(memberInput)],
      });
      setMemberInput("");
    } catch {
      // The write hook surfaces the wallet or contract error.
    }
  }

  async function removeMember(member: `0x${string}`) {
    if (!window.confirm(`Remove ${member} from ${team.name}?`)) return;
    setLocalError("");
    write.reset();
    try {
      await write.writeContractAsync({
        address: contractAddress!,
        abi: voteOnActionAbi,
        functionName: "removeMember",
        args: [team.id, member],
      });
    } catch {
      // The write hook surfaces the wallet or contract error.
    }
  }

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">{team.name}</h2>
          <p className="mt-2 text-sm text-muted">
            Owner{" "}
            <a className="font-mono text-ink underline decoration-line" href={`${explorerUrl}/address/${team.owner}`}>
              {shortAddress(team.owner)}
            </a>
            {" · "}
            {team.memberCount.toString()} {team.memberCount === 1n ? "member" : "members"}
            {" · "}
            Created {formatTime(team.createdAt)}
          </p>
        </div>
        {isOwner ? <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">You own this</span> : null}
      </div>

      <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {members.map((member) => {
          const ownerRow = sameAddress(member, team.owner);
          return (
            <li key={member} className="flex items-center justify-between gap-3 bg-white px-3 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ background: `hsl(${parseInt(member.slice(2, 8), 16) % 360} 42% 42%)` }}
                />
                <span className="min-w-0">
                  <a className="block truncate font-mono text-xs sm:text-sm" href={`${explorerUrl}/address/${member}`} title={member}>
                    {member}
                  </a>
                  <span className="text-xs text-muted">
                    {ownerRow ? "Owner" : "Member"}
                    {sameAddress(member, address) ? " · You" : ""}
                  </span>
                </span>
              </span>
              {isOwner ? (
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-1.5"
                  disabled={!onBotChain || busy || ownerRow}
                  onClick={() => void removeMember(member)}
                >
                  {ownerRow ? "Stays" : "Remove"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void addMember(event)}>
          <input
            className="field"
            aria-label={`Add a member to ${team.name}`}
            placeholder="0x member wallet"
            value={memberInput}
            onChange={(event) => setMemberInput(event.target.value)}
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={!onBotChain || busy}>
            Add member
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Only the team owner can add or remove members.</p>
      )}
      {isOwner && isConnected && !onBotChain ? (
        <p className="mt-3 text-sm text-ember">Switch to {botChain.name} before changing members.</p>
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
    </article>
  );
}
