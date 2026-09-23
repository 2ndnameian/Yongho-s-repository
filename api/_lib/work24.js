/*
 * 고용24(work24) 훈련과정 조회 — 경쟁기관 실제 개설 과정 수집용.
 *
 * 경쟁기관을 네이버 뉴스로만 보면 동명이의 오탐이 섞이고, 무엇보다 "무엇을 얼마에
 * 몇 명 대상으로 가르치는지"가 안 나온다. 고용24 API는 과정명·수강료·정원·등록인원·
 * 취업률·훈련등급을 직접 주므로 경쟁 분석에는 이쪽이 본선이다.
 *
 * 인증키는 WORK24_AUTH_KEY 환경변수로만 받는다(소스에 키를 박지 않는다).
 * 키가 없으면 빈 배열이 아니라 errors에 남겨 원인이 드러나게 한다.
 */

const LIST_URL = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 훈련 유형
export const TRAIN_TYPES = [
  { crseTracseSe: "C0054", srchTraGbn: "M1001", label: "국기" },
  { crseTracseSe: "C0104", srchTraGbn: "M1001", label: "KDT" },
  { crseTracseSe: "C0105", srchTraGbn: "M1005", label: "KDC" },
  { crseTracseSe: "C0061", srchTraGbn: "M1001", label: "일반계좌제" },
];

// 우리 기관 사업영역과 겹치는 NCS 3차 코드.
// 전체 15개를 4개 유형과 모두 조합하면 60회 호출(30초 이상)이라 서버리스 실행시간을 넘긴다.
// 경쟁 분석에 직결되는 7개로 줄여 28회로 맞춘다.
export const NCS_CODES = {
  "200102": "정보기술개발",
  "200106": "인공지능",
  "200107": "정보보호",
  "200101": "정보기술전략·계획",
  "080201": "디자인",
  "080302": "문화콘텐츠제작",
  "080304": "영상제작",
};

export function hasWork24Key() {
  return Boolean(process.env.WORK24_AUTH_KEY);
}

function toYYYYMMDD(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function fmtDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return value;
}

async function fetchPage(params, retries = 3) {
  const query = new URLSearchParams({
    authKey: process.env.WORK24_AUTH_KEY,
    returnType: "JSON",
    outType: "1",
    pageSize: "30",
    pageNum: "1",
    ...params,
  });

  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${LIST_URL}?${query}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        lastError = { status: res.status };
        await sleep(300 * (attempt + 1));
        continue;
      }
      const data = await res.json();
      if (data && data.error) return { list: [], error: { error: data.error } };
      return { list: data?.srchList || [], error: null };
    } catch (e) {
      lastError = { error: e.message };
      await sleep(300 * (attempt + 1));
    }
  }
  return { list: [], error: lastError || { error: "unknown" } };
}

/**
 * 최근 days일 사이 개강한 과정을 기관별로 모아 반환한다.
 * 반환: { orgs: [{ name, items }], errors, stats }
 */
export async function fetchWork24Courses({ days = 7, gapMs = 200 } = {}) {
  if (!hasWork24Key()) {
    return { orgs: [], errors: [{ org: "고용24", error: "WORK24_AUTH_KEY 미설정" }], stats: { calls: 0, courses: 0 } };
  }

  const today = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateParams = { srchTraStDt: toYYYYMMDD(from), srchTraEndDt: toYYYYMMDD(today) };

  const errors = [];
  const seen = new Set();
  const byOrg = new Map();
  let calls = 0;

  for (const [ncsCode, ncsName] of Object.entries(NCS_CODES)) {
    for (const type of TRAIN_TYPES) {
      const { list, error } = await fetchPage({
        crseTracseSe: type.crseTracseSe,
        srchTraGbn: type.srchTraGbn,
        srchNcs3: ncsCode,
        ...dateParams,
      });
      calls++;
      if (error) errors.push({ org: "고용24", ncs: ncsName, type: type.label, ...error });

      for (const raw of list) {
        // 같은 과정이 NCS·유형 조합마다 중복으로 잡힌다.
        const key = `${raw.trprId}_${raw.trprDegr}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const orgName = (raw.subTitle || "").trim();
        if (!orgName) continue;

        const parts = [`${type.label}·${ncsName}`];
        if (raw.traStartDate) parts.push(`개강 ${fmtDate(raw.traStartDate)}`);
        if (raw.courseMan) parts.push(`수강료 ${Number(raw.courseMan).toLocaleString()}원`);
        if (raw.yardMan) parts.push(`정원 ${raw.yardMan}명`);
        if (raw.regCourseMan) parts.push(`등록 ${raw.regCourseMan}명`);
        if (raw.eiEmplRate3) parts.push(`취업률(3개월) ${raw.eiEmplRate3}%`);
        if (raw.grade) parts.push(`등급 ${raw.grade}`);

        if (!byOrg.has(orgName)) byOrg.set(orgName, []);
        byOrg.get(orgName).push({
          title: (raw.title || "").trim(),
          link: "",
          pub: fmtDate(raw.traStartDate),
          desc: parts.join(" · "),
          trainType: type.label,
          ncs: ncsName,
          courseMan: raw.courseMan || "",
          yardMan: raw.yardMan || "",
          regCourseMan: raw.regCourseMan || "",
          emplRate3: raw.eiEmplRate3 || "",
          grade: raw.grade || "",
        });
      }

      await sleep(gapMs);
    }
  }

  const orgs = [...byOrg.entries()].map(([name, items]) => ({ name, items }));
  const courses = orgs.reduce((n, o) => n + o.items.length, 0);
  return { orgs, errors, stats: { calls, courses, orgs: orgs.length } };
}
