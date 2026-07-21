import { Hono } from "hono";
import { database, ensureSchema, ensureUser } from "../../../../db/runtime";

const api = new Hono().basePath("/api/app");

api.use("*", async (_c, next) => { await ensureSchema(); await next(); });

api.get("/session", async (c) => {
  const user = await ensureUser(c.req.raw);
  const notifications = await database().prepare("SELECT id, title, body, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_email = ? ORDER BY id DESC LIMIT 8").bind(user.email).all();
  return c.json({ user, notifications: notifications.results });
});

api.get("/user-items", async (c) => {
  const user = await ensureUser(c.req.raw);
  const kind = c.req.query("kind") === "history" ? "history" : "library";
  const sql = kind === "history"
    ? "SELECT content_id AS contentId, progress, updated_at AS date FROM watch_history WHERE user_email = ? ORDER BY updated_at DESC"
    : "SELECT content_id AS contentId, created_at AS date FROM library_items WHERE user_email = ? ORDER BY id DESC";
  const result = await database().prepare(sql).bind(user.email).all();
  return c.json({ items: result.results });
});

api.post("/library", async (c) => {
  const user = await ensureUser(c.req.raw);
  const { contentId } = await c.req.json<{ contentId: string }>();
  await database().prepare("INSERT OR IGNORE INTO library_items (user_email, content_id) VALUES (?, ?)").bind(user.email, contentId).run();
  return c.json({ ok: true });
});

api.delete("/library", async (c) => {
  const user = await ensureUser(c.req.raw);
  await database().prepare("DELETE FROM library_items WHERE user_email = ? AND content_id = ?").bind(user.email, c.req.query("contentId") ?? "").run();
  return c.json({ ok: true });
});

api.post("/history", async (c) => {
  const user = await ensureUser(c.req.raw);
  const { contentId, progress = 1 } = await c.req.json<{ contentId: string; progress?: number }>();
  await database().batch([
    database().prepare("INSERT INTO watch_history (user_email, content_id, progress, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_email, content_id) DO UPDATE SET progress = excluded.progress, updated_at = CURRENT_TIMESTAMP").bind(user.email, contentId, progress),
    database().prepare("INSERT INTO analytics_events (event_type, user_email) VALUES ('view', ?)").bind(user.email),
  ]);
  return c.json({ ok: true });
});

api.get("/comments", async (c) => {
  const contentId = c.req.query("contentId") ?? "";
  const result = await database().prepare("SELECT id, content_id AS contentId, display_name AS displayName, body, created_at AS createdAt FROM comments WHERE content_id = ? ORDER BY id DESC LIMIT 50").bind(contentId).all();
  return c.json({ comments: result.results });
});

api.post("/comments", async (c) => {
  const user = await ensureUser(c.req.raw);
  const { contentId, body } = await c.req.json<{ contentId: string; body: string }>();
  if (!body?.trim()) return c.json({ error: "Сэтгэгдэл хоосон байна" }, 400);
  await database().prepare("INSERT INTO comments (content_id, user_email, display_name, body) VALUES (?, ?, ?, ?)").bind(contentId, user.email, user.displayName, body.trim()).run();
  return c.json({ ok: true });
});

api.get("/vip", async (c) => {
  const settings = await database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, headline, promotion, accent_color AS accentColor FROM vip_settings WHERE id = 1").first();
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, discount_percent AS discountPercent, active FROM vip_packages WHERE active = 1 ORDER BY price").all();
  return c.json({ settings: settings ?? { bankName: "Хаан банк", accountNumber: "0000 0000 0000", accountHolder: "Зураас ХХК", headline: "VIP ертөнцөд нэгдээрэй", promotion: "", accentColor: "#8b6cf6" }, packages: packages.results });
});

api.get("/admin", async (c) => {
  await ensureUser(c.req.raw);
  const [users, comments, contentCount, views, revenue, vip] = await database().batch([
    database().prepare("SELECT id, email, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY id DESC LIMIT 100"),
    database().prepare("SELECT id, content_id AS contentId, display_name AS displayName, body, created_at AS createdAt FROM comments ORDER BY id DESC LIMIT 100"),
    database().prepare("SELECT COUNT(*) AS count FROM contents"),
    database().prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'view'"),
    database().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM analytics_events WHERE event_type = 'payment'"),
    database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, headline, promotion, accent_color AS accentColor FROM vip_settings WHERE id = 1"),
  ]);
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, discount_percent AS discountPercent, active FROM vip_packages ORDER BY id").all();
  const dbContent = Number((contentCount.results[0] as { count?: number })?.count ?? 0);
  return c.json({ users: users.results, comments: comments.results, packages: packages.results, vip: vip.results[0] ?? null, analytics: { visits: Number((views.results[0] as { count?: number })?.count ?? 0), users: users.results.length, revenue: Number((revenue.results[0] as { total?: number })?.total ?? 0), content: 20 + dbContent } });
});

api.post("/admin/content", async (c) => {
  await ensureUser(c.req.raw);
  const item = await c.req.json<{ id: string; title: string; originalTitle?: string; type: string; status?: string; year?: number; count?: number; rating?: number; genres?: string; image: string }>();
  const id = item.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  await database().prepare("INSERT INTO contents (id, title, original_title, type, status, year, episode_count, rating, genres, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, item.title, item.originalTitle || item.title, item.type, item.status || "On-Going", item.year || new Date().getFullYear(), item.count || 0, item.rating || 0, item.genres || "", item.image).run();
  return c.json({ ok: true, id });
});

api.post("/admin/vip", async (c) => {
  await ensureUser(c.req.raw);
  const v = await c.req.json<{ bankName: string; accountNumber: string; accountHolder: string; headline: string; promotion: string; accentColor: string }>();
  await database().prepare("INSERT INTO vip_settings (id, bank_name, account_number, account_holder, headline, promotion, accent_color) VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET bank_name=excluded.bank_name, account_number=excluded.account_number, account_holder=excluded.account_holder, headline=excluded.headline, promotion=excluded.promotion, accent_color=excluded.accent_color").bind(v.bankName, v.accountNumber, v.accountHolder, v.headline, v.promotion, v.accentColor).run();
  return c.json({ ok: true });
});

api.post("/admin/package", async (c) => {
  await ensureUser(c.req.raw);
  const p = await c.req.json<{ name: string; durationDays: number; price: number; discountPercent: number }>();
  await database().prepare("INSERT INTO vip_packages (name, duration_days, price, discount_percent, active) VALUES (?, ?, ?, ?, 1)").bind(p.name, p.durationDays, p.price, p.discountPercent).run();
  return c.json({ ok: true });
});

export const GET = (request: Request) => api.fetch(request);
export const POST = (request: Request) => api.fetch(request);
export const DELETE = (request: Request) => api.fetch(request);
