"use client";

import { createContext, useContext, useEffect, useState } from "react";

type AuditModeValue = {
  audit: boolean;
  setAudit: (value: boolean) => void;
};

const AuditModeContext = createContext<AuditModeValue | null>(null);

export function AuditModeProvider({ children }: { children: React.ReactNode }) {
  const [audit, setAuditState] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("voa-view");
    const fromUrl = new URLSearchParams(window.location.search).get("view") === "audit";
    if (stored === "audit" || fromUrl) setAuditState(true);
  }, []);

  function setAudit(value: boolean) {
    setAuditState(value);
    window.localStorage.setItem("voa-view", value ? "audit" : "main");
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("view", "audit");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    if (value) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <AuditModeContext.Provider value={{ audit, setAudit }}>{children}</AuditModeContext.Provider>;
}

export function useAuditMode() {
  const value = useContext(AuditModeContext);
  if (!value) throw new Error("useAuditMode must be used inside AuditModeProvider");
  return value;
}

export function ViewSlider() {
  const { audit, setAudit } = useAuditMode();

  return (
    <div className="relative grid h-11 w-[15.5rem] grid-cols-2 rounded-full border border-line bg-white p-1 shadow-sm" role="tablist" aria-label="Choose a view">
      <span
        aria-hidden
        className={`audit-thumb absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full shadow transition-transform duration-300 ease-out ${
          audit ? "translate-x-full bg-ink" : "bg-moss"
        }`}
      />
      <button
        type="button"
        role="tab"
        aria-selected={!audit}
        className={`relative z-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss ${
          audit ? "text-muted" : "text-white"
        }`}
        onClick={() => setAudit(false)}
      >
        Main
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={audit}
        className={`relative z-10 rounded-full text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          audit ? "text-white" : "text-muted"
        }`}
        onClick={() => setAudit(true)}
      >
        Audit
      </button>
    </div>
  );
}
