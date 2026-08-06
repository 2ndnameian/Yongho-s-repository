import { get, put } from "@vercel/blob";

const LOG_PATH = "logs/execution-log.json";
const MAX_ENTRIES = 200;

export async function appendLog(entry) {
  let entries = [];
  try {
    const result = await get(LOG_PATH, { access: "private", useCache: false });
    if (result?.statusCode === 200) {
      entries = await new Response(result.stream).json();
      if (!Array.isArray(entries)) entries = [];
    }
  } catch {}

  entries.push({ timestamp: new Date().toISOString(), ...entry });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);

  await put(LOG_PATH, JSON.stringify(entries), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
