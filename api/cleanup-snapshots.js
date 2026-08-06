import { list, del } from "@vercel/blob";

const MAX_AGE_DAYS = 365;
const DATED_SNAPSHOT_RE = /^snapshots\/[^/]+\/(\d{4}-\d{2}-\d{2})\.json$/;

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const toDelete = [];
  let cursor;
  let hasMore = true;

  try {
    while (hasMore) {
      const result = await list({ prefix: "snapshots/", cursor, limit: 1000 });

      for (const blob of result.blobs) {
        const match = blob.pathname.match(DATED_SNAPSHOT_RE);
        if (match && new Date(match[1]).getTime() < cutoff) {
          toDelete.push(blob.pathname);
        }
      }

      hasMore = result.hasMore;
      cursor = result.cursor;
    }

    if (toDelete.length > 0) {
      await del(toDelete);
    }

    res.status(200).json({ ok: true, deletedCount: toDelete.length, deleted: toDelete });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
