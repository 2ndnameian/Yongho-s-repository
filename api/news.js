import { searchNewsAll, hasNaverKeys } from "./_lib/naver.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords, format } = req.query;
  if (!keywords) return res.status(400).json({ error: "keywords 필요" });

  // 키워드를 공백으로 이어 붙이면 네이버가 AND 검색으로 처리해 최근 기사가 거의 걸리지 않는다.
  // (실측 2026-09-23: 4개 결합 질의는 7일 내 0건, 단일 키워드는 각 20건)
  // 키워드마다 따로 질의한 뒤 합치는 방식으로 수집한다.
  const list = keywords.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (list.length === 0) return res.status(400).json({ error: "keywords 필요" });

  if (!hasNaverKeys()) {
    const err = { error: "NAVER_CLIENT_ID/SECRET 미설정" };
    return res.status(500).json(format === "full" ? { items: [], errors: [err] } : []);
  }

  const now = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const decodeEntities = (s) => (s || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  const titleKey = (s) => decodeEntities(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .slice(0, 30);

  try {
    const { results, errors } = await searchNewsAll(list, { display: 20 });

    const seenLink = new Set();
    const seenTitle = new Set();
    const merged = [];

    for (const { keyword, items } of results) {
      for (const item of items) {
        const pub = new Date(item.pubDate);
        if (isNaN(pub) || pub < start || pub > now) continue;

        const link = (item.originallink || item.link || "").trim();
        const tkey = titleKey(item.title);
        if (link && seenLink.has(link)) continue;
        if (tkey && seenTitle.has(tkey)) continue;
        if (link) seenLink.add(link);
        if (tkey) seenTitle.add(tkey);

        merged.push({
          ...item,
          title: decodeEntities(item.title),
          description: decodeEntities(item.description),
          keyword,
        });
      }
    }

    merged.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const top = merged.slice(0, 40);

    // 기존 호출부(news.html 등)는 배열을 그대로 기대하므로 format=full일 때만 래핑해서 준다.
    if (format === "full") return res.status(200).json({ items: top, errors });
    res.status(200).json(top);
  } catch (e) {
    if (format === "full") return res.status(500).json({ items: [], errors: [{ error: e.message }] });
    res.status(500).json({ error: e.message });
  }
}
