import { etherscanTxs, json } from "../../lib/shared.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const address = url.searchParams.get("address") || "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return json({ error: "bad address" }, 400);
  if (!process.env.ETHERSCAN_KEY) return json({ error: "ETHERSCAN_KEY not set in Netlify env vars" }, 500);
  try {
    const txs = await etherscanTxs(address, process.env.ETHERSCAN_KEY);
    return json(txs.slice(0, 40));
  } catch (e) { return json({ error: e.message }, 500); }
};
