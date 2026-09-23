import { searchNewsAll, hasNaverKeys } from "./_lib/naver.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category, keywords, format } = req.query;

  const CATEGORY_KEYWORDS = {
    org_large:     ["직업훈련기관 신규과정","훈련기관 확장","훈련기관 협약 2026","직업훈련 과정 개설 2026"],
    org_univ:      ["대학 산학협력단 훈련 2026","산학협력 교육과정","대학 부트캠프 2026"],
    org_edutech:   ["에듀테크 신규 2026","교육 플랫폼 출시","온라인 훈련 확대 2026"],
    org_it:        ["IT 교육기관 신규 2026","코딩 부트캠프 개설","SW 교육 확대 2026"],
    org_special:   ["전문교육기관 과정 2026","직무교육 신규 2026","기술교육 개설"],
    trend_course:  ["훈련과정 개설 2026","신규 교육과정 2026","부트캠프 신규 모집"],
    trend_project: ["공모사업 선정 2026","훈련기관 공모 선정","교육기관 사업 선정 2026"],
    trend_mou:     ["산학협력 협약 2026","MOU 체결 교육","취업연계 협약 2026"],
    trend_digital: ["AI 교육과정 개설 2026","디지털 훈련 확대","신기술 교육 2026"],
    field_ai:      ["AI 개발자 교육 2026","인공지능 훈련과정 신규","AI 부트캠프 2026"],
    field_semi:    ["반도체 교육 2026","반도체 훈련과정 신규","반도체 인력양성 2026"],
    field_content: ["콘텐츠 교육 2026","게임 개발 교육 신규","디지털 콘텐츠 훈련 2026"],
    field_smart:   ["스마트제조 교육 2026","스마트팩토리 훈련 신규","제조 디지털 교육"],
    field_data:    ["데이터 분석 교육 2026","클라우드 교육 신규","빅데이터 훈련 2026"],
    field_security:["정보보안 교육 2026","사이버보안 훈련 신규","보안 교육과정 2026"],
  };

  const kwList = keywords
    ? keywords.split(",").map(k=>k.trim()).filter(Boolean)
    : (CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.trend_digital);

  if (!hasNaverKeys()) {
    const err = { error: "NAVER_CLIENT_ID/SECRET 미설정" };
    return res.status(500).json(format === "full" ? { items: [], errors: [err] } : []);
  }

  const now   = new Date();
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
    // 키워드를 공백으로 이어 붙이면 네이버가 AND로 처리해 최근 기사가 거의 안 걸린다.
    // (실측 2026-09-23: 3개 결합 질의는 7일 내 2건, 개별 질의는 각 19~30건)
    const { results, errors } = await searchNewsAll(kwList.slice(0, 4), { display: 30 });

    const seenLink  = new Set();
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
          title:       decodeEntities(item.title),
          description: decodeEntities(item.description),
          keyword,
        });
      }
    }

    merged.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const top = merged.slice(0, 8);

    // 기존 호출부(market.html, auto-collect)는 배열을 기대하므로 format=full일 때만 래핑한다.
    if (format === "full") return res.status(200).json({ items: top, errors });
    res.status(200).json(top);
  } catch(e) {
    if (format === "full") return res.status(500).json({ items: [], errors: [{ error: e.message }] });
    res.status(500).json({ error: e.message });
  }
}
