export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query;

  // 카테고리별 기관명 검색어
  const CATEGORY_ORGS = {
    large_academy: [
      "그린컴퓨터아카데미","더조은컴퓨터아카데미","KH정보교육원",
      "SBS아카데미","메가스터디IT","이젠아카데미",
      "MBC아카데미","KD아카데미","비트캠프","쌍용교육센터",
      "한국직업전문학교","아이티뱅크","국비닷컴",
    ],
    univ_poly: [
      "한국폴리텍","폴리텍대학","SSAFY","삼성청년SW",
      "삼성AXI","멀티캠퍼스","산학협력단 훈련",
    ],
    edutech: [
      "패스트캠퍼스","코드스테이츠","엘리스","모두의연구소",
      "코드잇","하이테커","팀스파르타","알파코",
      "제로베이스","이노베이션아카데미","항해99","부스트캠프",
      "우아한테크코스","라인아카데미",
    ],
  };

  const orgList = CATEGORY_ORGS[category] || CATEGORY_ORGS.large_academy;

  // 기관명을 3개씩 묶어서 검색 (OR 조건)
  const query = orgList.slice(0, 4).join(" OR ");

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

    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();

    // 7일 필터 엄격 적용
    const filtered = (data.items || []).filter(item => {
      try {
        const pub = new Date(item.pubDate);
        return !isNaN(pub) && pub >= start && pub <= now;
      } catch { return false; }
    });

    res.status(200).json(filtered.slice(0, 8));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
