"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { injected } from "@wagmi/core";
import { WagmiProvider, createConfig, http } from "wagmi";
import { AuditModeProvider } from "@/components/AuditMode";
import { botChainTestnet } from "@/lib/chain";

const config = createConfig({
  chains: [botChainTestnet],
  connectors: [injected()],
  transports: {
    [botChainTestnet.id]: http(botChainTestnet.rpcUrls.default.http[0]),
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
