import { defineChain } from "viem";

const networks = {
  mainnet: {
    id: 677,
    name: "BOT Chain",
    label: "Mainnet",
    rpc: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
  },
  testnet: {
    id: 968,
    name: "BOT Chain Testnet",
    label: "Testnet",
    rpc: "https://rpc.bohr.life",
    explorer: "https://scan.bohr.life",
  },
} as const;

const selected = process.env.NEXT_PUBLIC_BOT_NETWORK === "testnet" ? networks.testnet : networks.mainnet;

export const botNetwork = process.env.NEXT_PUBLIC_BOT_NETWORK === "testnet" ? "testnet" : "mainnet";
export const networkLabel = selected.label;

export const botChain = defineChain({
  id: selected.id,
  name: selected.name,
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [selected.rpc] },
  },
  blockExplorers: {
    default: {
      name: "BOTScan",
      url: selected.explorer,
    },
  },
});

export const explorerUrl = selected.explorer;
export const rpcUrl = selected.rpc;

export const botTransportUrls = {
  677: networks.mainnet.rpc,
  968: networks.testnet.rpc,
} as const;
