import type { Action, IAgentRuntime, Memory, Plugin, Provider } from "@elizaos/core";
import { amountUsdOf, executeSwap, percentOf, tokenOf, trnchKey, trnchRequest } from "./client.js";

type HeatToken = { id: string; rank: number; heatScore: number; priceUsd: number; liquidityUsd: number };

const hasWallet = async (runtime: IAgentRuntime) => Boolean(runtime.getSetting("TRNCH_PRIVATE_KEY") ?? runtime.getSetting("EVM_PRIVATE_KEY"));
const textOf = (message: Memory) => message.content.text ?? "";
const fail = (error: unknown) => ({ success: false, error: error instanceof Error ? error : new Error(String(error)) });

const heatLines = (heat: HeatToken[]) =>
  heat
    .slice(0, 10)
    .map((t) => `#${t.rank} id=${t.id} heat=${t.heatScore} price=$${t.priceUsd} liquidity=$${t.liquidityUsd}`)
    .join("\n");

const stats: Action = {
  name: "TRNCH_STATS",
  similes: ["TRNCH_NUMBERS", "RUGS_DETECTED"],
  description: "Get TRNCH live numbers for the last 24 hours on Robinhood Chain: tokens spotted, kept out as High risk by TIA, rugs detected, median detection delay.",
  validate: async () => true,
  handler: async (_runtime, _message, _state, _options, callback) => {
    try {
      const s = await trnchRequest("/stats");
      const text = `Last 24h on Robinhood Chain: ${s.tokensSpotted} tokens spotted, ${s.keptOutHighRisk} kept out as High risk, ${s.rugsDetected} rugs detected, median detection ${s.medianDetectionSeconds}s.`;
      await callback?.({ text, actions: ["TRNCH_STATS"] });
      return { success: true, text, data: s };
    } catch (e) {
      return fail(e);
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "How many rugs did TRNCH catch today?" } },
      { name: "{{agent}}", content: { text: "Checking TRNCH stats.", actions: ["TRNCH_STATS"] } },
    ],
  ],
};

const heat: Action = {
  name: "TRNCH_HEAT",
  similes: ["NEW_TOKENS", "HOT_TOKENS", "ROBINHOOD_CHAIN_LAUNCHES"],
  description: "Get the TRNCH Heat: new Robinhood Chain tokens screened by TIA (rugs, honeypots, scam contracts, heavy sell taxes and copycats kept out), ranked live. Each token has an id for TRNCH_BUY / TRNCH_SELL.",
  validate: hasWallet,
  handler: async (runtime, _message, _state, _options, callback) => {
    try {
      const body = await trnchRequest("/heat", {}, await trnchKey(runtime));
      const text = body.heat?.length ? `TRNCH Heat:\n${heatLines(body.heat)}` : "The Heat is empty right now.";
      await callback?.({ text, actions: ["TRNCH_HEAT"] });
      return { success: true, text, data: body };
    } catch (e) {
      return fail(e);
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "What's hot on Robinhood Chain right now?" } },
      { name: "{{agent}}", content: { text: "Here is the TRNCH Heat.", actions: ["TRNCH_HEAT"] } },
    ],
  ],
};

const buy: Action = {
  name: "TRNCH_BUY",
  similes: ["BUY_TOKEN", "APE", "SWAP_USDG"],
  description: "Buy a Robinhood Chain token through TRNCH with USDG: needs a Heat id or a token address and a dollar amount. Best route across six routers, sent from the agent wallet. Tokens kept out by TIA are refused. 0.5% fee.",
  validate: hasWallet,
  handler: async (runtime, message, _state, _options, callback) => {
    const token = tokenOf(textOf(message));
    const amountUsd = amountUsdOf(textOf(message));
    if (!token || !amountUsd) return fail("Need a token (Heat id or address) and a dollar amount, e.g. buy $25 of <id>");
    try {
      const { hash, router } = await executeSwap(runtime, "/buy", { ...token, amountUsd });
      const text = `Bought $${amountUsd} through TRNCH (${router}). Tx: ${hash}`;
      await callback?.({ text, actions: ["TRNCH_BUY"] });
      return { success: true, text, data: { hash, router } };
    } catch (e) {
      return fail(e);
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "Buy $25 of the top Heat token" } },
      { name: "{{agent}}", content: { text: "Buying $25 through TRNCH.", actions: ["TRNCH_BUY"] } },
    ],
  ],
};

const sell: Action = {
  name: "TRNCH_SELL",
  similes: ["SELL_TOKEN", "TAKE_PROFIT", "EXIT_POSITION"],
  description: "Sell a Robinhood Chain token for USDG through TRNCH: a Heat id or token address and a percent of the balance (default 100%). Best route across six routers, sent from the agent wallet. 0.5% fee.",
  validate: hasWallet,
  handler: async (runtime, message, _state, _options, callback) => {
    const token = tokenOf(textOf(message));
    if (!token) return fail("Need a token (Heat id or address), e.g. sell 50% of <id>");
    const percent = percentOf(textOf(message));
    try {
      const { hash, router } = await executeSwap(runtime, "/sell", { ...token, percent });
      const text = `Sold ${percent}% through TRNCH (${router}). Tx: ${hash}`;
      await callback?.({ text, actions: ["TRNCH_SELL"] });
      return { success: true, text, data: { hash, router } };
    } catch (e) {
      return fail(e);
    }
  },
  examples: [
    [
      { name: "{{user}}", content: { text: "Sell half of 0x1234567890123456789012345678901234567890" } },
      { name: "{{agent}}", content: { text: "Selling 50% through TRNCH.", actions: ["TRNCH_SELL"] } },
    ],
  ],
};

// Puts the top of the Heat in the agent context, so it can pick ids for TRNCH_BUY.
const heatProvider: Provider = {
  name: "TRNCH_HEAT",
  description: "Top 10 screened Robinhood Chain launches from the TRNCH Heat, with their ids",
  dynamic: true,
  get: async (runtime) => {
    try {
      const body = await trnchRequest("/heat", {}, await trnchKey(runtime));
      return { text: body.heat?.length ? `TRNCH Heat (screened by TIA):\n${heatLines(body.heat)}` : "", data: { heat: body.heat ?? [] } };
    } catch {
      return { text: "" };
    }
  },
};

export const trnchPlugin: Plugin = {
  name: "trnch",
  description: "Trade new Robinhood Chain tokens through TRNCH: live feed of launches screened by TIA, best route across six routers, non-custodial.",
  actions: [stats, heat, buy, sell],
  providers: [heatProvider],
};

export default trnchPlugin;
