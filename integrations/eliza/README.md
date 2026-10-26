# @trnch/plugin-trnch

ElizaOS plugin to trade new Robinhood Chain tokens through [TRNCH](https://trnch.fun).

- **The Heat**: new tokens ranked live a few seconds after their pool is created.
- **TIA**: screens every launch first. Rugs, honeypots, scam contracts, heavy sell taxes and copycats are kept out, and TRNCH refuses to trade them.
- **Best route**: each swap is quoted across six routers (KyberSwap, LI.FI, Uniswap, 0x, SushiSwap, 1inch).
- **Non-custodial**: every transaction is sent by the agent's own wallet. 0.5% fee per swap, already deducted from the quotes.

## Install

```bash
elizaos plugins add github:isonips/plugin-trnch
```

Character file:

```json
{ "plugins": ["@trnch/plugin-trnch"] }
```

## Settings

| Setting | Required | |
|---|---|---|
| `TRNCH_PRIVATE_KEY` | yes (or `EVM_PRIVATE_KEY`) | The agent's own trading wallet on Robinhood Chain. Use a dedicated wallet. |
| `TRNCH_API_KEY` | no | Created on first use by signing a message with the wallet (no funds move). |
| `TRNCH_RPC_URL` | no | Robinhood Chain RPC. |
| `TRNCH_REF` | no | Your TRNCH referral code. Shipping an agent to others? Every swap made with a key it creates pays you 25% of the TRNCH fee, for life. |

The wallet needs 10 USDG or 0.004 ETH on Robinhood Chain to get a key, plus USDG to buy and a little ETH for gas.

## Actions

| Action | |
|---|---|
| `TRNCH_STATS` | Live numbers for the last 24 hours: tokens spotted, kept out, rugs detected, median detection delay. |
| `TRNCH_HEAT` | The live feed of screened launches, each token as an id. |
| `TRNCH_BUY` | "buy $25 of `<id or address>`": best of six routers, paid in USDG. |
| `TRNCH_SELL` | "sell 50% of `<id or address>`" (default 100%), for USDG. |

The `TRNCH_HEAT` provider puts the top 10 of the Heat, with ids, in the agent's context.

Also available as an MCP server: https://github.com/isonips/trnch-mcp. Docs: https://trnch.fun/bot
