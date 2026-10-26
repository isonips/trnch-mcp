// Minimal TRNCH agent: get a key by wallet signature, read the Heat, buy the top token for $10.
// Run: PRIVATE_KEY=0x... npx tsx examples/agent.ts  (the wallet needs USDG and a little ETH on Robinhood Chain)
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API = "https://trnch.fun/api/bot/v1";
const chain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain, transport: http() });

async function main() {
  // 1. API key: sign the message (no funds move). Keep the key, it is shown once.
  const { message } = await (await fetch(`${API}/register?wallet=${account.address}`)).json();
  const signature = await account.signMessage({ message });
  const reg = await (await fetch(`${API}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: account.address, message, signature }),
  })).json();
  if (!reg.key) throw new Error(reg.error);
  const auth = { authorization: `Bearer ${reg.key}`, "content-type": "application/json" };

  // 2. The Heat: screened tokens, ranked. Each token is an opaque id.
  const heat = await (await fetch(`${API}/heat`, { headers: auth })).json();
  const top = heat.heat[0];
  if (!top) return console.log("Heat is empty right now");

  // 3. Buy $10 of it: TRNCH quotes six routers and returns the best route, ready to sign.
  const buy = await (await fetch(`${API}/buy`, { method: "POST", headers: auth, body: JSON.stringify({ tokenId: top.id, amountUsd: 10 }) })).json();
  if (buy.error) throw new Error(buy.error);
  if (buy.approval) await wallet.sendTransaction({ to: buy.approval.to, data: buy.approval.data });
  const hash = await wallet.sendTransaction({ to: buy.tx.to, data: buy.tx.data, value: BigInt(buy.tx.value ?? 0) });
  console.log("bought, tx", hash);
}

main().catch((e) => { console.error(e); process.exit(1); });
