export type Team = {
  id: bigint;
  owner: `0x${string}`;
  name: string;
  memberCount: bigint;
  createdAt: bigint;
};

export type Proposal = {
  id: bigint;
  teamId: bigint;
  proposer: `0x${string}`;
  title: string;
  description: string;
  yesCount: bigint;
  noCount: bigint;
  status: number;
  createdAt: bigint;
  closedAt: bigint;
};

export type VoteRecord = {
  choice: number;
  suggestion: string;
  votedAt: bigint;
  hasVoted: boolean;
};
