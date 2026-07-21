import { Hono } from "hono";
import { catalog } from "../../data/catalog";
import { database } from "../../../db/runtime";

const api = new Hono().basePath("/api");

api.get("/catalog", async (c) => {
  const query = (c.req.query("q") ?? "").toLowerCase();
  const type = c.req.query("type");
  let databaseItems: typeof catalog = [];
  try {
    const result = await database().prepare(`
      SELECT
        c.id,
        c.title,
        c.original_title AS originalTitle,
        c.type,
        c.status,
        c.year,
        c.episode_count AS count,
        c.rating,
        c.genres,
        c.image,
        c.created_at AS createdAt,
        COALESCE(
          (SELECT MAX(COALESCE(e.publish_at, e.created_at))
           FROM episodes e
           WHERE e.content_id = c.id
             AND (e.publish_at IS NULL OR datetime(e.publish_at) <= CURRENT_TIMESTAMP)),
          c.created_at
        ) AS latestAt
      FROM contents c
      ORDER BY datetime(c.created_at) DESC
    `).all();
    databaseItems = result.results.map((row: Record<string, unknown>) => ({ id: String(row.id), title: String(row.title), originalTitle: String(row.originalTitle), type: row.type as "anime" | "manga" | "manhwa", status: String(row.status), year: Number(row.year), ...(row.type === "anime" ? { episodes: Number(row.count) } : { chapters: Number(row.count) }), rating: Number(row.rating), genres: String(row.genres).split(",").map((value) => value.trim()).filter(Boolean), image: String(row.image), createdAt: String(row.createdAt), latestAt: String(row.latestAt) }));
  } catch { /* D1 may be unavailable during a local static probe */ }
  let animeIndex = 0;
  let mangaIndex = 0;
  const now = Date.now();
  const demoItems = catalog.map((item) => {
    const index = item.type === "anime" ? animeIndex++ : mangaIndex++;
    const offsetMinutes = item.type === "anime"
      ? [8, 95, 24 * 60, 3 * 24 * 60, 8 * 24 * 60, 18 * 24 * 60, 35 * 24 * 60, 68 * 24 * 60, 95 * 24 * 60, 150 * 24 * 60][index]
      : [24, 4 * 60, 2 * 24 * 60, 5 * 24 * 60, 11 * 24 * 60, 21 * 24 * 60, 40 * 24 * 60, 72 * 24 * 60, 110 * 24 * 60, 180 * 24 * 60][index];
    const timestamp = new Date(now - (offsetMinutes ?? (index + 1) * 24 * 60) * 60_000).toISOString();
    return { ...item, createdAt: timestamp, latestAt: timestamp };
  });
  const items = [...databaseItems, ...demoItems].filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(query);
    const matchesType = !type || type === "all" || item.type === type || (type === "manhwa" && item.type === "manga");
    return matchesQuery && matchesType;
  });
  return c.json({ items, total: items.length, poweredBy: "HonoJS" });
});

export const GET = (request: Request) => api.fetch(request);
