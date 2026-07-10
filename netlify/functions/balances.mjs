import { WALLETS, getBalances, json } from "../../lib/shared.mjs";

export default async () => {
  const out = {};
  await Promise.all(WALLETS.map(async (w) => {
    try { out[w.address] = await getBalances(w.address); }
    catch { out[w.address] = { error: true }; }
  }));
  return json(out);
};
