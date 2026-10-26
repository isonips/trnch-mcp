import { trnchActionProvider } from "./trnchActionProvider";
import { TrnchBuySchema, TrnchSellSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

global.fetch = jest.fn();

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("Trnch schemas", () => {
  it("accepts a buy by tokenId and defaults slippage", () => {
    const r = TrnchBuySchema.safeParse({ tokenId: "abc", token: null, amountUsd: 25, slippageBps: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slippageBps).toBe(100);
  });

  it("refuses a buy without tokenId or token", () => {
    expect(TrnchBuySchema.safeParse({ tokenId: null, token: null, amountUsd: 25, slippageBps: null }).success).toBe(false);
  });

  it("refuses a sell above 100 percent", () => {
    expect(TrnchSellSchema.safeParse({ tokenId: "abc", token: null, percent: 150, slippageBps: null }).success).toBe(false);
  });
});

describe("TrnchActionProvider", () => {
  const provider = trnchActionProvider({ apiKey: "trnch_bot_test" });
  let wallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    jest.resetAllMocks();
    wallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
      signMessage: jest.fn(),
      sendTransaction: jest.fn().mockResolvedValueOnce("0xapprove").mockResolvedValueOnce("0xswap"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: "success" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  it("supports Robinhood Chain only", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "4663" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(false);
  });

  it("sends the approval then the swap, and reports the hash", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        ok({ router: "kyberswap", approval: { to: "0xaa", data: "0x01" }, tx: { to: "0xbb", data: "0x02", value: "0" } }),
      )
      .mockResolvedValueOnce(ok({ ok: true }));

    const result = JSON.parse(
      await provider.buy(wallet, { tokenId: "abc", token: null, amountUsd: 25, slippageBps: 100 }),
    );

    expect(result).toEqual({ success: true, txHash: "0xswap", router: "kyberswap" });
    expect(wallet.sendTransaction).toHaveBeenNthCalledWith(1, { to: "0xaa", data: "0x01" });
    expect(wallet.sendTransaction).toHaveBeenNthCalledWith(2, { to: "0xbb", data: "0x02", value: BigInt(0) });
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe("https://trnch.fun/api/bot/v1/confirm");
  });

  it("returns the API error without sending anything", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ error: "token not tradable through TRNCH" }),
    });

    const result = JSON.parse(await provider.sell(wallet, { tokenId: "abc", token: null, percent: 100, slippageBps: 100 }));

    expect(result.success).toBe(false);
    expect(result.error).toContain("token not tradable through TRNCH");
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
});
