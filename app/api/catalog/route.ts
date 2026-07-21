import { Hono } from "hono";
import { catalog } from "../../data/catalog";
import { database } from "../../../db/runtime";

const api = new Hono().basePath("/api");

api.get("/catalog", async (c) => {
  const query = (c.req.query("q") ?? "").toLowerCase();
  const type = c.req.query("type");
  let databaseItems: typeof catalog = [];
  try {
    const result = await database().prepare("SELECT id, title, original_title AS originalTitle, type, status, year, episode_count AS count, rating, genres, image FROM contents ORDER BY created_at DESC").all();
    databaseItems = result.results.map((row: Record<string, unknown>) => ({ id: String(row.id), title: String(row.title), originalTitle: String(row.originalTitle), type: row.type as "anime" | "manga" | "manhwa", status: String(row.status), year: Number(row.year), ...(row.type === "anime" ? { episodes: Number(row.count) } : { chapters: Number(row.count) }), rating: Number(row.rating), genres: String(row.genres).split(",").map((value) => value.trim()).filter(Boolean), image: String(row.image) }));
  } catch { /* D1 may be unavailable during a local static probe */ }
  const items = [...databaseItems, ...catalog].filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(query);
    const matchesType = !type || type === "all" || item.type === type || (type === "manhwa" && item.type === "manga");
    return matchesQuery && matchesType;
  });
  return c.json({ items, total: items.length, poweredBy: "HonoJS" });
});

export const GET = (request: Request) => api.fetch(request);
