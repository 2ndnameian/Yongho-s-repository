export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query;

  // 카테고리별 검색 키워드
  const CATEGORY_KEYWORDS = {
    org_large:     ["대형 직업훈련기관","직업훈련기관 신규","훈련기관 확장","훈련기관 협약","직업훈련 과정 개설"],
    org_univ:      ["대학 산학협력단","산학협력 훈련","대학 직업훈련","대학 부트캠프","대학 디지털 교육"],
    org_edutech:   ["에듀테크","교육 플랫폼","온라인 훈련","AI 교육 플랫폼","디지털 교육 기업"],
    org_it:        ["IT 교육기관","코딩 교육","개발자 교육","부트캠프","SW 교육기관"],
    org_special:   ["전문교육기관","자격증 교육","직무교육","전문 훈련기관","기술교육"],
    trend_course:  ["훈련과정 개설","신규 과정","교육과정 신설","훈련 프로그램 출시"],
    trend_project: ["공모사업 선정","훈련기관 공모","교육기관 선정","사업 참여"],
    trend_mou:     ["협약 체결","MOU","산학협력","기업 연계","취업 연계"],
    trend_digital: ["AI 훈련","디지털 교육 확대","신기술 교육","클라우드 교육","데이터 교육"],
    field_ai:      ["AI 개발자 교육","인공지능 훈련과정","AI 부트캠프","LLM 교육"],
    field_semi:    ["반도체 교육","반도체 훈련","반도체 인력양성"],
    field_content: ["콘텐츠 제작 교육","게임 개발 교육","디지털 콘텐츠 훈련","영상 교육"],
    field_smart:   ["스마트제조 교육","제조 디지털화 훈련","스마트팩토리 교육"],
  };

  const kwList = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.trend_digital;
  const query  = kwList.slice(0,3).join(" OR ");

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
    const data  = await response.json();

    const items = (data.items || []).filter(item => {
      try {
        const pub = new Date(item.pubDate);
        return pub >= start && pub <= now;
      } catch { return false; }
    });

    // 7일 내 결과 없으면 최신 8건 반환
    const result = items.length > 0 ? items : (data.items || []).slice(0, 8);
    res.status(200).json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
