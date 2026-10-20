import { defineChain } from "viem";

export const botChainTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.bohr.life"] },
  },
  blockExplorers: {
    default: {
      name: "BOTScan",
      url: "https://scan.bohr.life",
    },
  },
});

export const explorerUrl = "https://scan.bohr.life";
export const faucetUrl = "https://faucet.botchain.ai/basic";
