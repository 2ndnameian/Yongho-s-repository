export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query;

  // 확인된 RSS 피드만 사용
  const RSS_FEEDS = {
    vocational_policy: [
      { url:"https://www.moel.go.kr/rss/notice.do",  org:"고용노동부", type:"공고" },
      { url:"https://www.moel.go.kr/rss/lawinfo.do", org:"고용노동부", type:"입법예고" },
    ],
    talent_policy: [
      { url:"https://www.moel.go.kr/rss/notice.do",  org:"고용노동부", type:"공고" },
      { url:"https://www.korea.kr/rss/pressRelease.do", org:"정책브리핑", type:"보도자료" },
    ],
    edu_policy: [
      { url:"https://www.korea.kr/rss/pressRelease.do", org:"정책브리핑", type:"보도자료" },
      { url:"https://www.moel.go.kr/rss/notice.do",     org:"고용노동부", type:"공고" },
    ],
    project_open: [
      { url:"https://www.moel.go.kr/rss/notice.do",  org:"고용노동부", type:"공고" },
      { url:"https://www.moel.go.kr/rss/lawinfo.do", org:"고용노동부", type:"입법예고" },
    ],
    industry_policy: [
      { url:"https://www.korea.kr/rss/pressRelease.do", org:"정책브리핑", type:"보도자료" },
      { url:"https://www.moel.go.kr/rss/notice.do",     org:"고용노동부", type:"공고" },
    ],
  };

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.vocational_policy;
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const results = [];

  // 날짜 파싱 함수 (다양한 형식 처리)
  function parseDate(str) {
    if (!str) return null;
    // 한국식 날짜 (2026-03-18, 2026.03.18)
    const krMatch = str.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (krMatch) return new Date(`${krMatch[1]}-${krMatch[2]}-${krMatch[3]}`);
    // RFC 2822 (Mon, 18 Mar 2026 09:00:00 +0900)
    try { const d = new Date(str); if (!isNaN(d)) return d; } catch {}
    return null;
  }

  // 날짜 포맷 함수
  function formatDate(d) {
    if (!d || isNaN(d)) return "";
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
  }

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PolicyBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const xml = await response.text();

      const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 15)) {
        const title   = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                         item.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";
        const link    = (item.match(/<link>([\s\S]*?)<\/link>/) ||
                         item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() || "";
        const desc    = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                         item.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || "";
        const pubRaw  = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                         item.match(/<dc:date>([\s\S]*?)<\/dc:date>/))?.[1]?.trim() || "";

        if (!title) continue;

        const pub = parseDate(pubRaw);

        // 7일 필터 (날짜 파싱 실패 시 포함)
        if (pub && (pub < start || pub > now)) continue;

        results.push({
          title:        title.replace(/<[^>]+>/g, "").trim(),
          description:  desc.replace(/<[^>]+>/g, "").replace(/\s+/g," ").trim().slice(0, 150),
          link,
          originallink: link,
          pubDate:      pub ? pub.toUTCString() : "",
          formattedDate: formatDate(pub),
          org:          feed.org,
          type:         feed.type,
        });
      }
    } catch(e) {
      console.error(`RSS fetch error (${feed.org}):`, e.message);
      continue;
    }
  }

  // 날짜순 정렬
  results.sort((a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
  res.status(200).json(results.slice(0, 12));
}
