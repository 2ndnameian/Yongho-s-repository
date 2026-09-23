/*
 * 매일 자동 수집 후 서버(Vercel Blob)에 저장한다.
 * news/policy/market/competitor.html이 브라우저에서 하는 수집·가공 로직을
 * 그대로 서버에서 재현해 사람이 버튼을 누르지 않아도 최신 스냅샷이 쌓이게 한다.
 */

import { fetchWork24Courses } from "./_lib/work24.js";

const stripTags = (s) => (s || "").replace(/<[^>]+>/g, "");
const cleanUrl = (originallink, link) =>
  (originallink || link || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const fmtDate = (dateLike) => {
  try {
    const d = new Date(dateLike);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
};

const NEWS_GROUPS = [
  { id: "vocational", label: "직업훈련 정책", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe",
    keywords: ["직업훈련", "국비훈련", "고용노동부 직업훈련", "KDT", "KDC", "직업능력개발훈련"] },
  { id: "education", label: "교육 동향", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe",
    keywords: ["AI 인재양성", "디지털 교육", "에듀테크", "평생교육", "마이크로디그리", "소프트웨어 교육"] },
  { id: "industry", label: "산업 동향", color: "#065f46", bg: "#f0fdf4", border: "#bbf7d0",
    keywords: ["AI 산업", "반도체 산업", "로봇 산업", "디지털 전환", "IT 인력 부족", "개발자 채용"] },
  { id: "competitor", label: "경쟁기관 레이더", color: "#b45309", bg: "#fffbeb", border: "#fde68a",
    keywords: ["직업훈련기관", "IT 교육기관", "코딩 교육", "AI 교육기관", "부트캠프", "취업연계 교육"] },
];

const POLICY_GROUPS = [
  { id: "vocational_policy", label: "직업훈련 정책", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "talent_policy", label: "인재양성 정책", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "edu_policy", label: "교육 정책", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "project_open", label: "사업 공모", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  { id: "industry_policy", label: "산업 정책", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
];

const MARKET_GROUPS = [
  { id: "org_large", label: "대형 직업훈련기관", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "org_univ", label: "대학 산학협력단", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "org_edutech", label: "에듀테크 기업", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "org_it", label: "IT 교육기관", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "org_special", label: "전문교육기관", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  { id: "trend_course", label: "과정 개설", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "trend_project", label: "공모 참여", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { id: "trend_mou", label: "협약·제휴", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "trend_digital", label: "디지털 확대", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "field_ai", label: "AI·인공지능", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "field_semi", label: "반도체", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { id: "field_content", label: "콘텐츠·게임", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "field_smart", label: "스마트제조", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "field_data", label: "데이터·클라우드", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "field_security", label: "보안", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
];

const ORGS = [
  { id: "greenit", name: "그린컴퓨터아카데미" }, { id: "thejoeun", name: "더조은컴퓨터아카데미" },
  { id: "kh", name: "KH정보교육원" }, { id: "sbs", name: "SBS아카데미컴퓨터아트" },
  { id: "megait", name: "메가스터디IT" }, { id: "ezenac", name: "이젠아카데미" },
  { id: "mbc", name: "MBC아카데미" }, { id: "kd", name: "KD아카데미" },
  { id: "kovjob", name: "한국직업전문학교" }, { id: "bitcamp", name: "비트캠프" },
  { id: "itbank", name: "아이티뱅크" }, { id: "ssangyong", name: "쌍용교육센터" },
  { id: "kookbi", name: "국비닷컴" }, { id: "polytech", name: "한국폴리텍대학" },
  { id: "ssafy", name: "SSAFY(삼성청년SW아카데미)" }, { id: "samsungaxi", name: "삼성AXI" },
  { id: "multicampus", name: "멀티캠퍼스" }, { id: "fastcampus", name: "패스트캠퍼스" },
  { id: "codestates", name: "코드스테이츠" }, { id: "elice", name: "엘리스" },
  { id: "modulabs", name: "모두의연구소" }, { id: "codeit", name: "코드잇" },
  { id: "hitecher", name: "하이테커" }, { id: "teamspart", name: "팀스파르타" },
  { id: "alpaco", name: "알파코" }, { id: "elice2", name: "엘리스그룹" },
  { id: "zerobase", name: "제로베이스" }, { id: "innovation", name: "이노베이션아카데미" },
  { id: "wooa", name: "우아한테크코스" }, { id: "hanghe", name: "항해99" },
  { id: "boostcamp", name: "부스트캠프" },
];

async function safeJson(res) {
  if (!res.ok) return [];
  try { const d = await res.json(); return Array.isArray(d) ? d : []; } catch { return []; }
}

// format=full 응답({ items, feedErrors })을 읽는다. 배열이 오면 items로 감싸 하위 호환을 유지한다.
async function safeObj(res) {
  if (!res.ok) return { items: [], feedErrors: [] };
  try {
    const d = await res.json();
    if (Array.isArray(d)) return { items: d, feedErrors: [] };
    return { items: d.items || [], feedErrors: d.feedErrors || [] };
  } catch { return { items: [], feedErrors: [] }; }
}

// 기관명 한 단어로만 검색하면 동명이의 기사(연예·게임 등)가 섞인다. 교육 맥락어로 걸러낸다.
const ORG_CONTEXT = ["교육","훈련","과정","수강","취업","개발자","아카데미","캠퍼스","부트캠프",
                     "수료","IT","코딩","강의","커리큘럼","학원","인재","채용연계","국비","스쿨"];

async function collectNews(base) {
  const groups = await Promise.all(NEWS_GROUPS.map(async (group) => {
    const res = await fetch(`${base}/api/news?keywords=${encodeURIComponent(group.keywords.slice(0, 6).join(","))}`);
    const items = (await safeJson(res)).slice(0, 10).map((item, i) => {
      const title = stripTags(item.title || "");
      const summary = stripTags(item.description || "");
      const url = cleanUrl(item.originallink, item.link);
      let source = "네이버뉴스";
      try { source = new URL(url || item.link).hostname.replace("www.", ""); } catch {}
      const urgency = title.includes("긴급") || title.includes("폐지") || title.includes("중단") ? "critical"
        : title.includes("확대") || title.includes("개편") || title.includes("신규") ? "high"
        : title.includes("모집") || title.includes("공고") ? "medium" : "low";
      return { id: `${group.id}-${i}-${Date.now()}`, groupId: group.id, groupLabel: group.label,
        groupColor: group.color, groupBg: group.bg, groupBorder: group.border,
        title, summary, source, url, date: fmtDate(item.pubDate), urgency, tags: [group.label] };
    });
    return { id: group.id, label: group.label, items };
  }));
  return { source: "news", groups };
}

async function collectPolicy(base) {
  const feedErrors = [];
  const groups = await Promise.all(POLICY_GROUPS.map(async (group) => {
    // format=full 이어야 죽은 피드 정보(feedErrors)가 함께 온다.
    const res = await fetch(`${base}/api/policy?category=${group.id}&format=full`);
    const payload = await safeObj(res);
    if (Array.isArray(payload.feedErrors)) {
      for (const err of payload.feedErrors) feedErrors.push({ ...err, category: group.id });
    }
    const items = (payload.items || []).slice(0, 10).map((item, i) => {
      const title = stripTags(item.title || "");
      const summary = stripTags(item.description || "");
      const url = cleanUrl(item.originallink, item.link);
      let source = "정책";
      try { source = new URL(url || item.link).hostname.replace("www.", ""); } catch {}
      const urgency = title.includes("긴급") || title.includes("마감") || title.includes("즉시") ? "critical"
        : title.includes("공고") || title.includes("모집") || title.includes("선정") ? "high"
        : title.includes("발표") || title.includes("시행") || title.includes("추진") ? "medium" : "low";
      return { id: `${group.id}-${i}-${Date.now()}`, groupId: group.id, groupLabel: group.label,
        groupColor: group.color, groupBg: group.bg, groupBorder: group.border,
        title, summary, source, url, date: fmtDate(item.pubDate), urgency, tags: [group.label] };
    });
    return { id: group.id, label: group.label, items };
  }));
  return { source: "policy", groups, feedErrors };
}

async function collectMarket(base) {
  // 15개 그룹을 동시 발사하면 각 호출이 네이버 API를 1회씩 때려 429가 난다(실측 2026-09-23).
  // market.js에는 재시도가 없어 429가 그대로 빈 그룹이 되므로 순차 호출한다.
  const groups = [];
  for (const group of MARKET_GROUPS) {
    groups.push(await (async () => {
    const res = await fetch(`${base}/api/market?category=${group.id}`);
    const items = (await safeJson(res)).slice(0, 10).map((item, i) => {
      const title = stripTags(item.title || "");
      const summary = stripTags(item.description || "");
      const url = cleanUrl(item.originallink, item.link);
      let source = "";
      try { source = new URL(url || item.link).hostname.replace("www.", ""); } catch {}
      const urgency = title.includes("선정") || title.includes("협약") || title.includes("MOU") ? "high"
        : title.includes("개설") || title.includes("출시") || title.includes("신규") ? "medium" : "low";
      return { id: `${group.id}-${i}-${Date.now()}`, groupId: group.id, groupLabel: group.label,
        groupColor: group.color, groupBg: group.bg, groupBorder: group.border,
        title, summary, source, url, date: fmtDate(item.pubDate), urgency, tags: [group.label] };
    });
    return { id: group.id, label: group.label, items };
    })());
    await new Promise((r) => setTimeout(r, 150));
  }
  return { source: "market", groups: groups.filter(g => g.items.length > 0) };
}

async function collectCompetitor(base) {
  // 31개 기관을 동시에 발사하면 네이버 429가 대량으로 난다(실측 2026-09-23). 순차 호출한다.
  const orgs = [];
  for (const org of ORGS) {
    orgs.push(await (async () => {
    // 구문검색(따옴표)으로 1차 좁히고, 기관명 포함 + 교육 맥락어 조건으로 오탐을 걸러낸다.
    const res = await fetch(`${base}/api/news?keywords=${encodeURIComponent(`"${org.name}"`)}`);
    const items = (await safeJson(res))
      .map((it) => ({
        title: stripTags(it.title || ""),
        link: cleanUrl(it.originallink, it.link),
        pub: fmtDate(it.pubDate),
        desc: stripTags(it.description || "").slice(0, 80),
        _hay: stripTags(`${it.title || ""} ${it.description || ""}`),
      }))
      .filter((it) => it._hay.includes(org.name) && ORG_CONTEXT.some((k) => it._hay.includes(k)))
      .slice(0, 5)
      .map(({ _hay, ...rest }) => rest);
      return { id: org.id, name: org.name, items };
    })());
  }

  // 고용24 실제 개설 과정 병합 — 뉴스 언급보다 경쟁 분석에 직접 쓰이는 데이터다.
  // 기관 수가 100개를 넘으므로 기존 경쟁기관 명단과 겹치는 곳을 먼저 넣고, 나머지는 과정 수 상위로 채운다.
  const { orgs: w24Orgs, errors: work24Errors, stats: work24Stats } = await fetchWork24Courses({ days: 7 });
  const knownNames = ORGS.map((o) => o.name);
  const isKnown = (name) => knownNames.some((k) => name.includes(k) || k.includes(name));
  const ranked = [...w24Orgs].sort((a, b) => {
    const ka = isKnown(a.name) ? 1 : 0;
    const kb = isKnown(b.name) ? 1 : 0;
    if (ka !== kb) return kb - ka;
    return b.items.length - a.items.length;
  });
  for (const o of ranked.slice(0, 40)) {
    orgs.push({ id: `work24-${o.name}`, name: `[고용24] ${o.name}`, items: o.items.slice(0, 5) });
  }

  return { source: "competitor", orgs, work24Errors, work24Stats };
}

async function saveSnapshot(base, payload) {
  const now = new Date();
  const from = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const body = {
    ...payload,
    trigger: "auto",
    collectedAt: now.toISOString(),
    period: { preset: "7d", from: from.toISOString(), to: now.toISOString() },
    totalCount: (payload.groups || payload.orgs || []).flatMap(g => g.items || []).length,
  };
  const res = await fetch(`${base}/api/save-snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  return { source: payload.source, ok: res.ok, ...result };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const base = `https://${req.headers.host}`;

  try {
    const [newsData, policyData, marketData, competitorData] = await Promise.all([
      collectNews(base), collectPolicy(base), collectMarket(base), collectCompetitor(base),
    ]);

    // 순차 저장: 병렬로 호출하면 execution-log.json에 대한 동시 read-modify-write가
    // 서로를 덮어써 일부 소스의 로그 기록이 유실된다.
    const results = [];
    for (const data of [newsData, policyData, marketData, competitorData]) {
      results.push(await saveSnapshot(base, data));
    }

    res.status(200).json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
