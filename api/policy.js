export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keywords, category } = req.query;
  if (!keywords) return res.status(400).json({ error: "keywords 필요" });

  // 기관명을 검색어에 포함해서 정책 문서 위주로 수집
  const GOV_ORGS = [
    "과학기술정보통신부","고용노동부","교육부","문화체육관광부","여성가족부","중소벤처기업부",
    "한국산업인력공단","대한상공회의소","HRD-Net","고용24",
    "지역인적자원개발위원회","서울경제진흥원","경기경제과학진흥원",
    "지방자치단체","산업협회","산업단지","창업지원기관"
  ];

  const kwList  = keywords.split(",").map(k=>k.trim()).filter(Boolean).slice(0,3);
  const orgHint = GOV_ORGS[Math.floor(Math.random() * 6)]; // 다양한 기관 순환
  const query   = [...kwList, "공고 OR 보도자료 OR 정책"].join(" ");

  // 7일 범위
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);

  try {
    const url = `https://openapi.naver.com/v1/search/news.json`
      + `?query=${encodeURIComponent(query)}`
      + `&display=30`
      + `&sort=date`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id":     process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
    });

    const data  = await response.json();
    const items = (data.items || []).filter(item => {
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
