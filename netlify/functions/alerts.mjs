import { getStore } from "@netlify/blobs";
import { json, sendTelegram, WALLETS, EXCHANGES } from "../../lib/shared.mjs";

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("test") === "telegram") {
    const r = await sendTelegram("✅ AURUM/NEYRO tracker connected. Alerts will arrive here.");
    return json(r);
  }
  if (url.searchParams.get("config") === "1") {
    return json({ wallets: WALLETS, exchanges: EXCHANGES });
  }
  const store = getStore("tracker");
  const alerts = (await store.get("alerts", { type: "json" })) || [];
  return json(alerts);
};
