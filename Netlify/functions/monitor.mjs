// Runs every 5 minutes. Alert rules (tunable in lib/shared.mjs):
//   EXCHANGE   -> any trusted-asset transfer to/from a tagged exchange over EXCHANGE_MIN_USD
//   LARGE OUT  -> outflow above the wallet's threshold (default $10,000)
//   INTERNAL / BALANCE DROP -> logged to the dashboard feed only (not Telegram)
// Only alert types listed in TELEGRAM_ALERT_TYPES are pushed to Telegram.
import { getStore } from "@netlify/blobs";
import {
  WALLETS, etherscanTxs, getBalances, sendTelegram, json,
  isExchange, isWatched, nameOf,
  TELEGRAM_ALERT_TYPES, DEFAULT_THRESHOLD, EXCHANGE_MIN_USD, TRUSTED_SYMBOLS,
} from "../../lib/shared.mjs";

const BNB_USD_APPROX = 600; // rough conversion for thresholding only

export default async () => {
  const apiKey = process.env.ETHERSCAN_KEY;
  const defaultThreshold = Number(process.env.ALERT_THRESHOLD_USDT || DEFAULT_THRESHOLD);
  const store = getStore("tracker");
  const state = (await store.get("state", { type: "json" })) || { lastBlock: {}, balances: {}, seen: [] };
  const alertLog = (await store.get("alerts", { type: "json" })) || [];
  const newAlerts = [];
  const seen = new Set(state.seen || []);

  const usdValue = (t) => {
    if (!TRUSTED_SYMBOLS.includes(t.symbol)) return null; // untrusted asset -> no value-based alerting
    return t.symbol === "BNB" || t.symbol === "WBNB" ? t.value * BNB_USD_APPROX : t.value;
  };

  for (const w of WALLETS.filter((x) => !x.isContract)) {
    const threshold = w.threshold ?? defaultThreshold;

    // ---- balance drop (dashboard feed only)
    try {
      const bal = await getBalances(w.address);
      const prev = state.balances[w.address];
      if (prev && prev.usdt - bal.usdt >= threshold) {
        newAlerts.push({
          type: "BALANCE DROP", time: Date.now(),
          text: `${w.name}: USDT fell ${(prev.usdt - bal.usdt).toFixed(0)} (${prev.usdt.toFixed(0)} → ${bal.usdt.toFixed(0)})`,
        });
      }
      state.balances[w.address] = bal;
    } catch {}

    // ---- new transactions
    if (!apiKey) continue;
    try {
      const startBlock = (state.lastBlock[w.address] || 0) + 1;
      const txs = await etherscanTxs(w.address, apiKey, startBlock);
      let maxBlock = state.lastBlock[w.address] || 0;
      for (const t of txs) {
        if (t.block > maxBlock) maxBlock = t.block;
        const key = t.hash + t.symbol + t.value;
        if (seen.has(key)) continue;
        seen.add(key);

        const usd = usdValue(t);
        if (usd === null) continue; // ignore spam/unknown tokens entirely

        const out = t.from?.toLowerCase() === w.address.toLowerCase();
        const exch = isExchange(t.to) || isExchange(t.from);
        const internal = isWatched(t.from) && isWatched(t.to);
        const amt = `${t.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t.symbol}`;

        if (exch && usd >= EXCHANGE_MIN_USD) {
          newAlerts.push({ type: "EXCHANGE", time: t.time, hash: t.hash, text: `${w.name} ${out ? "sent" : "received"} ${amt} ${out ? "to" : "from"} ${nameOf(out ? t.to : t.from)}` });
        } else if (out && usd >= threshold) {
          newAlerts.push({ type: "LARGE OUT", time: t.time, hash: t.hash, text: `${w.name} sent ${amt} → ${nameOf(t.to)}` });
        } else if (internal && usd >= threshold) {
          newAlerts.push({ type: "INTERNAL", time: t.time, hash: t.hash, text: `Internal flow: ${nameOf(t.from)} → ${nameOf(t.to)} (${amt})` });
        }
      }
      state.lastBlock[w.address] = maxBlock;
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.log("scan failed for", w.name, e.message);
    }
  }

  // ---- persist all alerts to the dashboard feed
  state.seen = [...seen].slice(-2000);
  await store.setJSON("state", state);
  if (newAlerts.length) {
    await store.setJSON("alerts", [...newAlerts, ...alertLog].slice(0, 200));
  }

  // ---- Telegram: only the types you opted into
  const toSend = newAlerts.filter((a) => TELEGRAM_ALERT_TYPES.includes(a.type));
  if (toSend.length) {
    const icon = { "EXCHANGE": "🚨", "LARGE OUT": "⚠️" };
    const msg =
      `<b>AURUM/NEYRO Tracker — ${toSend.length} alert${toSend.length > 1 ? "s" : ""}</b>\n\n` +
      toSend.slice(0, 10).map((a) =>
        `${icon[a.type] || "•"} <b>${a.type}</b>\n${a.text}` +
        (a.hash ? `\n<a href="https://bscscan.com/tx/${a.hash}">view tx</a>` : "")
      ).join("\n\n") +
      (toSend.length > 10 ? `\n\n…and ${toSend.length - 10} more on the dashboard.` : "");
    await sendTelegram(msg);
  }

  return json({ ok: true, logged: newAlerts.length, sentToTelegram: toSend.length });
};

export const config = { schedule: "*/5 * * * *" };
