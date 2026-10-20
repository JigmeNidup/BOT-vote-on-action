"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BaseError } from "viem";
import { usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
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
import { botChainTestnet } from "@/lib/chain";
import { contractAddress, hasContract, voteOnActionAbi } from "@/lib/contract";

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

export type ChainProof = {
  blockNumber: bigint;
  voted: VoteLog[];
  created: CreatedLog[];
  closed: ClosedLog[];
  undecoded: number;
};

export function useChainProof() {
  const client = usePublicClient({ chainId: botChainTestnet.id });

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
