import { Hono } from "hono";
import { database, ensureSchema, ensureUser, isAdmin, mediaBucket } from "../../../../db/runtime";
import { catalog } from "../../../data/catalog";

const api = new Hono().basePath("/api/app");
api.use("*", async (_c, next) => { await ensureSchema(); await next(); });
api.use("/admin",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});
api.use("/admin/*",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});

api.get("/session", async (c) => {
  const user = await ensureUser(c.req.raw);
  const profile = await database().prepare("SELECT usercode, vip_until AS vipUntil, role FROM users WHERE email = ?").bind(user.email).first();
  const notifications = await database().prepare("SELECT id, title, body, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_email = ? ORDER BY id DESC LIMIT 8").bind(user.email).all();
  return c.json({ user: { ...user, ...profile }, notifications: notifications.results });
});

api.get("/user-items", async (c) => {
  const user = await ensureUser(c.req.raw);
  const history = c.req.query("kind") === "history";
  const result = await database().prepare(history ? "SELECT content_id AS contentId, progress, updated_at AS date FROM watch_history WHERE user_email = ? ORDER BY updated_at DESC" : "SELECT l.content_id AS contentId, COALESCE(h.progress,0) AS progress, l.created_at AS date FROM library_items l LEFT JOIN watch_history h ON h.user_email=l.user_email AND h.content_id=l.content_id WHERE l.user_email = ? ORDER BY l.id DESC").bind(user.email).all();
  return c.json({ items: result.results });
});

api.post("/library", async (c) => { const user = await ensureUser(c.req.raw); const { contentId } = await c.req.json<{ contentId: string }>(); const staticItem=catalog.find(item=>item.id===contentId); let isManga=Boolean(staticItem&&staticItem.type!=="anime"); if(!staticItem){const row=await database().prepare("SELECT type FROM contents WHERE id=?").bind(contentId).first<{type:string}>();isManga=Boolean(row&&row.type!=="anime");} if(!isManga)return c.json({error:"Миний санд зөвхөн манга хадгална"},400); await database().prepare("INSERT OR IGNORE INTO library_items (user_email, content_id) VALUES (?, ?)").bind(user.email, contentId).run(); return c.json({ ok: true }); });
api.delete("/library", async (c) => { const user = await ensureUser(c.req.raw); await database().prepare("DELETE FROM library_items WHERE user_email = ? AND content_id = ?").bind(user.email, c.req.query("contentId") ?? "").run(); return c.json({ ok: true }); });
api.post("/history", async (c) => { const user = await ensureUser(c.req.raw); const { contentId, progress = 1 } = await c.req.json<{ contentId: string; progress?: number }>(); await database().batch([database().prepare("INSERT INTO watch_history (user_email, content_id, progress, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_email, content_id) DO UPDATE SET progress = excluded.progress, updated_at = CURRENT_TIMESTAMP").bind(user.email, contentId, progress), database().prepare("INSERT INTO analytics_events (event_type, user_email) VALUES ('view', ?)").bind(user.email)]); return c.json({ ok: true }); });

api.get("/comments", async (c) => { const result = await database().prepare("SELECT id, content_id AS contentId, display_name AS displayName, body, created_at AS createdAt FROM comments WHERE content_id = ? ORDER BY id DESC LIMIT 50").bind(c.req.query("contentId") ?? "").all(); return c.json({ comments: result.results }); });
api.post("/comments", async (c) => { const user = await ensureUser(c.req.raw); const { contentId, body } = await c.req.json<{ contentId: string; body: string }>(); if (!body?.trim()) return c.json({ error: "Сэтгэгдэл хоосон байна" }, 400); await database().prepare("INSERT INTO comments (content_id, user_email, display_name, body) VALUES (?, ?, ?, ?)").bind(contentId, user.email, user.displayName, body.trim()).run(); return c.json({ ok: true }); });

api.get("/vip", async (c) => {
  const settings = await database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1").first();
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, active FROM vip_packages WHERE active = 1 ORDER BY price").all();
  return c.json({ settings, packages: packages.results });
});
api.get("/social", async (c) => { const value = await database().prepare("SELECT facebook,instagram,youtube,discord,telegram FROM social_settings WHERE id=1").first(); return c.json({ social: value }); });

api.get("/admin", async (c) => {
  await ensureUser(c.req.raw);
  const mangaIds = catalog.filter((item) => item.type !== "anime").map((item) => `'${item.id.replaceAll("'", "''")}'`).join(",") || "''";
  const [users, comments, views, revenue, bookmarks, vip, contents, social] = await database().batch([
    database().prepare("SELECT id, email, display_name AS displayName, role, usercode, vip_until AS vipUntil, created_at AS createdAt FROM users ORDER BY id DESC LIMIT 200"),
    database().prepare("SELECT id, content_id AS contentId, display_name AS displayName, body, created_at AS createdAt FROM comments ORDER BY id DESC LIMIT 200"),
    database().prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'view'"),
    database().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM analytics_events WHERE event_type = 'payment'"),
    database().prepare(`SELECT COUNT(*) AS count FROM library_items WHERE content_id IN (${mangaIds}) OR content_id IN (SELECT id FROM contents WHERE type != 'anime')`),
    database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1"),
    database().prepare("SELECT id, title, type, status, image, description, adult, episode_count AS episodeCount, created_at AS createdAt FROM contents ORDER BY created_at DESC"),
    database().prepare("SELECT facebook, instagram, youtube, discord, telegram FROM social_settings WHERE id = 1"),
  ]);
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, active FROM vip_packages ORDER BY id").all();
  const periodResults: Record<string, { views: number; users: number; revenue: number; bookmarks: number }> = {};
  for (const days of [1, 7, 30]) {
    const [pv, pu, pr, pb] = await database().batch([
      database().prepare("SELECT COUNT(*) AS n FROM analytics_events WHERE event_type='view' AND created_at >= datetime('now', ?)").bind(`-${days} day`),
      database().prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', ?)").bind(`-${days} day`),
      database().prepare("SELECT COALESCE(SUM(amount),0) AS n FROM analytics_events WHERE event_type='payment' AND created_at >= datetime('now', ?)").bind(`-${days} day`),
      database().prepare("SELECT COUNT(*) AS n FROM library_items WHERE created_at >= datetime('now', ?)").bind(`-${days} day`),
    ]);
    periodResults[String(days)] = { views: Number((pv.results[0] as { n?: number })?.n || 0), users: Number((pu.results[0] as { n?: number })?.n || 0), revenue: Number((pr.results[0] as { n?: number })?.n || 0), bookmarks: Number((pb.results[0] as { n?: number })?.n || 0) };
  }
  return c.json({ users: users.results, comments: comments.results, packages: packages.results, vip: vip.results[0], contents: contents.results, social: social.results[0], periods: periodResults, analytics: { visits: Number((views.results[0] as { count?: number })?.count || 0), users: users.results.length, revenue: Number((revenue.results[0] as { total?: number })?.total || 0), bookmarks: Number((bookmarks.results[0] as { count?: number })?.count || 0) } });
});

api.get("/admin/anilist", async (c) => {
  await ensureUser(c.req.raw);
  const id = Number(c.req.query("id")); const type = c.req.query("type") === "anime" ? "ANIME" : "MANGA";
  const response = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: `query($id:Int,$type:MediaType){Media(id:$id,type:$type){id title{romaji english native} description(asHtml:false) status startDate{year} averageScore genres coverImage{extraLarge} isAdult}}`, variables: { id, type } }) });
  if (!response.ok) return c.json({ error: "AniList import амжилтгүй" }, 400);
  const json = await response.json() as { data?: { Media?: Record<string, any> } }; return c.json({ item: json.data?.Media });
});

api.post("/admin/content", async (c) => {
  await ensureUser(c.req.raw);
  const item = await c.req.json<{ id?: string; title: string; originalTitle?: string; type: string; status: string; year?: number; rating?: number; genres?: string; image?: string; description?: string; adult?: boolean; anilistId?: number }>();
  const id = (item.id || item.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `content-${Date.now()}`;
  await database().prepare("INSERT INTO contents (id,title,original_title,type,status,year,episode_count,rating,genres,image,description,adult,anilist_id) VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?)").bind(id, item.title, item.originalTitle || item.title, item.type, item.status, item.year || new Date().getFullYear(), item.rating || 0, item.genres || "", item.image || "https://placehold.co/600x900/15171d/78859a?text=ZURAAS", item.description || "", item.adult ? 1 : 0, item.anilistId || null).run();
  return c.json({ ok: true, id });
});

api.get("/admin/content/:id", async (c) => { const content = await database().prepare("SELECT * FROM contents WHERE id=?").bind(c.req.param("id")).first(); const episodes = await database().prepare("SELECT id, number, access, publish_at AS publishAt, media_keys AS mediaKeys FROM episodes WHERE content_id=? ORDER BY number DESC").bind(c.req.param("id")).all(); return c.json({ content, episodes: episodes.results }); });

api.post("/admin/episode", async (c) => {
  await ensureUser(c.req.raw);
  const form = await c.req.parseBody({ all: true }); const contentId = String(form.contentId || ""); const number = Number(form.number); const access = String(form.access || "registered"); const publishAt = form.publishAt ? String(form.publishAt) : null;
  const rawFiles = form.files; const files = (Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : []).filter((file): file is File => file instanceof File);
  const keys: string[] = [];
  for (const file of files) { const key = `${contentId}-${number}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`; await mediaBucket().put(key, file.stream(), { httpMetadata: { contentType: file.type } }); keys.push(key); }
  await database().batch([database().prepare("INSERT INTO episodes (content_id,number,access,publish_at,media_keys) VALUES (?,?,?,?,?)").bind(contentId, number, access, publishAt, JSON.stringify(keys)), database().prepare("UPDATE contents SET episode_count=episode_count+1 WHERE id=?").bind(contentId)]);
  return c.json({ ok: true, keys });
});

api.get("/media/:key", async (c) => { const object = await mediaBucket().get(c.req.param("key")); if (!object) return c.notFound(); const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); return new Response(object.body, { headers }); });

api.post("/admin/vip", async (c) => { await ensureUser(c.req.raw); const v = await c.req.json<{ bankName: string; accountNumber: string; accountHolder: string; promotion: string; globalDiscount: number; accentColor?: string }>(); await database().prepare("UPDATE vip_settings SET bank_name=?,account_number=?,account_holder=?,promotion=?,global_discount=?,accent_color=? WHERE id=1").bind(v.bankName, v.accountNumber, v.accountHolder, v.promotion, Number(v.globalDiscount) || 0, v.accentColor || "#8b6cf6").run(); return c.json({ ok: true }); });
api.post("/admin/package", async (c) => { await ensureUser(c.req.raw); const p = await c.req.json<{ name: string; durationDays: number; price: number }>(); await database().prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) VALUES (?,?,?,0,1)").bind(p.name, Number(p.durationDays), Number(p.price)).run(); return c.json({ ok: true }); });
api.put("/admin/package/:id",async(c)=>{const p=await c.req.json<{name:string;durationDays:number;price:number}>();await database().prepare("UPDATE vip_packages SET name=?,duration_days=?,price=? WHERE id=?").bind(p.name,Number(p.durationDays),Number(p.price),Number(c.req.param("id"))).run();return c.json({ok:true})});
api.delete("/admin/package/:id",async(c)=>{await database().prepare("DELETE FROM vip_packages WHERE id=?").bind(Number(c.req.param("id"))).run();return c.json({ok:true})});
api.post("/admin/grant-vip", async (c) => { await ensureUser(c.req.raw); const { email, days } = await c.req.json<{ email: string; days: number }>(); await database().prepare("UPDATE users SET vip_until=datetime(CASE WHEN vip_until > CURRENT_TIMESTAMP THEN vip_until ELSE CURRENT_TIMESTAMP END, ?) WHERE email=?").bind(`+${Number(days)} day`, email).run(); return c.json({ ok: true }); });
api.post("/admin/social", async (c) => { await ensureUser(c.req.raw); const s = await c.req.json<Record<string,string>>(); await database().prepare("UPDATE social_settings SET facebook=?,instagram=?,youtube=?,discord=?,telegram=? WHERE id=1").bind(s.facebook||"",s.instagram||"",s.youtube||"",s.discord||"",s.telegram||"").run(); return c.json({ ok: true }); });

export const GET = (request: Request) => api.fetch(request);
export const POST = (request: Request) => api.fetch(request);
export const PUT = (request: Request) => api.fetch(request);
export const DELETE = (request: Request) => api.fetch(request);
