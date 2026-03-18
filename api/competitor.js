export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category, orgs } = req.query;

  const ORG_DEFAULTS = {
    large_academy: ["그린컴퓨터아카데미","더조은컴퓨터아카데미","KH정보교육원","SBS아카데미","메가스터디IT","이젠아카데미","비트캠프","쌍용교육센터"],
    univ_poly:     ["한국폴리텍","SSAFY","멀티캠퍼스","삼성청년SW아카데미"],
    edutech:       ["패스트캠퍼스","코드스테이츠","팀스파르타","제로베이스","항해99","부스트캠프"],
  };

  const orgList = orgs
    ? orgs.split(",").map(o => o.trim()).filter(Boolean)
    : (ORG_DEFAULTS[category] || ORG_DEFAULTS.large_academy);

  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const allItems = [];

  // 기관명 하나씩 검색 (최대 4개)
  for (const org of orgList.slice(0, 4)) {
    try {
      const url = `https://openapi.naver.com/v1/search/news.json`
        + `?query=${encodeURIComponent(org)}`
        + `&display=10`
        + `&sort=date`;

      const response = await fetch(url, {
        headers: {
          "X-Naver-Client-Id":     process.env.NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
        },
      });

      if (!response.ok) continue;
      const data = await response.json();

      const items = (data.items || []).filter(item => {
        try {
          const pub = new Date(item.pubDate);
          return !isNaN(pub) && pub >= start && pub <= now;
        } catch { return false; }
      });

      // 7일 내 없으면 최신 2건 추가
      const toAdd = items.length > 0 ? items.slice(0, 3) : (data.items || []).slice(0, 2);
      toAdd.forEach(item => {
        item._orgName = org; // 어느 기관 검색 결과인지 태깅
        allItems.push(item);
      });

    } catch(e) {
      console.error(`검색 오류 (${org}):`, e.message);
    }
  }

  // 날짜순 정렬
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  res.status(200).json(allItems.slice(0, 10));
}
