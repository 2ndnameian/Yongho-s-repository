export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords } = req.query;
  if (!keywords) return res.status(400).json({ error: "keywords 필요" });

  const query = keywords.split(",").slice(0, 4).join(" ");

  // 오늘 기준 7일 전 날짜 계산
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const fmt   = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;

  try {
    const url = `https://openapi.naver.com/v1/search/news.json`
      + `?query=${encodeURIComponent(query)}`
      + `&display=20`
      + `&sort=date`
      + `&start=1`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
    });

    const data = await response.json();
    const items = (data.items || []).filter(item => {
      // pubDate 기준으로 7일 이내 기사만 필터링
      try {
        const pub = new Date(item.pubDate);
        return pub >= start && pub <= now;
      } catch { return false; }
    });

    res.status(200).json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
