import { searchNewsAll, hasNaverKeys } from "./_lib/naver.js";
import { fetchBizinfo } from "./_lib/bizinfo.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { category, format } = req.query;

  // 카테고리별 키워드 필터 (RSS 항목 선별용)
  const CATEGORY_KEYWORDS = {
    vocational_policy: ["직업훈련","직업능력","KDT","KDC","훈련기관","훈련과정","국비훈련","직업교육","능력개발"],
    talent_policy:     ["인재양성","AI","디지털","SW","소프트웨어","콘텐츠","인력양성","인재","역량"],
    edu_policy:        ["교육","평생교육","대학","학습","연수","교육과정","직업교육"],
    project_open:      ["공고","모집","선정","접수","신청","공모","위탁","지원사업","사업자"],
    industry_policy:   ["산업","디지털전환","신산업","스마트","제조","기업지원","창업","취업"],
  };

  // project_open은 고용노동부 공고 게시판 특성상 채용·인사 공고가 대량으로 섞인다. 제외어로 걸러낸다.
  const CATEGORY_EXCLUDE = {
    project_open: ["채용","임용","임원","합격자","면접","인사발령","정규직","계약직","공무직","인턴",
                   "직원 모집","근로자 모집","경력직","신규직원","응시원서","필기시험","서류전형"],
  };

  // 카테고리별 네이버 뉴스 보강 키워드 (korea.kr 부처 RSS 종료분을 대신한다. 각각 단일 키워드로 질의)
  // project_open은 일부러 비워둔다. 공모사업은 지원 가능한 "공식 공고"가 필요한데
  // 뉴스는 대개 타 기관 선정 결과 보도라 기회로 쓸 수 없고, 키워드 매칭으로도 걸러지지 않는다.
  const CATEGORY_NAVER_KEYWORDS = {
    vocational_policy: ["직업훈련","국비훈련","직업능력개발","훈련기관 평가"],
    talent_policy:     ["인재양성","AI 인재","디지털 인재"],
    edu_policy:        ["평생교육","교육부 정책","직업교육"],
    industry_policy:   ["산업정책","디지털 전환","신산업 육성"],
  };

  // 전체 RSS 피드 목록 (모든 카테고리 공통)
  // korea.kr 부처 피드 5개는 정책브리핑 RSS 서비스 종료(404)로 제거했다. 2026-09-23 실측 확인.
  const ALL_FEEDS = [
    { url:"https://www.moel.go.kr/rss/notice.do",   org:"고용노동부", type:"공고" },
    { url:"https://www.moel.go.kr/rss/lawinfo.do",  org:"고용노동부", type:"입법예고" },
    { url:"https://www.moel.go.kr/rss/policy.do",   org:"고용노동부", type:"정책자료" },
  ];

  const filterKws  = CATEGORY_KEYWORDS[category] || [];
  const excludeKws = CATEGORY_EXCLUDE[category] || [];
  const now   = new Date();
  const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
  // 공식 공고(RSS)를 우선 채우고, 남는 자리만 네이버 뉴스로 메운다.
  // 둘을 섞어 날짜순으로 자르면 최신 뉴스가 공고를 전부 밀어낸다.
  const rssResults = [];
  const naverResults = [];
  const feedErrors = [];

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

  const decodeEntities = (s) => (s || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  function isExcluded(title, desc) {
    if (excludeKws.length === 0) return false;
    const hay = `${title} ${desc}`;
    return excludeKws.some(kw => hay.includes(kw));
  }

  // 카테고리 포함 조건: 주제 키워드 1개 이상
  function matchesCategory(title, desc) {
    const hay = `${title} ${desc}`;
    if (filterKws.length > 0 && !filterKws.some(kw => hay.includes(kw))) return false;
    return true;
  }

  for (const feed of ALL_FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: { "User-Agent":"Mozilla/5.0 (compatible; PolicyBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      // 실패를 조용히 넘기면 피드가 죽어도 아무 데도 흔적이 남지 않는다. 반드시 기록한다.
      if (!response.ok) {
        feedErrors.push({ org: feed.org, url: feed.url, status: response.status });
        continue;
      }
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

        const cleanTitle = decodeEntities(title).replace(/<[^>]+>/g,"").trim();
        const cleanDesc  = decodeEntities(desc).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
        const pub = parseDate(pubRaw);

        // 7일 필터 (날짜 없으면 포함)
        if (pub && (pub < start || pub > now)) continue;

        // 카테고리 키워드 필터
        if (!matchesCategory(cleanTitle, cleanDesc)) continue;
        if (isExcluded(cleanTitle, cleanDesc)) continue;

        rssResults.push({
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
      feedErrors.push({ org: feed.org, url: feed.url, error: e.message });
      console.error(`RSS error (${feed.org}):`, e.message);
    }
  }

  // 네이버 뉴스 보강 — 부처 RSS 종료로 비는 정책 항목을 메운다. 키워드마다 따로 질의한다(AND 방지).
  const naverKws = CATEGORY_NAVER_KEYWORDS[category] || [];
  if (naverKws.length > 0 && hasNaverKeys()) {
    // 동시 발사는 429를 부른다. 공통 호출기가 순차 호출·재시도·실패 기록을 처리한다.
    // 관련도순(sim). 최신순은 키워드를 스쳐 언급한 무관한 기사를 대량으로 끌어온다.
    const { results: searches, errors } = await searchNewsAll(naverKws, { display: 10, sort: "sim" });
    for (const err of errors) feedErrors.push({ org: "네이버뉴스", url: err.keyword, ...err });

    for (const { items } of searches) {
      for (const item of items) {
        const cleanTitle = decodeEntities(item.title || "").replace(/<[^>]+>/g,"").trim();
        const cleanDesc  = decodeEntities(item.description || "").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
        if (!cleanTitle) continue;

        const pub = parseDate(item.pubDate);
        if (!pub || pub < start || pub > now) continue;

        // 뉴스 검색은 질의어와 느슨하게 매칭되므로 RSS와 동일한 카테고리 필터를 반드시 적용한다.
        // (생략했더니 project_open이 공모와 무관한 일반 뉴스로 채워졌다.)
        if (!matchesCategory(cleanTitle, cleanDesc)) continue;
        if (isExcluded(cleanTitle, cleanDesc)) continue;

        const link = (item.originallink || item.link || "").trim();
        naverResults.push({
          title:         cleanTitle,
          description:   cleanDesc.slice(0, 150),
          link,
          originallink:  link,
          pubDate:       pub.toUTCString(),
          formattedDate: formatDate(pub),
          org:           "네이버뉴스",
          type:          "뉴스",
        });
      }
    }
  }

  // 기업마당 지원사업 공고 — project_open 전용.
  // 고용노동부 RSS만으로는 공모 공고가 주당 4건 수준이라 중앙부처·지자체 공고로 넓힌다.
  if (category === "project_open") {
    const { items: bizItems, errors: bizErrors } = await fetchBizinfo({ days: 7, pages: 2 });
    for (const err of bizErrors) feedErrors.push(err);
    for (const it of bizItems) {
      // 채용 공고는 여기서도 동일하게 제외한다.
      if (isExcluded(it.title, it.description)) continue;
      rssResults.push(it);
    }
  }

  // 각각 날짜순 정렬한 뒤 RSS(공식 공고)를 앞에 두고, 남는 자리만 네이버 뉴스로 채운다.
  const byDate = (a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0);
  rssResults.sort(byDate);
  naverResults.sort(byDate);

  // 링크·제목 기준 중복 제거
  const seenLink  = new Set();
  const seenTitle = new Set();
  const deduped = [];
  for (const r of [...rssResults, ...naverResults]) {
    const tkey = r.title.replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 30);
    if (r.link && seenLink.has(r.link)) continue;
    if (tkey && seenTitle.has(tkey)) continue;
    if (r.link) seenLink.add(r.link);
    if (tkey) seenTitle.add(tkey);
    deduped.push(r);
  }

  const top = deduped.slice(0, 12);

  // 기존 호출부(policy.html)는 배열을 그대로 기대하므로 format=full일 때만 래핑해서 준다.
  if (format === "full") {
    return res.status(200).json({ items: top, feedErrors });
  }
  res.status(200).json(top);
}
