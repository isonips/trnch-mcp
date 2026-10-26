import type { IAgentRuntime } from "@elizaos/core";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const TRNCH_API = "https://trnch.fun/api/bot/v1";

const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});

type BuiltSwap = {
  router: string;
  approval: { to: Hex; data: Hex } | null;
  tx: { to: Hex; data: Hex; value?: string };
};

const keys = new Map<string, string>();

export async function trnchRequest(path: string, init: RequestInit = {}, key?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const response = await fetch(`${TRNCH_API}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`TRNCH ${path} ${response.status}: ${body.error ?? response.statusText}`);
  return body;
}

// The agent's own trading wallet, set by its operator (TRNCH_PRIVATE_KEY, or EVM_PRIVATE_KEY as in plugin-evm).
function agentWallet(runtime: IAgentRuntime) {
  const pk = (runtime.getSetting("TRNCH_PRIVATE_KEY") ?? runtime.getSetting("EVM_PRIVATE_KEY")) as string | null;
  if (!pk) throw new Error("Set TRNCH_PRIVATE_KEY (or EVM_PRIVATE_KEY) to the agent's trading wallet");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const rpc = (runtime.getSetting("TRNCH_RPC_URL") as string | null) ?? undefined;
  return {
    account,
    wallet: createWalletClient({ account, chain: robinhoodChain, transport: http(rpc) }),
    reader: createPublicClient({ chain: robinhoodChain, transport: http(rpc) }),
  };
}

// TRNCH_API_KEY if set, else a key created once by signing a message with the agent wallet (no funds move).
export async function trnchKey(runtime: IAgentRuntime): Promise<string> {
  const set = runtime.getSetting("TRNCH_API_KEY") as string | null;
  if (set) return set;
  const { account } = agentWallet(runtime);
  const cached = keys.get(account.address);
  if (cached) return cached;
  const { message } = await trnchRequest(`/register?wallet=${account.address}`);
  const signature = await account.signMessage({ message });
  const reg = await trnchRequest("/register", {
    method: "POST",
    body: JSON.stringify({ wallet: account.address, message, signature, label: "eliza" }),
  });
  keys.set(account.address, reg.key);
  return reg.key as string;
}

// Sends the approval (if any) then the swap from the agent wallet, and reports the hash to TRNCH.
export async function executeSwap(runtime: IAgentRuntime, path: "/buy" | "/sell", body: Record<string, unknown>) {
  const key = await trnchKey(runtime);
  const built = (await trnchRequest(path, { method: "POST", body: JSON.stringify(body) }, key)) as BuiltSwap;
  const { wallet, reader } = agentWallet(runtime);
  if (built.approval) {
    const approval = await wallet.sendTransaction({ to: built.approval.to, data: built.approval.data });
    await reader.waitForTransactionReceipt({ hash: approval });
  }
  const hash = await wallet.sendTransaction({ to: built.tx.to, data: built.tx.data, value: BigInt(built.tx.value ?? 0) });
  await reader.waitForTransactionReceipt({ hash });
  await trnchRequest("/confirm", { method: "POST", body: JSON.stringify({ txHash: hash }) }, key).catch(() => undefined);
  return { hash, router: built.router };
}

const TOKEN_ID = /\b[A-Za-z0-9_-]{40,}\b/;
const ADDRESS = /\b0x[a-fA-F0-9]{40}\b/;

// The token named in a message: a Heat id or a contract address.
export function tokenOf(text: string): { tokenId: string } | { token: string } | null {
  const address = text.match(ADDRESS)?.[0];
  if (address) return { token: address };
  const id = text.match(TOKEN_ID)?.[0];
  return id ? { tokenId: id } : null;
}

export const amountUsdOf = (text: string) => {
  const m = text.match(/\$\s?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?(?:\$|usd|usdg|dollars?)/i);
  return m ? Number(m[1] ?? m[2]) : null;
};

export const percentOf = (text: string) => {
  const m = text.match(/(\d+(?:\.\d+)?)\s?%/);
  if (m) return Math.min(100, Number(m[1]));
  return /\bhalf\b/i.test(text) ? 50 : 100;
};
