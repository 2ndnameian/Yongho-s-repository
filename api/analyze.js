// v4 - 진단용
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, max_tokens = 1500 } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "prompt 없음" });

    const apiKey = process.env.ANTHROPIC_API_KEY || "";

    // 키 진단 정보 (앞 10자만 노출)
    const keyPreview = apiKey ? apiKey.slice(0, 10) + "..." : "없음";
    const keyLength  = apiKey.length;

    if (!apiKey) {
      return res.status(500).json({
        error: "API 키 없음",
        debug: { keyPreview, keyLength }
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Anthropic 오류 " + response.status,
        detail: rawText.slice(0, 300),
        debug: { keyPreview, keyLength }
      });
    }

    // 실제 요청 처리
    const response2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response2.json();
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: "서버 오류: " + e.message });
  }
}
