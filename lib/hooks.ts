"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { BaseError } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  type ClosedLog,
  type CreatedLog,
  type RawLog,
  type VoteLog,
  closedEvent,
  createdEvent,
  mapClosedLog,
  mapCreatedLog,
  mapVotedLog,
  votedEvent,
} from "@/lib/audit";
import { botChain } from "@/lib/chain";
import { contractAddress, hasContract, voteOnActionAbi } from "@/lib/contract";
import { sameAddress } from "@/lib/format";
import type { Proposal, Team } from "@/lib/types";

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;

export function txError(error: unknown) {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function useContractWrite() {
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (receipt.isSuccess) {
      void queryClient.invalidateQueries();
    }
  }, [queryClient, receipt.isSuccess, receipt.data?.transactionHash]);

  return { ...write, receipt };
}

export function useTeams() {
  return useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getTeams",
    query: { enabled: hasContract },
  });
}

export function useProposals() {
  return useReadContract({
    address: contractAddress ?? zeroAddress,
    abi: voteOnActionAbi,
    functionName: "getProposals",
    query: { enabled: hasContract },
  });
}

export function useWalletScope() {
  const { address, isConnected } = useAccount();
  const teamsQuery = useTeams();
  const proposalsQuery = useProposals();
  const teams = (teamsQuery.data ?? []) as Team[];
  const proposals = (proposalsQuery.data ?? []) as Proposal[];
  const membershipQuery = useReadContracts({
    contracts: teams.map((team) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "isMember" as const,
      args: [team.id, address ?? zeroAddress] as const,
    })),
    query: { enabled: hasContract && Boolean(address) && teams.length > 0 },
  });
  const eligibilityQuery = useReadContracts({
    contracts: proposals.map((proposal) => ({
      address: contractAddress ?? zeroAddress,
      abi: voteOnActionAbi,
      functionName: "isEligible" as const,
      args: [proposal.id, address ?? zeroAddress] as const,
    })),
    query: { enabled: hasContract && Boolean(address) && proposals.length > 0 },
  });

  const myTeams = useMemo(() => {
    if (!address) return [];
    return teams.filter((team, index) => sameAddress(team.owner, address) || membershipQuery.data?.[index]?.result === true);
  }, [address, membershipQuery.data, teams]);

  const myProposals = useMemo(() => {
    if (!address) return [];
    const teamIds = new Set(myTeams.map((team) => team.id.toString()));
    return proposals.filter(
      (proposal, index) =>
        teamIds.has(proposal.teamId.toString()) ||
        sameAddress(proposal.proposer, address) ||
        eligibilityQuery.data?.[index]?.result === true,
    );
  }, [address, eligibilityQuery.data, myTeams, proposals]);

  const membershipLoading = Boolean(address) && teams.length > 0 && membershipQuery.isLoading;
  const eligibilityLoading = Boolean(address) && proposals.length > 0 && eligibilityQuery.isLoading;

  return {
    address,
    isConnected,
    myTeams,
    myProposals,
    loading: teamsQuery.isLoading || proposalsQuery.isLoading || membershipLoading || eligibilityLoading,
    error: teamsQuery.error ?? proposalsQuery.error ?? membershipQuery.error ?? eligibilityQuery.error,
  };
}

export type ChainProof = {
  blockNumber: bigint;
  voted: VoteLog[];
  created: CreatedLog[];
  closed: ClosedLog[];
  undecoded: number;
};

export function useChainProof() {
  const client = usePublicClient({ chainId: botChain.id });

  return useQuery({
    queryKey: ["chain-proof", contractAddress],
    enabled: hasContract && Boolean(client),
    retry: 1,
    staleTime: 20_000,
    queryFn: async (): Promise<ChainProof> => {
      if (!client || !contractAddress) throw new Error("BOT Chain client is unavailable.");
      try {
        const [blockNumber, votedLogs, createdLogs, closedLogs] = await Promise.all([
          client.getBlockNumber(),
          client.getLogs({ address: contractAddress, event: votedEvent, fromBlock: 0n, toBlock: "latest" }),
          client.getLogs({ address: contractAddress, event: createdEvent, fromBlock: 0n, toBlock: "latest" }),
          client.getLogs({ address: contractAddress, event: closedEvent, fromBlock: 0n, toBlock: "latest" }),
        ]);
        const voted = votedLogs.map((log) => mapVotedLog(log as RawLog));
        const created = createdLogs.map((log) => mapCreatedLog(log as RawLog));
        const closed = closedLogs.map((log) => mapClosedLog(log as RawLog));
        return {
          blockNumber,
          voted: voted.filter((log): log is VoteLog => log !== null),
          created: created.filter((log): log is CreatedLog => log !== null),
          closed: closed.filter((log): log is ClosedLog => log !== null),
          undecoded: [...voted, ...created, ...closed].filter((log) => log === null).length,
        };
      } catch (error) {
        throw new Error(txError(error));
      }
    },
  });
}
