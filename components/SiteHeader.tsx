"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ViewSlider, useAuditMode } from "@/components/AuditMode";
import { botChain, explorerUrl, networkLabel } from "@/lib/chain";
import { contractAddress } from "@/lib/contract";
import { shortAddress } from "@/lib/format";

const links = [
  { href: "/", label: "Open", hint: "Active votes" },
  { href: "/proposals", label: "Ledger", hint: "Full history" },
  { href: "/proposals/new", label: "Propose", hint: "Open a decision" },
  { href: "/teams", label: "Teams", hint: "Members" },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  if (href === "/proposals") return pathname === "/proposals" || /^\/proposals\/\d+$/.test(pathname);
  return pathname === href;
}

function WalletControls({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  useEffect(() => setMounted(true), []);

  const onBotChain = chainId === botChain.id;
  const injected = connectors[0];

  if (!mounted) {
    return <span className="btn btn-primary opacity-70">Connect wallet</span>;
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {onBotChain ? (
          <span className="rounded-full bg-moss/15 px-3 py-1.5 text-xs font-semibold text-moss">{networkLabel} · {botChain.id}</span>
        ) : (
          <button type="button" className="btn btn-danger" disabled={isSwitching} onClick={() => switchChain({ chainId: botChain.id })}>
            {isSwitching ? "Switching…" : `Switch to ${botChain.name}`}
          </button>
        )}
        <span
          className={`rounded-full px-3 py-1.5 font-mono text-xs ${
            tone === "dark" ? "border border-white/15 bg-white/10 text-white" : "border border-line bg-white text-ink"
          }`}
        >
          {shortAddress(address)}
        </span>
        <button type="button" className="btn btn-ghost !px-3 !py-1.5" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={isPending || !injected}
      onClick={() => {
        if (injected) connect({ connector: injected });
      }}
    >
      {!injected ? "No wallet found" : isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

function NavLinks({ pathname, onDark }: { pathname: string; onDark?: boolean }) {
  return (
    <nav className="flex gap-1 lg:flex-col">
      {links.map((link) => {
        const active = isActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl px-3 py-2.5 transition ${
              active
                ? onDark
                  ? "bg-white text-ink"
                  : "bg-ink text-paper"
                : onDark
                  ? "text-white/75 hover:bg-white/10 hover:text-white"
                  : "text-ink hover:bg-white"
            }`}
          >
            <span className="block text-sm font-semibold">{link.label}</span>
            <span className={`mt-0.5 hidden text-xs lg:block ${active ? "text-muted" : onDark ? "text-white/45" : "text-muted"}`}>
              {link.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { audit } = useAuditMode();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden bg-rail text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:px-4 lg:py-6">
        <div>
          <Link href="/" className="mb-8 block px-3">
            <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-moss text-sm font-bold">V</span>
            <span className="block font-serif text-3xl leading-none">Vote on Action</span>
            <span className="mt-2 block text-xs uppercase tracking-[0.18em] text-white/50">
              {audit ? "Audit trail" : botChain.name}
            </span>
          </Link>
          <NavLinks pathname={pathname} onDark />
        </div>
        <div className="space-y-4 px-3">
          <WalletControls tone="dark" />
          {contractAddress ? (
            <a className="block text-xs text-white/55 underline decoration-white/20" href={`${explorerUrl}/address/${contractAddress}`}>
              Contract {shortAddress(contractAddress)}
            </a>
          ) : (
            <p className="text-xs text-white/45">Contract address not set</p>
          )}
        </div>
      </aside>

      <div className={audit ? "audit-on min-w-0" : "min-w-0"}>
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="font-serif text-2xl">
              Vote on Action
            </Link>
            <WalletControls />
          </div>
          <div className="mt-3 flex justify-center">
            <ViewSlider />
          </div>
          <div className="mt-3 overflow-x-auto">
            <NavLinks pathname={pathname} />
          </div>
        </header>
        <div className="sticky top-0 z-20 hidden items-center justify-between border-b border-line/80 bg-paper/90 px-8 py-4 backdrop-blur lg:flex">
          <ViewSlider />
          <span className="text-xs uppercase tracking-[0.16em] text-muted">{audit ? "On-chain proof" : "Slide across for the audit"}</span>
        </div>
        {audit ? (
          <p className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-ink lg:px-8">
            Audit view reads chain {botChain.id}. It does not send a transaction.
          </p>
        ) : null}
        <main>{children}</main>
      </div>
    </div>
  );
}
