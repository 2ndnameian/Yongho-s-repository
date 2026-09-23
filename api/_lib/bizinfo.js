/*
 * 기업마당(중소벤처기업부) 지원사업 공고 조회 — data.go.kr 오픈 API.
 *
 * 고용노동부 RSS만으로는 공모사업 공고가 주당 4건 수준에 그친다(2026-09-23 실측).
 * 기업마당은 중앙행정기관·지자체·유관기관 공고를 모아 제공하며 신청기간·지원대상이
 * 함께 오기 때문에, 뉴스 기사와 달리 "지원 가능한 공고"로 그대로 쓸 수 있다.
 *
 * 키가 없거나 호출이 실패하면 조용히 빈 배열로 넘기지 않고 errors에 남긴다.
 */

const ENDPOINT = "https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService";

// 직업훈련기관 관점에서 의미 있는 공고를 고르는 키워드
const TRAINING_KEYWORDS = [
  "훈련", "교육", "인재", "인력", "일자리", "직업", "역량", "양성", "연수", "학습", "직무",
];

// 분야(pldirSportRealmLclasCodeNm) 중 항상 포함할 값
const REALM_INCLUDE = ["인력"];

export function hasBizinfoKey() {
  return Boolean(process.env.DATA_GO_KR_KEY);
}

function parseCreated(value) {
  if (!value) return null;
  // "2026-09-22 09:00:00" 또는 "2026-09-22" 형태
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
  return isNaN(d) ? null : d;
}

function formatDate(d) {
  if (!d || isNaN(d)) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function isTrainingRelated(item) {
  const realm = item.pldirSportRealmLclasCodeNm || "";
  if (REALM_INCLUDE.includes(realm)) return true;
  const hay = `${item.pblancNm || ""} ${item.bsnsSumryCn || ""} ${item.hashtags || ""}`;
  return TRAINING_KEYWORDS.some((kw) => hay.includes(kw));
}

/**
 * 최근 days일 이내 등록된 훈련·인력 관련 공고를 policy.js 결과 형식으로 반환한다.
 * 반환: { items, errors }
 */
export async function fetchBizinfo({ days = 7, pages = 2, numOfRows = 100 } = {}) {
  if (!hasBizinfoKey()) {
    return { items: [], errors: [{ org: "기업마당", error: "DATA_GO_KR_KEY 미설정" }] };
  }

  const key = process.env.DATA_GO_KR_KEY;
  const now = new Date();
  const start = new Date(now - days * 24 * 60 * 60 * 1000);
  const items = [];
  const errors = [];

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}`
        + `&pageNo=${page}&numOfRows=${numOfRows}&dataType=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!res.ok) {
        errors.push({ org: "기업마당", page, status: res.status });
        break;
      }

      const data = await res.json();
      const header = data?.response?.header;
      if (header && header.resultCode !== "00") {
        errors.push({ org: "기업마당", page, error: header.resultMsg || header.resultCode });
        break;
      }

      const list = data?.response?.body?.items?.item || [];
      if (list.length === 0) break;

      let olderThanWindow = 0;
      for (const raw of list) {
        const created = parseCreated(raw.creatPnttm);
        if (!created || created < start) { olderThanWindow++; continue; }
        if (!isTrainingRelated(raw)) continue;

        items.push({
          title:         (raw.pblancNm || "").trim(),
          description:   (raw.bsnsSumryCn || "").replace(/\s+/g, " ").trim().slice(0, 150),
          link:          raw.pblancUrl || "",
          originallink:  raw.pblancUrl || "",
          pubDate:       created.toUTCString(),
          formattedDate: formatDate(created),
          org:           raw.jrsdInsttNm || "기업마당",
          type:          "지원사업공고",
          applyPeriod:   raw.reqstBeginEndDe || "",
          target:        raw.trgetNm || "",
          realm:         raw.pldirSportRealmLclasCodeNm || "",
        });
      }

      // 최신순이므로 한 페이지가 통째로 기간 밖이면 더 볼 필요가 없다.
      if (olderThanWindow === list.length) break;
    } catch (e) {
      errors.push({ org: "기업마당", page, error: e.message });
      break;
    }
  }

  return { items, errors };
}
