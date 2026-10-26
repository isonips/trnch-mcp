# TRNCH MCP server

[![TRNCH MCP connector – tool definition quality and endpoint health on Glama](https://glama.ai/mcp/connectors/fun.trnch/trnch/badges/score.svg)](https://glama.ai/mcp/connectors/fun.trnch/trnch)

Trade new Robinhood Chain tokens from your AI agent, through [TRNCH](https://trnch.fun): a non-custodial trading terminal with a live feed of screened launches.

- **The Heat**: new tokens, ranked live a few seconds after their pool is created.
- **TIA (Trnch Intelligence Agency)**: screens every launch before it reaches the feed. Rugs, honeypots, scam contracts, heavy sell taxes and copycats are kept out, and the API refuses to trade them.
- **Best route**: each swap is quoted across six routers (KyberSwap, LI.FI, Uniswap, 0x, SushiSwap, 1inch). The best return is built as a transaction your wallet signs. TRNCH never holds funds or keys.
- **0.5% fee** per swap, already deducted from the amounts returned.

Live numbers, no key: <https://trnch.fun/api/bot/v1/stats>. It returns tokens spotted, tokens kept out as High risk, rugs detected and the median detection delay, all over the last 24 hours.

## Connect

Remote MCP server, streamable HTTP:

```
https://trnch.fun/api/mcp
```

Claude Desktop, Cursor or any MCP client that supports remote servers:

```json
{
  "mcpServers": {
    "trnch": {
      "url": "https://trnch.fun/api/mcp",
      "headers": { "Authorization": "Bearer trnch_bot_YOUR_KEY" }
    }
  }
}
```

`trnch_stats` and the two `trnch_register` tools work without a key.

Stdio-only client: run the bridge (Node 18+, no dependencies), or `docker build -t trnch-mcp .`

```json
{
  "mcpServers": {
    "trnch": {
      "command": "npx",
      "args": ["-y", "github:isonips/trnch-mcp"],
      "env": { "TRNCH_API_KEY": "trnch_bot_YOUR_KEY" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `trnch_stats` | Public live numbers (no key) |
| `trnch_register_message` | Returns the message your wallet signs to get a key |
| `trnch_register` | Sends the signature and returns the API key (shown once) |
| `trnch_heat` | The live Heat: screened tokens as opaque ids with market numbers, plus newly spotted ones |
| `trnch_quote` | Quotes a swap across six routers |
| `trnch_buy` | Buys a token: `tokenId` (from the Heat) or `token`, and `amountUsd` paid in USDG. Returns the transaction to sign |
| `trnch_sell` | Sells a token for USDG: `percent` of your balance or `amount` |
| `trnch_confirm` | Optional: reports the tx hash so the volume counts for your TRNCH account |

## Get a key (no browser)

1. Call `GET https://trnch.fun/api/bot/v1/register?wallet=0xYourWallet`. It returns `message`.
2. Sign `message` with that wallet using `personal_sign`. No funds move.
3. Call `POST /register` with `{ wallet, message, signature }`. It returns your `trnch_bot_...` key.

The wallet needs 10 USDG or 0.004 ETH on Robinhood Chain (chainId 4663). Up to 3 keys per wallet.

See [`examples/agent.ts`](examples/agent.ts) for a full example: key, Heat, buy, sign.

## Limits

- 60 calls per minute per key, 30 of which can be quotes, buys or sells.
- Building more than 8 swaps without sending any transaction pauses building for that wallet for up to 24 hours.
- A token TRNCH refuses returns `409 token not tradable through TRNCH`.

## Links

- Bot API docs: <https://trnch.fun/bot>
- Agent guide: <https://trnch.fun/skill.md>
- Official MCP registry: `fun.trnch/trnch`
- Terms: <https://docs.trnch.fun/legal/terms>. TRNCH data is licensed for trading through TRNCH only.
