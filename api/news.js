export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords } = req.query;
  if (!keywords) return res.status(400).json({ error: "keywords 필요" });

  const query = keywords.split(",").slice(0,4).join(" ");

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=10&sort=date`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
    });

    const data = await response.json();
    res.status(200).json(data.items || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
