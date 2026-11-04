import { get, put } from "@vercel/blob";

/*
 * 훈련성과 대시보드(training_dashboard.html)의 전기(전년 비교) 등록값 보관.
 * GET  : 현재 등록값 조회 (없으면 404 → 화면은 내장 기본값 사용)
 * POST : 등록값 저장. 기존 등록값은 날짜별 사본(history/)으로 먼저 보관해 덮어쓰기 유실을 막는다.
 */
const CURRENT = "dashboard/yoy-prev/current.json";

async function readCurrent() {
  const result = await get(CURRENT, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return await new Response(result.stream).json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const data = await readCurrent();
      if (!data) return res.status(404).json({ error: "등록된 전기 자료 없음" });
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const hasRows = Array.isArray(body.rows) && body.rows.length > 0;
      const hasGroups = Array.isArray(body.groups) && body.groups.length > 0;
      if (!hasRows && !hasGroups) {
        return res.status(400).json({ error: "rows(집계표) 또는 groups(원본 집계) 중 하나가 필요합니다" });
      }
      // 형식 검사: 한글 시도명 + 성과 값이 있는 항목이 하나도 없으면 전기 자료로 보지 않는다
      const valid = hasGroups
        ? body.groups.filter(g => g && /[가-힣]/.test(String(g.s || "")) && Number(g.rows) > 0)
        : body.rows.filter(p => p && /[가-힣]/.test(String(p.region || "")) &&
            ["score", "cnt", "complete", "emp_rate"].some(k => p[k] != null));
      if (!valid.length) {
        return res.status(400).json({ error: "전기 형식이 아닙니다(지역·직종 성과 값 없음). 저장하지 않았습니다" });
      }

      const prev = await readCurrent().catch(() => null);
      if (prev) {
        const stamp = (prev.registeredAt || new Date().toISOString()).replace(/[:.]/g, "-");
        await put(`dashboard/yoy-prev/history/${stamp}.json`, JSON.stringify(prev), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
      }

      const data = {
        label: String(body.label || ""),
        fileName: String(body.fileName || ""),
        sheetName: String(body.sheetName || ""),
        registeredAt: new Date().toISOString(),
        ...(hasGroups ? { groups: body.groups } : { rows: body.rows }),
      };
      await put(CURRENT, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return res.status(200).json({ ok: true, count: (data.groups || data.rows).length, registeredAt: data.registeredAt });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
