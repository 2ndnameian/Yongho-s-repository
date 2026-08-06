import { get } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const result = await get("logs/execution-log.json", { access: "private" });
    if (!result || result.statusCode !== 200) {
      return res.status(200).json([]);
    }
    const entries = await new Response(result.stream).json();
    res.status(200).json(Array.isArray(entries) ? entries.slice().reverse() : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
