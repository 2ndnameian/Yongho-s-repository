export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category, orgs } = req.query;

  // 기관명 목록 (파라미터로 받거나 기본값 사용)
  const ORG_DEFAULTS = {
    large_academy: ["그린컴퓨터아카데미","더조은컴퓨터아카데미","KH정보교육원","SBS아카데미","메가스터디IT","이젠아카데미","비트캠프","쌍용교육센터"],
    univ_poly:     ["한국폴리텍","SSAFY","멀티캠퍼스","삼성청년SW아카데미","삼성AXI"],
    edutech:       ["패스트캠퍼스","코드스테이츠","엘리스","팀스파르타","제로베이스","항해99","부스트캠프","모두의연구소"],
  };

  // 전달된 기관명 사용, 없으면 기본값
  const orgList = orgs
    ? orgs.split(",").map(o => o.trim()).filter(Boolean)
    : (ORG_DEFAULTS[category] || ORG_DEFAULTS.large_academy);

  // 기관명 4개씩 OR 조건으로 검색
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

    // 7일 내 없으면 최신 5건 반환 (기관명은 잘 안 나올 수 있음)
    const result = filtered.length > 0 ? filtered : (data.items || []).slice(0, 5);
    res.status(200).json(result.slice(0, 8));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
