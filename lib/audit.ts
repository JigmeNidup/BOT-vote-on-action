import { proposalStatus, voteChoice } from "@/lib/contract";
import { sameAddress, shortAddress } from "@/lib/format";
import type { Proposal, VoteRecord } from "@/lib/types";

export type ReadState = "loading" | "ready" | "error";
export type CheckStatus = "pass" | "fail" | "pending";

export type VoteLog = {
  proposalId: bigint;
  voter: `0x${string}`;
  choice: number;
  suggestion: string;
  votedAt: bigint;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
  logIndex: number;
};

export type CreatedLog = {
  proposalId: bigint;
  teamId: bigint;
  proposer: `0x${string}`;
  title: string;
  createdAt: bigint;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
  logIndex: number;
};

export type ClosedLog = {
  proposalId: bigint;
  closer: `0x${string}`;
  closedAt: bigint;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
  logIndex: number;
};

export type AuditCheck = {
  id: string;
  title: string;
  detail: string;
  status: CheckStatus;
};

export type VoteProof = {
  voter: `0x${string}`;
  choice: number;
  suggestion: string;
  votedAt: bigint;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
  logIndex?: number;
  source: "log" | "storage";
  issues: string[];
};

export type AuditReport = {
  status: CheckStatus;
  checks: AuditCheck[];
  proofs: VoteProof[];
  abstentions: `0x${string}`[];
  ballotYes: number | null;
  ballotNo: number | null;
  eventYes: number | null;
  eventNo: number | null;
};

type Ballot = { voter: `0x${string}`; record?: VoteRecord };
type Flag = { voter: `0x${string}`; eligible?: boolean };

export const votedEvent = {
  type: "event",
  name: "Voted",
  inputs: [
    { name: "proposalId", type: "uint256", indexed: true },
    { name: "voter", type: "address", indexed: true },
    { name: "choice", type: "uint8", indexed: false },
    { name: "suggestion", type: "string", indexed: false },
    { name: "votedAt", type: "uint256", indexed: false },
  ],
} as const;

export const createdEvent = {
  type: "event",
  name: "ProposalCreated",
  inputs: [
    { name: "proposalId", type: "uint256", indexed: true },
    { name: "teamId", type: "uint256", indexed: true },
    { name: "proposer", type: "address", indexed: true },
    { name: "title", type: "string", indexed: false },
    { name: "createdAt", type: "uint256", indexed: false },
  ],
} as const;

export const closedEvent = {
  type: "event",
  name: "ProposalClosed",
  inputs: [
    { name: "proposalId", type: "uint256", indexed: true },
    { name: "closer", type: "address", indexed: true },
    { name: "closedAt", type: "uint256", indexed: false },
  ],
} as const;

export type RawLog = {
  args: {
    proposalId?: bigint;
    voter?: `0x${string}`;
    choice?: number | bigint;
    suggestion?: string;
    votedAt?: bigint;
    teamId?: bigint;
    proposer?: `0x${string}`;
    title?: string;
    createdAt?: bigint;
    closer?: `0x${string}`;
    closedAt?: bigint;
  };
  transactionHash: `0x${string}` | null;
  blockNumber: bigint | null;
  logIndex: number | null;
};

export function choiceName(choice: number) {
  if (choice === voteChoice.yes) return "Yes";
  if (choice === voteChoice.no) return "No";
  if (choice === voteChoice.none) return "None";
  return `Unknown (${choice})`;
}

export function mapVotedLog(log: RawLog): VoteLog | null {
  const choice = asNumber(log.args.choice);
  if (log.args.proposalId === undefined || !log.args.voter || choice === undefined || log.args.votedAt === undefined) {
    return null;
  }
  return {
    proposalId: log.args.proposalId,
    voter: log.args.voter,
    choice,
    suggestion: log.args.suggestion ?? "",
    votedAt: log.args.votedAt,
    ...chainRef(log),
  };
}

export function mapCreatedLog(log: RawLog): CreatedLog | null {
  if (
    log.args.proposalId === undefined ||
    log.args.teamId === undefined ||
    !log.args.proposer ||
    log.args.title === undefined ||
    log.args.createdAt === undefined
  ) {
    return null;
  }
  return {
    proposalId: log.args.proposalId,
    teamId: log.args.teamId,
    proposer: log.args.proposer,
    title: log.args.title,
    createdAt: log.args.createdAt,
    ...chainRef(log),
  };
}

export function mapClosedLog(log: RawLog): ClosedLog | null {
  if (log.args.proposalId === undefined || !log.args.closer || log.args.closedAt === undefined) return null;
  return {
    proposalId: log.args.proposalId,
    closer: log.args.closer,
    closedAt: log.args.closedAt,
    ...chainRef(log),
  };
}

export function reconcileProposal(proposal: Proposal, logs: VoteLog[]) {
  const counted = countLogs(logs);
  const issues = tallyIssues(proposal, counted);
  issues.push(...duplicateIssues(counted.duplicates));
  issues.push(...logs.flatMap((log) => suggestionIssues(log.voter, log.choice, log.suggestion)));
  issues.push(...logs.flatMap((log) => windowIssues(log.voter, log.votedAt, proposal)));
  return {
    status: (issues.length ? "fail" : "pass") as CheckStatus,
    note: issues[0] ?? (logs.length === 0 ? "No Voted events, and both counters are zero." : "Voted events match the stored counters."),
    eventYes: counted.yes,
    eventNo: counted.no,
  };
}

export function buildAuditReport(input: {
  proposal: Proposal;
  records: Ballot[];
  logs: VoteLog[];
  created: CreatedLog[];
  closed: ClosedLog[];
  eligibility: Flag[];
  votesState: ReadState;
  logsState: ReadState;
  eligibilityState: ReadState;
  logsError?: string;
  undecoded: number;
  snapshotReady: boolean;
}): AuditReport {
  const logs = [...input.logs].sort(byChainOrder);
  const counted = countLogs(logs);
  const stored = countStored(input.records);
  const votesReady = input.votesState === "ready";
  const logsReady = input.logsState === "ready";
  const checks: AuditCheck[] = [
    eligibilityCheck(input),
    onceCheck(input, counted.duplicates),
    ballotCheck(input, stored),
    eventCheck(input, counted),
    agreementCheck(input, logs),
    suggestionCheck(input, logs),
    windowCheck(input, logs),
    openingCheck(input),
    closingCheck(input),
  ];

  const proofs = logsReady
    ? logs.map((log) => toLogProof(log, input.records, input.proposal, input.snapshotReady))
    : [];
  if (votesReady && logsReady) proofs.push(...storageOnlyProofs(input.records, logs, input.proposal));

  return {
    status: overall(checks),
    checks,
    proofs,
    abstentions: votesReady && logsReady ? abstentions(input.records, logs) : [],
    ballotYes: votesReady ? stored.yes : null,
    ballotNo: votesReady ? stored.no : null,
    eventYes: logsReady ? counted.yes : null,
    eventNo: logsReady ? counted.no : null,
  };
}

function eligibilityCheck(input: Parameters<typeof buildAuditReport>[0]): AuditCheck {
  if (!input.snapshotReady || input.eligibilityState === "loading") {
    return pending("eligible", "Snapshot matches the eligibility map", "Reading getEligibleVoters and isEligible.");
  }
  if (input.eligibilityState === "error") {
    return pending("eligible", "Snapshot matches the eligibility map", "isEligible could not be read.");
  }
  if (input.records.length === 0) {
    return fail("eligible", "Snapshot matches the eligibility map", "getEligibleVoters returned no wallets.");
  }
  const missing = input.eligibility.filter((entry) => entry.eligible !== true);
  if (missing.length) {
    return fail(
      "eligible",
      "Snapshot matches the eligibility map",
      `${missing.map((entry) => shortAddress(entry.voter)).join(", ")} ${missing.length === 1 ? "is" : "are"} on the snapshot list but isEligible is not true.`,
    );
  }
  return pass(
    "eligible",
    "Snapshot matches the eligibility map",
    `isEligible is true for all ${input.records.length} wallets returned by getEligibleVoters.`,
  );
}

function onceCheck(input: Parameters<typeof buildAuditReport>[0], duplicates: string[]): AuditCheck {
  if (input.snapshotReady) {
    const seen = new Set<string>();
    const repeated = input.records.filter((entry) => {
      const key = entry.voter.toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (repeated.length) {
      return fail("once", "Each wallet appears once", `The snapshot lists ${shortAddress(repeated[0].voter)} more than once.`);
    }
  }
  if (input.logsState === "loading") return pending("once", "Each wallet appears once", "Reading Voted logs for duplicate wallets.");
  if (input.logsState === "error") return pending("once", "Each wallet appears once", input.logsError ?? "Voted logs could not be read.");
  if (duplicates.length) {
    return fail("once", "Each wallet appears once", `${duplicates.map(shortAddress).join(", ")} emitted more than one Voted event.`);
  }
  if (!input.snapshotReady) return pending("once", "Each wallet appears once", "Reading the snapshot.");
  return pass("once", "Each wallet appears once", "The snapshot and the Voted log each list every wallet at most once.");
}

function ballotCheck(input: Parameters<typeof buildAuditReport>[0], stored: ReturnType<typeof countStored>): AuditCheck {
  if (input.votesState === "loading") return pending("ballots", "Stored ballots match the counters", "Reading getVote for each snapshot wallet.");
  if (input.votesState === "error" || stored.missing) {
    return pending("ballots", "Stored ballots match the counters", "One or more getVote reads failed.");
  }
  const issues: string[] = [];
  if (BigInt(stored.yes) !== input.proposal.yesCount) issues.push(`getVote has ${stored.yes} yes, yesCount is ${input.proposal.yesCount.toString()}.`);
  if (BigInt(stored.no) !== input.proposal.noCount) issues.push(`getVote has ${stored.no} no, noCount is ${input.proposal.noCount.toString()}.`);
  if (stored.other) issues.push(`${stored.other} stored ballot${stored.other === 1 ? "" : "s"} use an unknown choice.`);
  if (issues.length) return fail("ballots", "Stored ballots match the counters", issues.join(" "));
  return pass("ballots", "Stored ballots match the counters", "Adding up getVote gives the same yesCount and noCount stored on the proposal.");
}

function eventCheck(input: Parameters<typeof buildAuditReport>[0], counted: ReturnType<typeof countLogs>): AuditCheck {
  if (input.logsState === "loading") return pending("events", "Voted events match the counters", "Reading Voted logs from the contract.");
  if (input.logsState === "error") return pending("events", "Voted events match the counters", input.logsError ?? "Voted logs could not be read.");
  const issues = tallyIssues(input.proposal, counted);
  if (input.undecoded) issues.push(`${input.undecoded} log${input.undecoded === 1 ? "" : "s"} could not be decoded.`);
  if (issues.length) return fail("events", "Voted events match the counters", issues.join(" "));
  const total = counted.yes + counted.no;
  return pass(
    "events",
    "Voted events match the counters",
    total === 0 ? "There are no Voted events, and both counters are zero." : `${total} Voted event${total === 1 ? "" : "s"} add up to the stored counters.`,
  );
}

function agreementCheck(input: Parameters<typeof buildAuditReport>[0], logs: VoteLog[]): AuditCheck {
  if (input.logsState === "loading" || input.votesState === "loading" || !input.snapshotReady) {
    return pending("agree", "Each event matches the stored ballot", "Waiting for the logs and getVote.");
  }
  if (input.logsState === "error" || input.votesState === "error") {
    return pending("agree", "Each event matches the stored ballot", "The log or the stored ballots could not be read.");
  }
  const issues = logs.flatMap((log) => {
    const record = findRecord(input.records, log.voter);
    if (!input.records.some((entry) => sameAddress(entry.voter, log.voter))) {
      return [`${shortAddress(log.voter)} voted but is not in getEligibleVoters.`];
    }
    if (!record?.hasVoted) return [`${shortAddress(log.voter)} has a Voted event but getVote says they have not voted.`];
    return fieldIssues(log, record);
  });
  for (const entry of input.records) {
    if (!entry.record?.hasVoted) continue;
    if (!logs.some((log) => sameAddress(log.voter, entry.voter))) {
      issues.push(`${shortAddress(entry.voter)} has a stored ballot and no Voted event.`);
    }
  }
  if (issues.length) return fail("agree", "Each event matches the stored ballot", issues.join(" "));
  return pass("agree", "Each event matches the stored ballot", "Choice, suggestion, and time on every Voted log match getVote for that wallet.");
}

function suggestionCheck(input: Parameters<typeof buildAuditReport>[0], logs: VoteLog[]): AuditCheck {
  if (input.logsState === "loading" && input.votesState === "loading") {
    return pending("suggestion", "Every No includes a readable suggestion", "Reading ballots and logs.");
  }
  const issues: string[] = [];
  if (input.votesState === "ready") {
    for (const entry of input.records) {
      if (!entry.record?.hasVoted) continue;
      issues.push(...suggestionIssues(entry.voter, entry.record.choice, entry.record.suggestion));
    }
  }
  if (input.logsState === "ready") {
    for (const log of logs) issues.push(...suggestionIssues(log.voter, log.choice, log.suggestion));
  }
  if (issues.length) return fail("suggestion", "Every No includes a readable suggestion", unique(issues).join(" "));
  if (input.logsState !== "ready" || input.votesState !== "ready") {
    return pending("suggestion", "Every No includes a readable suggestion", "Still reading the other copy of the ballots.");
  }
  return pass("suggestion", "Every No includes a readable suggestion", "Every No ballot has visible suggestion text. Yes ballots do not carry one.");
}

function windowCheck(input: Parameters<typeof buildAuditReport>[0], logs: VoteLog[]): AuditCheck {
  if (input.logsState !== "ready" || input.votesState !== "ready") {
    return pending("window", "Every ballot falls inside the open window", "Reading vote timestamps.");
  }
  const issues: string[] = [];
  for (const log of logs) issues.push(...windowIssues(log.voter, log.votedAt, input.proposal));
  for (const entry of input.records) {
    if (!entry.record?.hasVoted) continue;
    issues.push(...windowIssues(entry.voter, entry.record.votedAt, input.proposal));
  }
  if (issues.length) return fail("window", "Every ballot falls inside the open window", unique(issues).join(" "));
  return pass(
    "window",
    "Every ballot falls inside the open window",
    "Each vote time is at or after creation, and no later than the close time when the proposal is closed.",
  );
}

function openingCheck(input: Parameters<typeof buildAuditReport>[0]): AuditCheck {
  if (input.logsState === "loading") return pending("open", "The opening event matches the proposal", "Reading ProposalCreated.");
  if (input.logsState === "error") return pending("open", "The opening event matches the proposal", input.logsError ?? "Logs could not be read.");
  if (input.created.length !== 1) {
    return fail("open", "The opening event matches the proposal", `Expected one ProposalCreated event, found ${input.created.length}.`);
  }
  const event = input.created[0];
  const issues: string[] = [];
  if (event.teamId !== input.proposal.teamId) issues.push("The team id differs.");
  if (!sameAddress(event.proposer, input.proposal.proposer)) issues.push("The proposer differs.");
  if (event.title !== input.proposal.title) issues.push("The title differs.");
  if (event.createdAt !== input.proposal.createdAt) issues.push("The created time differs.");
  if (!event.transactionHash || event.blockNumber === undefined) issues.push("The event has no transaction hash or block.");
  if (issues.length) return fail("open", "The opening event matches the proposal", issues.join(" "));
  return pass(
    "open",
    "The opening event matches the proposal",
    "ProposalCreated matches the stored proposer, team, title, and time. The description is stored on the proposal and is not part of that event.",
  );
}

function closingCheck(input: Parameters<typeof buildAuditReport>[0]): AuditCheck {
  if (input.logsState !== "ready") return pending("close", "The closing event matches the outcome", "Reading ProposalClosed.");
  const closed = input.proposal.status === proposalStatus.closed;
  if (!closed) {
    if (input.closed.length || input.proposal.closedAt !== 0n) {
      return fail("close", "The closing event matches the outcome", "The proposal is open but a close time or ProposalClosed event is present.");
    }
    return pass("close", "The closing event matches the outcome", "The proposal is open, so there is no close event.");
  }
  if (input.proposal.closedAt === 0n) return fail("close", "The closing event matches the outcome", "The proposal is closed and closedAt is zero.");
  if (input.closed.length !== 1) {
    return fail("close", "The closing event matches the outcome", `Expected one ProposalClosed event, found ${input.closed.length}.`);
  }
  const event = input.closed[0];
  if (event.closedAt !== input.proposal.closedAt) {
    return fail("close", "The closing event matches the outcome", "closedAt on the proposal does not match the event.");
  }
  if (!event.transactionHash || event.blockNumber === undefined) {
    return fail("close", "The closing event matches the outcome", "The close event has no transaction hash or block.");
  }
  return pass(
    "close",
    "The closing event matches the outcome",
    `ProposalClosed matches the stored close time. Closer ${shortAddress(event.closer)}. The contract allows the proposer, or the team owner at that moment.`,
  );
}

function toLogProof(log: VoteLog, records: Ballot[], proposal: Proposal, snapshotReady: boolean): VoteProof {
  const listed = records.some((entry) => sameAddress(entry.voter, log.voter));
  const record = findRecord(records, log.voter);
  const issues: string[] = [];
  if (!log.transactionHash || log.blockNumber === undefined) issues.push("This log has no transaction hash or block number.");
  if (snapshotReady && !listed) issues.push("This wallet is not in getEligibleVoters.");
  if (record && !record.hasVoted) issues.push("getVote says this wallet has not voted.");
  if (record?.hasVoted) issues.push(...fieldIssues(log, record));
  issues.push(...suggestionIssues(log.voter, log.choice, log.suggestion));
  issues.push(...windowIssues(log.voter, log.votedAt, proposal));
  return { ...log, source: "log", issues: unique(issues) };
}

function storageOnlyProofs(records: Ballot[], logs: VoteLog[], proposal: Proposal): VoteProof[] {
  return records.flatMap((entry) => {
    if (!entry.record?.hasVoted || logs.some((log) => sameAddress(log.voter, entry.voter))) return [];
    return [
      {
        voter: entry.voter,
        choice: entry.record.choice,
        suggestion: entry.record.suggestion,
        votedAt: entry.record.votedAt,
        source: "storage" as const,
        issues: [
          "This ballot is in contract storage and has no Voted event.",
          ...suggestionIssues(entry.voter, entry.record.choice, entry.record.suggestion),
          ...windowIssues(entry.voter, entry.record.votedAt, proposal),
        ],
      },
    ];
  });
}

function fieldIssues(log: VoteLog, record: VoteRecord) {
  const issues: string[] = [];
  if (record.choice !== log.choice) issues.push(`getVote choice is ${choiceName(record.choice)}, the log says ${choiceName(log.choice)}.`);
  if (record.suggestion !== log.suggestion) issues.push("The stored suggestion does not match the log.");
  if (record.votedAt !== log.votedAt) issues.push("The stored vote time does not match the log.");
  return issues;
}

function suggestionIssues(voter: `0x${string}`, choice: number, suggestion: string) {
  if (choice === voteChoice.no && suggestion.length === 0) return [`${shortAddress(voter)} voted no with an empty suggestion.`];
  if (choice === voteChoice.no && suggestion.trim().length === 0) return [`${shortAddress(voter)} voted no with only whitespace.`];
  if (choice === voteChoice.yes && suggestion.length > 0) return [`${shortAddress(voter)} voted yes but a suggestion was stored.`];
  if (choice !== voteChoice.yes && choice !== voteChoice.no) return [`${shortAddress(voter)} has an unknown choice.`];
  return [];
}

function windowIssues(voter: `0x${string}`, votedAt: bigint, proposal: Proposal) {
  if (votedAt < proposal.createdAt) return [`${shortAddress(voter)} is timestamped before the proposal was created.`];
  if (proposal.closedAt > 0n && votedAt > proposal.closedAt) return [`${shortAddress(voter)} is timestamped after the proposal was closed.`];
  return [];
}

function tallyIssues(proposal: Proposal, counted: ReturnType<typeof countLogs>) {
  const issues: string[] = [];
  if (BigInt(counted.yes) !== proposal.yesCount) issues.push(`Yes events are ${counted.yes}, yesCount is ${proposal.yesCount.toString()}.`);
  if (BigInt(counted.no) !== proposal.noCount) issues.push(`No events are ${counted.no}, noCount is ${proposal.noCount.toString()}.`);
  if (counted.other) issues.push(`${counted.other} event${counted.other === 1 ? "" : "s"} use an unknown choice.`);
  return issues;
}

function countLogs(logs: VoteLog[]) {
  const seen = new Map<string, number>();
  let yes = 0;
  let no = 0;
  let other = 0;
  for (const log of logs) {
    if (log.choice === voteChoice.yes) yes += 1;
    else if (log.choice === voteChoice.no) no += 1;
    else other += 1;
    const key = log.voter.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return {
    yes,
    no,
    other,
    duplicates: [...seen.entries()].filter(([, count]) => count > 1).map(([voter]) => voter as `0x${string}`),
  };
}

function countStored(records: Ballot[]) {
  let yes = 0;
  let no = 0;
  let other = 0;
  let missing = 0;
  for (const entry of records) {
    if (!entry.record) {
      missing += 1;
      continue;
    }
    if (!entry.record.hasVoted) continue;
    if (entry.record.choice === voteChoice.yes) yes += 1;
    else if (entry.record.choice === voteChoice.no) no += 1;
    else other += 1;
  }
  return { yes, no, other, missing };
}

function abstentions(records: Ballot[], logs: VoteLog[]) {
  return records
    .filter((entry) => entry.record && !entry.record.hasVoted && !logs.some((log) => sameAddress(log.voter, entry.voter)))
    .map((entry) => entry.voter);
}

function findRecord(records: Ballot[], voter: string) {
  return records.find((entry) => sameAddress(entry.voter, voter))?.record;
}

function byChainOrder(left: VoteLog, right: VoteLog) {
  const leftBlock = left.blockNumber ?? 0n;
  const rightBlock = right.blockNumber ?? 0n;
  if (leftBlock !== rightBlock) return leftBlock < rightBlock ? -1 : 1;
  return left.logIndex - right.logIndex;
}

function overall(checks: AuditCheck[]): CheckStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "pending")) return "pending";
  return "pass";
}

function pass(id: string, title: string, detail: string): AuditCheck {
  return { id, title, detail, status: "pass" };
}

function fail(id: string, title: string, detail: string): AuditCheck {
  return { id, title, detail, status: "fail" };
}

function pending(id: string, title: string, detail: string): AuditCheck {
  return { id, title, detail, status: "pending" };
}

function duplicateIssues(voters: string[]) {
  return voters.map((voter) => `${shortAddress(voter)} has more than one Voted event.`);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function asNumber(value: number | bigint | undefined) {
  if (value === undefined) return undefined;
  return typeof value === "bigint" ? Number(value) : value;
}

function chainRef(log: RawLog) {
  return {
    transactionHash: log.transactionHash ?? undefined,
    blockNumber: log.blockNumber ?? undefined,
    logIndex: log.logIndex ?? 0,
  };
}
