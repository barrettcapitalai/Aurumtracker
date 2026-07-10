import { json } from "../../lib/shared.mjs";

const ALLOWED = ["/profiler/address/transactions", "/profiler/address/counterparties", "/profiler/address/current-balance"];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!process.env.NANSEN_KEY) return json({ error: "NANSEN_KEY not set in Netlify env vars" }, 500);
  const { path, body } = await req.json();
  if (!ALLOWED.includes(path)) return json({ error: "path not allowed" }, 403);
  try {
    const r = await fetch("https://api.nansen.ai/api/v1" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", apiKey: process.env.NANSEN_KEY },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
    return json({ status: r.status, data: j }, r.ok ? 200 : r.status);
  } catch (e) { return json({ error: e.message }, 500); }
};
