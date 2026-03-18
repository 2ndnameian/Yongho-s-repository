export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query;

  // 카테고리별 키워드 필터
  const CATEGORY_KEYWORDS = {
    vocational_policy: ["직업훈련","직업능력","KDT","KDC","훈련기관","훈련과정","국비훈련","직업교육","능력개발"],
    talent_policy:     ["인재양성","AI","디지털","SW","소프트웨어","콘텐츠","인력양성","인재","역량"],
    edu_policy:        ["교육","평생교육","대학","학습","연수","교육과정","직업교육"],
    project_open:      ["공고","모집","선정","접수","신청","공모","위탁","지원사업","사업자"],
    industry_policy:   ["산업","디지털전환","신산업","스마트","제조","기업지원","창업","취업"],
  };

  // 전체 RSS 피드 목록 (모든 카테고리 공통)
  const ALL_FEEDS = [
    { url:"https://www.moel.go.kr/rss/notice.do",          org:"고용노동부",       type:"공고" },
    { url:"https://www.moel.go.kr/rss/lawinfo.do",         org:"고용노동부",       type:"입법예고" },
    { url:"https://www.korea.kr/rss/dept_moe.xml",         org:"교육부",           type:"보도자료" },
    { url:"https://www.korea.kr/rss/dept_msit.xml",        org:"과학기술정보통신부", type:"보도자료" },
    { url:"https://www.korea.kr/rss/dept_mcst.xml",        org:"문화체육관광부",    type:"보도자료" },
    { url:"https://www.korea.kr/rss/dept_mss.xml",         org:"중소벤처기업부",    type:"보도자료" },
    { url:"https://www.korea.kr/rss/dept_mogef.xml",       org:"여성가족부",        type:"보도자료" },
  ];

  const filterKws = CATEGORY_KEYWORDS[category] || [];
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const results = [];

  function parseDate(str) {
    if (!str) return null;
    const kr = str.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (kr) return new Date(`${kr[1]}-${kr[2]}-${kr[3]}`);
    try { const d = new Date(str); if (!isNaN(d)) return d; } catch {}
    return null;
  }

  function formatDate(d) {
    if (!d || isNaN(d)) return "";
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
  }

  for (const feed of ALL_FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent":"Mozilla/5.0 (compatible; PolicyBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const xml = await response.text();

      const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 20)) {
        const title  = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                        item.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";
        const link   = (item.match(/<link>([\s\S]*?)<\/link>/) ||
                        item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() || "";
        const desc   = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                        item.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || "";
        const pubRaw = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                        item.match(/<dc:date>([\s\S]*?)<\/dc:date>/))?.[1]?.trim() || "";

        if (!title) continue;

        const cleanTitle = title.replace(/<[^>]+>/g,"").trim();
        const cleanDesc  = desc.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
        const pub = parseDate(pubRaw);

        // 7일 필터 (날짜 없으면 포함)
        if (pub && (pub < start || pub > now)) continue;

        // 카테고리 키워드 필터
        if (filterKws.length > 0) {
          const matched = filterKws.some(kw =>
            cleanTitle.includes(kw) || cleanDesc.includes(kw)
          );
          if (!matched) continue;
        }

        results.push({
          title:         cleanTitle,
          description:   cleanDesc.slice(0, 150),
          link,
          originallink:  link,
          pubDate:       pub ? pub.toUTCString() : "",
          formattedDate: formatDate(pub),
          org:           feed.org,
          type:          feed.type,
        });
      }
    } catch(e) {
      console.error(`RSS error (${feed.org}):`, e.message);
    }
  }

  // 날짜순 정렬
  results.sort((a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
  res.status(200).json(results.slice(0, 12));
}
