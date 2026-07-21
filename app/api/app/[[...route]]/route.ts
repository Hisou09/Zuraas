import { Hono } from "hono";
import { database, ensureSchema, ensureUser, isAdmin, mediaBucket } from "../../../../db/runtime";
import { catalog } from "../../../data/catalog";

const api = new Hono().basePath("/api/app");
api.use("*", async (_c, next) => { await ensureSchema(); await next(); });
api.use("/admin",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});
api.use("/admin/*",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});

const DEVICE_COOKIE="zuraas_device";
function cookieValue(request:Request,name:string){const raw=request.headers.get("cookie")||"";for(const part of raw.split(";")){const [key,...value]=part.trim().split("=");if(key===name)return decodeURIComponent(value.join("="));}return null;}
function deviceLabel(userAgent:string){const browser=/Edg\//.test(userAgent)?"Microsoft Edge":/Firefox\//.test(userAgent)?"Firefox":/Chrome\//.test(userAgent)?"Google Chrome":/Safari\//.test(userAgent)?"Safari":"Browser";const os=/Windows/.test(userAgent)?"Windows":/Android/.test(userAgent)?"Android":/iPhone|iPad/.test(userAgent)?"iPhone / iPad":/Mac OS/.test(userAgent)?"macOS":/Linux/.test(userAgent)?"Linux":"Төхөөрөмж";return `${browser} · ${os}`;}
function setDeviceCookie(c:any,id:string,maxAge=31536000){const secure=new URL(c.req.url).protocol==="https:"?"; Secure":"";c.header("Set-Cookie",`${DEVICE_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`);}
async function trackDevice(c:any,email:string){let id=cookieValue(c.req.raw,DEVICE_COOKIE);const db=database();if(id){const existing=await db.prepare("SELECT user_email AS userEmail,revoked_at AS revokedAt FROM user_devices WHERE device_id=?").bind(id).first<{userEmail:string;revokedAt:string|null}>();if(existing?.revokedAt){setDeviceCookie(c,"",0);return{id,revoked:true};}if(existing&&existing.userEmail!==email)id=null;}if(!id){id=crypto.randomUUID();setDeviceCookie(c,id);}const userAgent=c.req.header("user-agent")||"";await db.prepare("INSERT INTO user_devices (device_id,user_email,label,user_agent) VALUES (?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET label=excluded.label,user_agent=excluded.user_agent,last_seen_at=CURRENT_TIMESTAMP").bind(id,email,deviceLabel(userAgent),userAgent).run();return{id,revoked:false};}
const mediaUrl=(key:string|null|undefined)=>key?`/api/app/media/${encodeURIComponent(key)}`:null;

api.get("/session", async (c) => {
  const user = await ensureUser(c.req.raw);
  const device=await trackDevice(c,user.email);if(device.revoked)return c.json({error:"Төхөөрөмжөөс гарсан"},401);
  const profile = await database().prepare("SELECT usercode, vip_until AS vipUntil, role,COALESCE(contact_email,email) AS contactEmail,avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email = ?").bind(user.email).first<any>();
  const notifications = await database().prepare("SELECT id, title, body, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_email = ? ORDER BY id DESC LIMIT 8").bind(user.email).all();
  return c.json({ user: { ...user, ...profile,avatarUrl:mediaUrl(profile?.avatarKey),coverUrl:mediaUrl(profile?.coverKey) }, notifications: notifications.results });
});

api.get("/settings",async(c)=>{if(!c.req.header("oai-authenticated-user-email"))return c.json({error:"Нэвтрэх шаардлагатай"},401);const user=await ensureUser(c.req.raw);const device=await trackDevice(c,user.email);if(device.revoked)return c.json({error:"Төхөөрөмжөөс гарсан"},401);const [profile,devices,history]=await database().batch([database().prepare("SELECT display_name AS displayName,email AS authEmail,COALESCE(contact_email,email) AS contactEmail,usercode,vip_until AS vipUntil,avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email=?").bind(user.email),database().prepare("SELECT device_id AS deviceId,label,created_at AS createdAt,last_seen_at AS lastSeenAt FROM user_devices WHERE user_email=? AND revoked_at IS NULL ORDER BY last_seen_at DESC").bind(user.email),database().prepare("SELECT id,days,source,granted_at AS grantedAt,expires_at AS expiresAt FROM vip_history WHERE user_email=? ORDER BY id DESC LIMIT 100").bind(user.email)]);const value=profile.results[0] as any;return c.json({profile:{...value,avatarUrl:mediaUrl(value?.avatarKey),coverUrl:mediaUrl(value?.coverKey)},devices:devices.results,currentDeviceId:device.id,payments:history.results});});
api.post("/settings/profile",async(c)=>{if(!c.req.header("oai-authenticated-user-email"))return c.json({error:"Нэвтрэх шаардлагатай"},401);const user=await ensureUser(c.req.raw);const form=await c.req.parseBody({all:true});const displayName=String(Array.isArray(form.displayName)?form.displayName[0]:form.displayName||"").trim();const contactEmail=String(Array.isArray(form.contactEmail)?form.contactEmail[0]:form.contactEmail||"").trim().toLowerCase();if(displayName.length<2||displayName.length>50)return c.json({error:"Хэрэглэгчийн нэр 2-50 тэмдэгт байна"},400);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return c.json({error:"Имэйл хаяг буруу байна"},400);const old=await database().prepare("SELECT avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email=?").bind(user.email).first<{avatarKey:string|null;coverKey:string|null}>();const firstFile=(value:unknown)=>{const item=Array.isArray(value)?value[0]:value;return item instanceof File&&item.size>0?item:null};const saveImage=async(file:File|null,prefix:string)=>{if(!file)return null;if(!file.type.startsWith("image/"))throw new Error("Зөвхөн зураг оруулна");if(file.size>8*1024*1024)throw new Error("Зураг 8MB-аас бага байна");const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-zA-Z0-9]/g,"");const key=`${prefix}-${crypto.randomUUID()}.${ext}`;await mediaBucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});return key};try{const avatarKey=await saveImage(firstFile(form.avatar),"avatar");const coverKey=await saveImage(firstFile(form.cover),"cover");await database().prepare("UPDATE users SET display_name=?,contact_email=?,avatar_key=COALESCE(?,avatar_key),cover_key=COALESCE(?,cover_key) WHERE email=?").bind(displayName,contactEmail,avatarKey,coverKey,user.email).run();if(avatarKey&&old?.avatarKey)await mediaBucket().delete(old.avatarKey);if(coverKey&&old?.coverKey)await mediaBucket().delete(old.coverKey);return c.json({ok:true});}catch(error){return c.json({error:error instanceof Error?error.message:"Зураг хадгалахад алдаа гарлаа"},400)}});
api.post("/settings/devices/logout-others",async(c)=>{if(!c.req.header("oai-authenticated-user-email"))return c.json({error:"Нэвтрэх шаардлагатай"},401);const user=await ensureUser(c.req.raw);const device=await trackDevice(c,user.email);await database().prepare("UPDATE user_devices SET revoked_at=CURRENT_TIMESTAMP WHERE user_email=? AND device_id<>? AND revoked_at IS NULL").bind(user.email,device.id).run();return c.json({ok:true});});

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
api.post("/reports", async (c) => { const user = await ensureUser(c.req.raw); const report = await c.req.json<{ contentId: string; chapterNumber: number; issueType: string; details?: string }>(); const allowed=["Зураг ачаалахгүй байна","Зургууд дутуу / Дараалал алдагдсан","Буруу бүлэг орсон байна","Орчуулга эсвэл текстийн алдаатай","Бусад асуудал"];if(!report.contentId||!Number.isFinite(Number(report.chapterNumber))||!allowed.includes(report.issueType))return c.json({error:"Мэдээлэл дутуу байна"},400);await database().prepare("INSERT INTO error_reports (content_id,chapter_number,user_email,issue_type,details) VALUES (?,?,?,?,?)").bind(report.contentId,Number(report.chapterNumber),user.email,report.issueType,String(report.details||"").trim().slice(0,1000)).run();return c.json({ok:true}); });

api.get("/vip", async (c) => {
  const settings = await database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1").first();
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, active FROM vip_packages WHERE active = 1 ORDER BY price").all();
  return c.json({ settings, packages: packages.results });
});
api.get("/social", async (c) => { const value = await database().prepare("SELECT facebook,instagram,youtube,discord,telegram FROM social_settings WHERE id=1").first(); return c.json({ social: value }); });

api.get("/admin", async (c) => {
  await ensureUser(c.req.raw);
  const mangaIds = catalog.filter((item) => item.type !== "anime").map((item) => `'${item.id.replaceAll("'", "''")}'`).join(",") || "''";
  const [users, comments, reports, views, revenue, bookmarks, vip, contents, social] = await database().batch([
    database().prepare("SELECT id, email, display_name AS displayName, role, usercode, vip_until AS vipUntil, created_at AS createdAt FROM users ORDER BY id DESC LIMIT 200"),
    database().prepare("SELECT id, content_id AS contentId, display_name AS displayName, body, created_at AS createdAt FROM comments ORDER BY id DESC LIMIT 200"),
    database().prepare("SELECT r.id, r.content_id AS contentId, c.title AS contentTitle, r.chapter_number AS chapterNumber, r.user_email AS userEmail, r.issue_type AS issueType, r.details, r.status, r.created_at AS createdAt FROM error_reports r LEFT JOIN contents c ON c.id=r.content_id ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END, r.id DESC LIMIT 300"),
    database().prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'view'"),
    database().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM analytics_events WHERE event_type = 'payment'"),
    database().prepare(`SELECT COUNT(*) AS count FROM library_items WHERE content_id IN (${mangaIds}) OR content_id IN (SELECT id FROM contents WHERE type != 'anime')`),
    database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1"),
    database().prepare("SELECT id, title, type, status, genres, image, description, adult, episode_count AS episodeCount, created_at AS createdAt FROM contents ORDER BY created_at DESC"),
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
  const genreCounts = new Map<string, number>();
  for (const row of contents.results as { genres?: string }[]) {
    for (const genre of String(row.genres || "").split(",").map((value) => value.trim()).filter(Boolean)) {
      const current = [...genreCounts.keys()].find((value) => value.toLocaleLowerCase() === genre.toLocaleLowerCase()) || genre;
      genreCounts.set(current, (genreCounts.get(current) || 0) + 1);
    }
  }
  const genres = [...genreCounts.entries()].map(([name, contentCount]) => ({ name, contentCount })).sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ users: users.results, comments: comments.results, reports: reports.results, packages: packages.results, vip: vip.results[0], contents: contents.results, genres, social: social.results[0], periods: periodResults, analytics: { visits: Number((views.results[0] as { count?: number })?.count || 0), users: users.results.length, revenue: Number((revenue.results[0] as { total?: number })?.total || 0), bookmarks: Number((bookmarks.results[0] as { count?: number })?.count || 0) } });
});

api.put("/admin/report/:id", async (c) => {
  const { status } = await c.req.json<{ status: "open" | "resolved" }>();
  if (!['open', 'resolved'].includes(status)) return c.json({ error: "Төлөв буруу байна" }, 400);
  const result = await database().prepare("UPDATE error_reports SET status=? WHERE id=?").bind(status, Number(c.req.param("id"))).run();
  return c.json({ ok: true, changed: result.meta.changes });
});

api.delete("/admin/genre", async (c) => {
  await ensureUser(c.req.raw);
  const name = String(c.req.query("name") || "").trim();
  if (!name) return c.json({ error: "Төрлийн нэр шаардлагатай" }, 400);
  const rows = await database().prepare("SELECT id, genres FROM contents WHERE genres != ''").all<{ id: string; genres: string }>();
  const updates = rows.results.flatMap((row) => {
    const next = String(row.genres || "").split(",").map((value) => value.trim()).filter(Boolean).filter((value) => value.toLocaleLowerCase() !== name.toLocaleLowerCase()).join(", ");
    return next === row.genres ? [] : [database().prepare("UPDATE contents SET genres=? WHERE id=?").bind(next, row.id)];
  });
  if (updates.length) await database().batch(updates);
  return c.json({ ok: true, updated: updates.length });
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
api.post("/admin/grant-vip", async (c) => { const admin=await ensureUser(c.req.raw); const { email, days } = await c.req.json<{ email: string; days: number }>();const safeDays=Math.max(1,Number(days)||1);await database().batch([database().prepare("UPDATE users SET vip_until=datetime(CASE WHEN vip_until > CURRENT_TIMESTAMP THEN vip_until ELSE CURRENT_TIMESTAMP END, ?) WHERE email=?").bind(`+${safeDays} day`, email),database().prepare("INSERT INTO vip_history (user_email,days,source,granted_by,expires_at) SELECT ?,?,'admin',?,vip_until FROM users WHERE email=?").bind(email,safeDays,admin.email,email)]); return c.json({ ok: true }); });
api.post("/admin/social", async (c) => { await ensureUser(c.req.raw); const s = await c.req.json<Record<string,string>>(); await database().prepare("UPDATE social_settings SET facebook=?,instagram=?,youtube=?,discord=?,telegram=? WHERE id=1").bind(s.facebook||"",s.instagram||"",s.youtube||"",s.discord||"",s.telegram||"").run(); return c.json({ ok: true }); });

export const GET = (request: Request) => api.fetch(request);
export const POST = (request: Request) => api.fetch(request);
export const PUT = (request: Request) => api.fetch(request);
export const DELETE = (request: Request) => api.fetch(request);
