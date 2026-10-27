import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
const files = {
  testnet: "contracts/deployments/bot-testnet.json",
  mainnet: "contracts/deployments/bot-mainnet.json",
};

if (target !== "testnet" && target !== "mainnet") {
  console.error("Usage: node scripts/use-deployment.mjs testnet|mainnet");
  process.exit(1);
}

let deployment;
try {
  deployment = JSON.parse(readFileSync(files[target], "utf8"));
} catch {
  console.error(`No deployment file at ${files[target]}. Deploy that network first.`);
  process.exit(1);
}

if (!/^0x[a-fA-F0-9]{40}$/.test(deployment.contract ?? "")) {
  console.error(`${files[target]} does not contain a contract address.`);
  process.exit(1);
}

writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_BOT_NETWORK=${target}\nNEXT_PUBLIC_VOTE_ON_ACTION_ADDRESS=${deployment.contract}\n`,
);

console.log(`App pointed at ${target} ${deployment.contract}`);
console.log("Restart the Next.js dev server so it reloads .env.local.");
