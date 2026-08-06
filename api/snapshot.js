import { get } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { source, date } = req.query;
  if (!source) return res.status(400).json({ error: "source 필요" });

  const filename = date ? `${date}.json` : "latest.json";
  const pathname = `snapshots/${source}/${filename}`;

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ error: "스냅샷을 찾을 수 없습니다" });
    }

    const response = new Response(result.stream);
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
