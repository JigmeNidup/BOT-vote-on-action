"use client";

import { hasContract } from "@/lib/contract";

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{text}</p>
      </div>
      {action}
    </div>
  );
}

export function ContractGate({ children }: { children: React.ReactNode }) {
  if (!hasContract) {
    return (
      <div className="panel p-6 sm:p-8">
        <p className="kicker">Setup</p>
        <h2 className="mt-2 font-serif text-3xl">Contract not configured</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Deploy VoteOnAction to BOT Chain, then set NEXT_PUBLIC_VOTE_ON_ACTION_ADDRESS. The deployer
          account needs BOT for gas.
        </p>
      </div>
    );
  }

  return children;
}

export function Loading() {
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="h-32 animate-pulse rounded-3xl bg-line/80" />
      <div className="h-32 animate-pulse rounded-3xl bg-line/60" />
      <p className="text-sm text-muted">Loading on-chain records…</p>
    </div>
  );
}

export function ErrorText({ message }: { message: string }) {
  return <p className="rounded-2xl border border-ember/20 bg-ember/5 px-4 py-3 text-sm text-ember">{message}</p>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</p>
    </div>
  );
}

export function TxStatus({
  pending,
  confirming,
  success,
  error,
}: {
  pending: boolean;
  confirming: boolean;
  success: boolean;
  error?: string;
}) {
  if (error) return <p className="rounded-2xl bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p>;
  if (pending) return <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">Confirm the transaction in your wallet…</p>;
  if (confirming) return <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">Waiting for BOT Chain confirmation…</p>;
  if (success) return <p className="rounded-2xl bg-moss/10 px-3 py-2 text-sm font-medium text-moss">Recorded on-chain.</p>;
  return null;
}
