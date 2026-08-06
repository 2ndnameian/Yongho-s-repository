import { put } from "@vercel/blob";
import { appendLog } from "./_lib/log.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const data = req.body;
    if (!data || !data.source) {
      return res.status(400).json({ error: "source 필드가 필요합니다" });
    }

    const source = data.source;
    const collectedAt = data.collectedAt || new Date().toISOString();
    const date = collectedAt.slice(0, 10); // YYYY-MM-DD
    const json = JSON.stringify(data, null, 2);

    const [dated, latest] = await Promise.all([
      put(`snapshots/${source}/${date}.json`, json, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }),
      put(`snapshots/${source}/latest.json`, json, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }),
    ]);

    const itemCount = data.totalCount ?? (data.groups || data.orgs || []).flatMap(g => g.items || []).length;
    await appendLog({ source, trigger: data.trigger === "auto" ? "auto" : "manual", itemCount, ok: true });

    res.status(200).json({ ok: true, source, date, url: dated.url, latestUrl: latest.url });
  } catch (e) {
    await appendLog({ source: req.body?.source || "unknown", trigger: req.body?.trigger === "auto" ? "auto" : "manual", ok: false, error: e.message }).catch(() => {});
    res.status(500).json({ error: e.message });
  }
}
