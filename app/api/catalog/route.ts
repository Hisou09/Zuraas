import { Hono } from "hono";
import { catalog } from "../../data/catalog";

const api = new Hono().basePath("/api");

api.get("/catalog", (c) => {
  const query = (c.req.query("q") ?? "").toLowerCase();
  const type = c.req.query("type");
  const items = catalog.filter((item) => {
    const matchesQuery = !query || `${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(query);
    const matchesType = !type || type === "all" || item.type === type || (type === "manhwa" && item.type === "manga");
    return matchesQuery && matchesType;
  });
  return c.json({ items, total: items.length, poweredBy: "HonoJS" });
});

export const GET = (request: Request) => api.fetch(request);
