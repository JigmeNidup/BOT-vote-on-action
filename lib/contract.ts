import { voteOnActionAbi } from "@/lib/abi";

const rawAddress = process.env.NEXT_PUBLIC_VOTE_ON_ACTION_ADDRESS?.trim() ?? "";

export const contractAddress = /^0x[a-fA-F0-9]{40}$/.test(rawAddress)
  ? (rawAddress as `0x${string}`)
  : undefined;

export const hasContract = Boolean(contractAddress);

export { voteOnActionAbi };

export const proposalStatus = {
  active: 0,
  closed: 1,
} as const;

export const voteChoice = {
  none: 0,
  yes: 1,
  no: 2,
} as const;
