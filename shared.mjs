// ---------------------------------------------------------------
// Single source of truth: edit your watchlist HERE.
// isContract:true wallets are shown on the dashboard but skipped
// by the tx scanner (their transfer lists are other users' activity).
// ---------------------------------------------------------------
// ---------------- ALERT TUNING ----------------
// Types sent to Telegram. Everything is still logged to the dashboard feed;
// this only controls what pings your phone.
export const TELEGRAM_ALERT_TYPES = ["EXCHANGE", "LARGE OUT"];
// Default USDT threshold for LARGE OUT (override per wallet below or via env).
export const DEFAULT_THRESHOLD = 2000;
// Exchange transfers alert at any size above this dust floor:
export const EXCHANGE_MIN_USD = 50;
// Only these assets trigger value-based alerts (spam/scam airdrop tokens report
// fake values and would otherwise flood you):
export const TRUSTED_SYMBOLS = ["USDT", "BSC-USD", "BNB", "WBNB", "USDC", "BUSD"];
// -----------------------------------------------

export const WALLETS = [
  { name: "NEYRO_OPERATOR_ADDRESS", label: "Trading Bot", address: "0x8b45cda448cc26e7f55ef3e77374c7cae8199b61", threshold: 500 },
  { name: "NEYRO PROJECT", label: "", address: "0xe197f1229f7625d74780f1f6be2b9552566fa1e0" },
  { name: "AURUM LP Creator wallet", label: "Wallet to Watch", address: "0xa7551aBe0A066555cb5d859849426fB55543Ca25" },
  { name: "Binance-Peg USDT contract (ref only)", label: "Contract", address: "0x55d398326f99059fF775485246999027B3197955", isContract: true },
  { name: "NEYRO Profit Deposit Wallet", label: "", address: "0x02ee5d9a5f0cc02c0a97a17c929d93c043805d9c", threshold: 500 },
  { name: "NEYRO Profit Withdrawal Wallet", label: "", address: "0x2aDae2616fAC77b5C600F48099cE141a4a6CE86c", threshold: 500 },
  { name: "DEPOSIT to NEYRO Wallet 0x…2B51", label: "Wallet to Watch", address: "0x76aAA5D887608377B3cd28B33FA9378D6FB62B51" },
  { name: "AURUM LP", label: "Contract", address: "0x92b7807bF19b7DDdf89b706143896d05228f3121", isContract: true },
];

// Known exchange hot wallets (reused across EVM chains). Add more as you find them.
export const EXCHANGES = [
  { name: "Binance (main)", address: "0xF977814e90dA44bFA03b6295A0616a897441aceC" },
  { name: "Binance Hot 6", address: "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3" },
  { name: "Binance Hot 7", address: "0xe2fc31F816A9b94326492132018C3aEcC4a93aE1" },
  { name: "Binance Hot 8", address: "0x3c783c21a0383057D128bae431894a5C19F9Cf06" },
  { name: "Binance Hot 9", address: "0xdccF3B77dA55107280bd850ea519DF3705D1a75a" },
  { name: "Binance Hot 10", address: "0x515b72Ed8a97F42C568D6A143232775018f133C8" },
];

export const EX_REGEX = /binance|okx|bybit|kucoin|gate\.?io|mexc|htx|huobi|kraken|coinbase|bitget|crypto\.com|exchange|hot wallet/i;
export const USDT = "0x55d398326f99059fF775485246999027B3197955";
export const RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
];

export const short = (a) => (a ? String(a).slice(0, 6) + "…" + String(a).slice(-4) : "");
export const nameOf = (a) => {
  const low = String(a || "").toLowerCase();
  return (
    WALLETS.find((w) => w.address.toLowerCase() === low)?.name ||
    EXCHANGES.find((e) => e.address.toLowerCase() === low)?.name ||
    short(a)
  );
};
export const isExchange = (a) =>
  EXCHANGES.some((e) => e.address.toLowerCase() === String(a || "").toLowerCase());
export const isWatched = (a) =>
  WALLETS.some((w) => w.address.toLowerCase() === String(a || "").toLowerCase());

export async function rpc(method, params) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("All RPCs failed");
}

export const hexToFloat = (hex, d = 18) =>
  !hex || hex === "0x" ? 0 : Number(BigInt(hex)) / 10 ** d;

export async function getBalances(address) {
  const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");
  const [bal, usdtHex] = await Promise.all([
    rpc("eth_getBalance", [address, "latest"]),
    address.toLowerCase() === USDT.toLowerCase()
      ? Promise.resolve("0x0")
      : rpc("eth_call", [{ to: USDT, data: "0x70a08231" + padded }, "latest"]).catch(() => "0x0"),
  ]);
  return { bnb: hexToFloat(bal), usdt: hexToFloat(usdtHex) };
}

// Etherscan V2, BSC = chainid 56
export async function etherscanTxs(address, apiKey, startBlock = 0) {
  const base = `https://api.etherscan.io/v2/api?chainid=56&module=account&address=${address}&startblock=${startBlock}&sort=desc&page=1&offset=50&apikey=${apiKey}`;
  const [txRes, tokRes] = await Promise.all([
    fetch(base + "&action=txlist").then((r) => r.json()),
    fetch(base + "&action=tokentx").then((r) => r.json()),
  ]);
  const norm = (t, isToken) => ({
    hash: t.hash, from: t.from, to: t.to,
    block: Number(t.blockNumber),
    time: Number(t.timeStamp) * 1000,
    value: isToken ? Number(t.value) / 10 ** Number(t.tokenDecimal || 18) : Number(t.value) / 1e18,
    symbol: isToken ? t.tokenSymbol : "BNB",
  });
  const a = Array.isArray(txRes.result) ? txRes.result.map((t) => norm(t, false)) : [];
  const b = Array.isArray(tokRes.result) ? tokRes.result.map((t) => norm(t, true)) : [];
  return [...a, ...b].sort((x, y) => y.time - x.time);
}

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" };
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return r.json();
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
