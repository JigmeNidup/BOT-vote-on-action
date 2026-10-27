"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { injected } from "@wagmi/core";
import { WagmiProvider, createConfig, http } from "wagmi";
import { AuditModeProvider } from "@/components/AuditMode";
import { botChain, botTransportUrls } from "@/lib/chain";

const config = createConfig({
  chains: [botChain],
  connectors: [injected()],
  transports: {
    677: http(botTransportUrls[677]),
    968: http(botTransportUrls[968]),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuditModeProvider>{children}</AuditModeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
