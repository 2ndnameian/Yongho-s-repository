export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query;

  // 카테고리별 RSS 피드 주소 매핑
  const RSS_FEEDS = {
    vocational_policy: [
      { url:"https://www.moel.go.kr/rss/notice.do",   org:"고용노동부", type:"공고" },
      { url:"https://www.moel.go.kr/rss/lawinfo.do",  org:"고용노동부", type:"입법예고" },
    ],
    talent_policy: [
      { url:"https://www.msit.go.kr/bbs/rssList.do?sCode=user&mId=113&mPid=112&bbsSeqNo=94", org:"과기정통부", type:"보도자료" },
      { url:"https://www.korea.kr/rss/policy.do", org:"정책브리핑", type:"정책" },
    ],
    edu_policy: [
      { url:"https://www.moe.go.kr/boardCnts/getRss.do?boardID=294&m=0503", org:"교육부", type:"보도자료" },
      { url:"https://www.korea.kr/rss/policy.do", org:"정책브리핑", type:"정책" },
    ],
    project_open: [
      { url:"https://www.moel.go.kr/rss/notice.do",  org:"고용노동부", type:"공고" },
      { url:"https://www.mss.go.kr/site/smba/rss/bizNotice.do", org:"중소벤처기업부", type:"사업공고" },
    ],
    industry_policy: [
      { url:"https://www.msit.go.kr/bbs/rssList.do?sCode=user&mId=113&mPid=112&bbsSeqNo=94", org:"과기정통부", type:"보도자료" },
      { url:"https://www.mss.go.kr/site/smba/rss/bizNotice.do", org:"중소벤처기업부", type:"사업공고" },
    ],
  };

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.vocational_policy;
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const results = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PolicyBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const xml = await response.text();

      // XML 파싱 (간단한 정규식 방식)
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const item of items.slice(0, 10)) {
        const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || "";
        const link    = (item.match(/<link>(.*?)<\/link>/) || item.match(/<guid>(.*?)<\/guid>/))?.[1]?.trim() || "";
        const desc    = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1]?.trim() || "";
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || "";

        if (!title) continue;

        // 7일 필터
        let pub = null;
        try { pub = new Date(pubDate); } catch {}
        if (pub && (pub < start || pub > now)) continue;

        results.push({
          title:       title.replace(/<[^>]+>/g, ""),
          description: desc.replace(/<[^>]+>/g, "").slice(0, 150),
          link,
          originallink: link,
          pubDate:     pub ? pub.toUTCString() : pubDate,
          org:         feed.org,
          type:        feed.type,
        });
      }
    } catch(e) {
      console.error(`RSS fetch error (${feed.org}):`, e.message);
      continue;
    }
  }

  // 날짜순 정렬
  results.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  res.status(200).json(results.slice(0, 10));
}
