/*
 * 네이버 뉴스 검색 API 공통 호출기.
 *
 * 배경: 여러 키워드를 동시에 발사하면 429(errorCode 012 "Rate limit exceeded")가 섞여 나온다.
 * 실측(2026-09-23) 12건 동시 호출 시 2건이 429였다. 그 응답을 조용히 버리면 수집 결과가
 * 아무 흔적 없이 0건이 되고, 이는 이 저장소가 실제로 몇 주간 겪은 장애의 형태와 같다.
 * 그래서 이 모듈은 (1) 순차 호출 (2) 429 재시도 (3) 실패를 반드시 반환값에 남기는 것을 강제한다.
 *
 * sort: "date"는 최신순이라 키워드를 스치듯 언급한 기사까지 올라온다. 관련도가 중요한 곳은
 * "sim"을 쓴다(실측 2026-09-23: 직업훈련 질의에서 date는 장애인 체육대회·이력서 기사가,
 * sim은 직업훈련 학교·사업주 직업능력개발훈련 경진대회가 상위에 왔다).
 */

const ENDPOINT = "https://openapi.naver.com/v1/search/news.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function naverHeaders() {
  return {
    "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
    "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
  };
}

export function hasNaverKeys() {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

/** 키워드 하나를 검색한다. 성공하면 { items, error:null }, 실패하면 { items:[], error:{...} }. */
export async function searchNews(keyword, { display = 20, retries = 3, sort = "date" } = {}) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(keyword)}&display=${display}&sort=${sort}&start=1`;
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: naverHeaders(), signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        return { items: data.items || [], error: null };
      }
      lastError = { keyword, status: res.status };
      // 429는 잠시 뒤 재시도하면 대체로 풀린다. 그 밖의 상태코드는 재시도해도 같은 결과다.
      if (res.status === 429) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      break;
    } catch (e) {
      lastError = { keyword, error: e.message };
      await sleep(200 * (attempt + 1));
    }
  }

  return { items: [], error: lastError || { keyword, error: "unknown" } };
}

/**
 * 키워드 목록을 순차 호출한다. 동시 발사는 429를 부르므로 의도적으로 직렬 처리한다.
 * 반환: { results: [{ keyword, items }], errors: [...] }
 */
export async function searchNewsAll(keywords, { display = 20, gapMs = 120, retries = 3, sort = "date" } = {}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < keywords.length; i++) {
    const { items, error } = await searchNews(keywords[i], { display, retries, sort });
    if (error) errors.push(error);
    results.push({ keyword: keywords[i], items });
    if (i < keywords.length - 1) await sleep(gapMs);
  }

  return { results, errors };
}

export const naverUtils = { sleep };
