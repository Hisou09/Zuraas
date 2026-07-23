import { Hono } from "hono";
import { database, ensureSchema, isAdminEmail, mediaBucket } from "../../../../db/runtime";
import { authenticateRequest, ensureUser, isAdmin, newUsercode } from "../../../../db/auth";
import { checkR2Connection, createEpisodeObjectKey, createR2PresignedRead, createR2PresignedUpload, deleteR2Object, isEpisodeObjectKey, verifyR2Upload } from "../../../../db/r2-s3";
import { catalog } from "../../../data/catalog";
import { timestampMs } from "../../../../db/datetime";

const api = new Hono().basePath("/api/app");
api.use("*", async (c, next) => {
  await ensureSchema();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("Cache-Control", "private, no-store");
  const authenticated=await authenticateRequest(c.req.raw);
  if(!authenticated)return c.json({error:"Нэвтрэх шаардлагатай"},401);
  if(!["GET","HEAD","OPTIONS"].includes(c.req.method)){
    const fetchSite=c.req.header("sec-fetch-site");
    const origin=c.req.header("origin");
    const expectedOrigin=new URL(c.req.url).origin;
    if(fetchSite==="cross-site"||(origin&&origin!==expectedOrigin))return c.json({error:"Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй"},403);
  }
  await next();
});
api.use("/admin",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});
api.use("/admin/*",async(c,next)=>{if(!await isAdmin(c.req.raw))return c.json({error:"Админ эрх шаардлагатай"},403);await next()});

const DEVICE_COOKIE="zuraas_device";
function cookieValue(request:Request,name:string){const raw=request.headers.get("cookie")||"";for(const part of raw.split(";")){const [key,...value]=part.trim().split("=");if(key===name)return decodeURIComponent(value.join("="));}return null;}
function deviceLabel(userAgent:string){const browser=/Edg\//.test(userAgent)?"Edge":/Firefox\//.test(userAgent)?"Firefox":/Chrome\//.test(userAgent)?"Chrome":/Safari\//.test(userAgent)?"Safari":"Browser";const os=/Windows/.test(userAgent)?"Windows":/Android/.test(userAgent)?"Android":/iPhone/.test(userAgent)?"iPhone":/iPad/.test(userAgent)?"iPad":/Mac OS/.test(userAgent)?"macOS":/Linux/.test(userAgent)?"Linux":"Device";return `${browser} on ${os}`;}
function requestIp(request:Request){const cloudflare=request.headers.get("cf-connecting-ip")?.trim();if(cloudflare)return cloudflare;const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();if(forwarded)return forwarded;return request.headers.get("x-real-ip")?.trim()||"Local";}
function setDeviceCookie(c:any,id:string,maxAge=31536000){const secure=new URL(c.req.url).protocol==="https:"?"; Secure":"";c.header("Set-Cookie",`${DEVICE_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`);}
async function trackDevice(c:any,email:string){let id=cookieValue(c.req.raw,DEVICE_COOKIE);const db=database();if(id){const existing=await db.prepare("SELECT user_email AS userEmail,revoked_at AS revokedAt FROM user_devices WHERE device_id=?").bind(id).first<{userEmail:string;revokedAt:string|null}>();if(existing?.revokedAt){setDeviceCookie(c,"",0);return{id,revoked:true};}if(existing&&existing.userEmail!==email)id=null;}if(!id){id=crypto.randomUUID();setDeviceCookie(c,id);}const userAgent=c.req.header("user-agent")||"";const ip=requestIp(c.req.raw);await db.prepare("INSERT INTO user_devices (device_id,user_email,label,user_agent,last_ip) VALUES (?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET label=excluded.label,user_agent=excluded.user_agent,last_ip=excluded.last_ip,last_seen_at=CURRENT_TIMESTAMP").bind(id,email,deviceLabel(userAgent),userAgent,ip).run();return{id,revoked:false};}
const isRemoteMedia=(value:string|null|undefined)=>Boolean(value&&/^https?:\/\//i.test(value));
const mediaUrl=(key:string|null|undefined)=>key?(isRemoteMedia(key)?key:`/api/app/media/${encodeURIComponent(key)}`):null;
type ProfileMediaRow={
  id:unknown;
  title:unknown;
  image?:unknown;
  bannerImage?:unknown;
  characters:unknown;
};
type ProfileMediaOption={id:string;url:string;title:string;kind:"character"|"cover"|"banner"};
function parseCharacters(value:unknown){
  if(!value)return[] as Array<{role?:unknown;node?:{name?:{full?:unknown};image?:{large?:unknown}}}>;
  try{
    const parsed=typeof value==="string"?JSON.parse(value):value;
    const edges=Array.isArray(parsed)?parsed:(parsed&&typeof parsed==="object"&&Array.isArray((parsed as any).edges)?(parsed as any).edges:[]);
    return edges as Array<{role?:unknown;node?:{name?:{full?:unknown};image?:{large?:unknown}}}>;
  }catch{return[] as Array<{role?:unknown;node?:{name?:{full?:unknown};image?:{large?:unknown}}}>}
}
function profileMediaOptions(rows:ProfileMediaRow[]){
  const avatars:ProfileMediaOption[]=[];
  const covers:ProfileMediaOption[]=[];
  const avatarUrls=new Set<string>();
  const coverUrls=new Set<string>();
  const add=(target:ProfileMediaOption[],seen:Set<string>,option:ProfileMediaOption)=>{
    if(!/^https?:\/\//i.test(option.url)||seen.has(option.url))return;
    seen.add(option.url);
    target.push(option);
  };
  for(const row of rows){
    const contentId=String(row.id||"");
    const title=String(row.title||"Бүтээл");
    add(covers,coverUrls,{
      id:`cover-${contentId}`,
      url:String(row.image||"").trim(),
      title,
      kind:"cover",
    });
    add(covers,coverUrls,{
      id:`banner-${contentId}`,
      url:String(row.bannerImage||"").trim(),
      title,
      kind:"banner",
    });
    parseCharacters(row.characters).forEach((edge,index)=>{
      const url=String(edge?.node?.image?.large||"").trim();
      const name=String(edge?.node?.name?.full||title);
      const option={id:`character-${contentId}-${index}`,url,title:name,kind:"character" as const};
      add(avatars,avatarUrls,option);
    });
  }
  return{avatars:avatars.slice(0,160),covers:covers.slice(0,100)};
}
type DirectUpload={key:string;size:number;type:string};
const directUploads=(value:unknown):DirectUpload[]=>Array.isArray(value)?value.map(item=>({key:String(item?.key||""),size:Number(item?.size),type:String(item?.type||"")})):[];
const validEpisodeFiles=(files:DirectUpload[],type:string)=>files.length>0&&(type!=="anime"||files.length===1)&&files.every(file=>file.key&&Number.isFinite(file.size)&&file.size>0&&file.size<=(type==="anime"?1024*1024*1024:25*1024*1024)&&(type==="anime"?file.type.startsWith("video/"):file.type.startsWith("image/")));
async function deleteStoredMedia(keys:string[]){
  const uniqueKeys=[...new Set(keys.filter(Boolean))];
  await Promise.all(uniqueKeys.map(key=>deleteR2Object(key)));
}

api.get("/session", async (c) => {
  const user = await ensureUser(c.req.raw);
  const device=await trackDevice(c,user.email);if(device.revoked)return c.json({error:"Төхөөрөмжөөс гарсан"},401);
  let profile = await database().prepare("SELECT usercode, vip_until AS vipUntil, role,COALESCE(contact_email,email) AS contactEmail,avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email = ?").bind(user.email).first<any>();
  if(!profile?.usercode){
    const code=newUsercode();
    await database().prepare("UPDATE users SET usercode=? WHERE email=? AND (usercode IS NULL OR usercode='')").bind(code,user.email).run();
    profile={...profile,usercode:code};
  }
  const notifications = await database().prepare("SELECT id, title, body, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_email = ? ORDER BY id DESC LIMIT 8").bind(user.email).all();
  return c.json({ user: { ...user, ...profile,avatarUrl:mediaUrl(profile?.avatarKey),coverUrl:mediaUrl(profile?.coverKey) }, notifications: notifications.results });
});

api.post("/notifications/read-all", async (c) => {
  const user = await ensureUser(c.req.raw);
  await database().prepare("UPDATE notifications SET is_read=1 WHERE user_email=? AND is_read=0").bind(user.email).run();
  return c.json({ ok: true });
});

api.post("/notifications/:id/read", async (c) => {
  const user = await ensureUser(c.req.raw);
  const id=Number(c.req.param("id"));
  if(!Number.isInteger(id)||id<1)return c.json({error:"Мэдэгдэл буруу байна"},400);
  await database().prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_email=?").bind(id,user.email).run();
  return c.json({ok:true});
});

api.get("/settings",async(c)=>{
  const user=await ensureUser(c.req.raw);
  const device=await trackDevice(c,user.email);
  if(device.revoked)return c.json({error:"Төхөөрөмжөөс гарсан"},401);
  const [profile,devices,history,contentMedia]=await database().batch([
    database().prepare("SELECT display_name AS displayName,email AS authEmail,COALESCE(contact_email,email) AS contactEmail,usercode,vip_until AS vipUntil,avatar_key AS avatarKey,cover_key AS coverKey,CASE WHEN password_hash IS NOT NULL AND password_hash<>'' THEN 1 ELSE 0 END AS canChangePassword FROM users WHERE email=?").bind(user.email),
    database().prepare("SELECT device_id AS deviceId,label,last_ip AS lastIp,created_at AS createdAt,last_seen_at AS lastSeenAt FROM user_devices WHERE user_email=? AND revoked_at IS NULL ORDER BY last_seen_at DESC").bind(user.email),
    database().prepare("SELECT id,days,source,granted_at AS grantedAt,expires_at AS expiresAt FROM vip_history WHERE user_email=? ORDER BY id DESC LIMIT 100").bind(user.email),
    database().prepare("SELECT id,title,image,banner_image AS bannerImage,characters FROM contents ORDER BY created_at DESC LIMIT 160"),
  ]);
  const value=profile.results[0] as any;
  return c.json({
    profile:{...value,canChangePassword:Boolean(value?.canChangePassword),avatarUrl:mediaUrl(value?.avatarKey),coverUrl:mediaUrl(value?.coverKey)},
    devices:devices.results,
    currentDeviceId:device.id,
    payments:history.results,
    mediaOptions:profileMediaOptions(contentMedia.results as ProfileMediaRow[]),
  });
});
api.post("/settings/profile",async(c)=>{
  const user=await ensureUser(c.req.raw);
  const form=await c.req.parseBody({all:true});
  const formValue=(value:unknown)=>String(Array.isArray(value)?value[0]:value||"").trim();
  const displayName=formValue(form.displayName);
  const contactEmail=formValue(form.contactEmail).toLowerCase();
  const avatarSource=formValue(form.avatarSource);
  const coverSource=formValue(form.coverSource);
  if(displayName.length<2||displayName.length>50)return c.json({error:"Хэрэглэгчийн нэр 2-50 тэмдэгт байна"},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return c.json({error:"Имэйл хаяг буруу байна"},400);
  const old=await database().prepare("SELECT avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email=?").bind(user.email).first<{avatarKey:string|null;coverKey:string|null}>();
  try{
    let allowedAvatars=new Set<string>();
    let allowedCovers=new Set<string>();
    if(avatarSource||coverSource){
      const rows=await database().prepare("SELECT id,title,image,banner_image AS bannerImage,characters FROM contents ORDER BY created_at DESC LIMIT 160").all();
      const options=profileMediaOptions(rows.results as ProfileMediaRow[]);
      allowedAvatars=new Set(options.avatars.map(option=>option.url));
      allowedCovers=new Set(options.covers.map(option=>option.url));
    }
    if(avatarSource&&!allowedAvatars.has(avatarSource))throw new Error("Сонгосон дүрийн зураг бүтээлийн санд олдсонгүй");
    if(coverSource&&!allowedCovers.has(coverSource))throw new Error("Сонгосон ковер зураг бүтээлийн санд олдсонгүй");
    await database().prepare("UPDATE users SET display_name=?,contact_email=?,avatar_key=COALESCE(NULLIF(?,''),avatar_key),cover_key=COALESCE(NULLIF(?,''),cover_key) WHERE email=?").bind(displayName,contactEmail,avatarSource,coverSource,user.email).run();
    if(avatarSource&&old?.avatarKey&&!isRemoteMedia(old.avatarKey))await mediaBucket().delete(old.avatarKey).catch(()=>undefined);
    if(coverSource&&old?.coverKey&&!isRemoteMedia(old.coverKey))await mediaBucket().delete(old.coverKey).catch(()=>undefined);
    const profile=await database().prepare("SELECT email,display_name AS displayName,contact_email AS contactEmail,avatar_key AS avatarKey,cover_key AS coverKey FROM users WHERE email=?").bind(user.email).first<{email:string;displayName:string;contactEmail:string;avatarKey:string|null;coverKey:string|null}>();
    return c.json({ok:true,profile:profile?{email:profile.email,displayName:profile.displayName,contactEmail:profile.contactEmail,avatarUrl:mediaUrl(profile.avatarKey),coverUrl:mediaUrl(profile.coverKey)}:null});
  }catch(error){
    return c.json({error:error instanceof Error?error.message:"Зураг хадгалахад алдаа гарлаа"},400);
  }
});
api.post("/settings/devices/logout-others",async(c)=>{const user=await ensureUser(c.req.raw);const device=await trackDevice(c,user.email);await database().prepare("UPDATE user_devices SET revoked_at=CURRENT_TIMESTAMP WHERE user_email=? AND device_id<>? AND revoked_at IS NULL").bind(user.email,device.id).run();return c.json({ok:true});});
api.post("/settings/devices/:deviceId/logout",async(c)=>{const user=await ensureUser(c.req.raw);const current=await trackDevice(c,user.email);const deviceId=c.req.param("deviceId");if(!deviceId)return c.json({error:"Төхөөрөмж сонгоно уу"},400);if(deviceId===current.id)return c.json({error:"Одоогийн төхөөрөмжийг эндээс гаргах боломжгүй"},400);await database().prepare("UPDATE user_devices SET revoked_at=CURRENT_TIMESTAMP WHERE user_email=? AND device_id=? AND revoked_at IS NULL").bind(user.email,deviceId).run();return c.json({ok:true});});

api.get("/user-items", async (c) => {
  const user = await ensureUser(c.req.raw);
  const history = c.req.query("kind") === "history";
  const historyQuery = "SELECT h.content_id AS contentId, h.progress, COALESCE(h.page_index,0) AS pageIndex, h.updated_at AS date, (SELECT COUNT(*) FROM episodes e WHERE e.content_id=h.content_id AND (e.publish_at IS NULL OR datetime(e.publish_at)<=CURRENT_TIMESTAMP)) AS total FROM watch_history h WHERE h.user_email = ? ORDER BY h.updated_at DESC";
  const libraryQuery = `
    SELECT
      l.content_id AS contentId,
      COALESCE(h.progress, 0) AS progress,
      COALESCE(h.page_index, 0) AS pageIndex,
      l.created_at AS date,
      (
        SELECT COUNT(*)
        FROM episodes e
        WHERE e.content_id = l.content_id
          AND (e.publish_at IS NULL OR datetime(e.publish_at) <= CURRENT_TIMESTAMP)
      ) AS total,
      (
        SELECT COUNT(*)
        FROM episodes e
        WHERE e.content_id = l.content_id
          AND (e.publish_at IS NULL OR datetime(e.publish_at) <= CURRENT_TIMESTAMP)
          AND e.number > COALESCE(h.progress, 0)
      ) AS unread,
      (
        SELECT MIN(e.number)
        FROM episodes e
        WHERE e.content_id = l.content_id
          AND (e.publish_at IS NULL OR datetime(e.publish_at) <= CURRENT_TIMESTAMP)
          AND e.number > COALESCE(h.progress, 0)
      ) AS nextProgress
    FROM library_items l
    LEFT JOIN watch_history h
      ON h.user_email = l.user_email
      AND h.content_id = l.content_id
    WHERE l.user_email = ?
    ORDER BY l.id DESC
  `;
  const result = await database().prepare(history ? historyQuery : libraryQuery).bind(user.email).all();
  return c.json({ items: result.results });
});

api.post("/library", async (c) => { const user = await ensureUser(c.req.raw); const { contentId } = await c.req.json<{ contentId: string }>(); if(!contentId)return c.json({error:"Бүтээл сонгоно уу"},400);const content=await database().prepare("SELECT type FROM contents WHERE id=?").bind(contentId).first<{type:string}>();if(!content)return c.json({error:"Бүтээл олдсонгүй"},404);if(content.type==="anime")return c.json({error:"Зөвхөн манхваг санд хадгална"},400); await database().prepare("INSERT OR IGNORE INTO library_items (user_email, content_id) VALUES (?, ?)").bind(user.email, contentId).run(); return c.json({ ok: true }); });
api.delete("/library", async (c) => { const user = await ensureUser(c.req.raw); await database().prepare("DELETE FROM library_items WHERE user_email = ? AND content_id = ?").bind(user.email, c.req.query("contentId") ?? "").run(); return c.json({ ok: true }); });
api.get("/entry-reads", async (c) => {
  const user = await ensureUser(c.req.raw);
  const contentId = String(c.req.query("contentId") || "").trim();
  if (!contentId) return c.json({ error: "Content ID required" }, 400);
  const result = await database()
    .prepare("SELECT entry_number AS entryNumber FROM entry_reads WHERE user_email=? AND content_id=? ORDER BY entry_number")
    .bind(user.email, contentId)
    .all<{ entryNumber: number }>();
  return c.json({ entries: result.results });
});
api.post("/history", async (c) => {
  const user = await ensureUser(c.req.raw);
  const { contentId, progress = 1 } = await c.req.json<{ contentId: string; progress?: number }>();
  const safeProgress=Math.max(1,Number(progress)||1);
  const access=await database().prepare("SELECT c.type,e.access FROM contents c LEFT JOIN episodes e ON e.content_id=c.id AND e.number=? WHERE c.id=? LIMIT 1").bind(safeProgress,contentId).first<{type:string;access:string|null}>();
  if(!access||!access.access)return c.json({error:"Анги эсвэл бүлэг олдсонгүй"},404);
  const requiresVip=access?.type==="anime"||access?.access==="vip";
  if(requiresVip&&user.role!=="admin"){
    const profile=await database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(user.email).first<{vipUntil:unknown}>();
    const vipUntil=timestampMs(profile?.vipUntil);
    if(vipUntil<=Date.now())return c.json({error:"VIP эрх шаардлагатай"},403);
  }
  await database().batch([
    database().prepare("INSERT INTO watch_history (user_email, content_id, progress, page_index, updated_at) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP) ON CONFLICT(user_email, content_id) DO UPDATE SET page_index = CASE WHEN watch_history.progress = excluded.progress THEN watch_history.page_index ELSE 0 END, progress = excluded.progress, updated_at = CURRENT_TIMESTAMP").bind(user.email,contentId,safeProgress),
    database().prepare("INSERT INTO entry_reads (user_email, content_id, entry_number, read_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_email, content_id, entry_number) DO UPDATE SET read_at=CURRENT_TIMESTAMP").bind(user.email,contentId,safeProgress),
    database().prepare("INSERT INTO analytics_events (event_type, user_email) VALUES ('view', ?)").bind(user.email),
  ]);
  return c.json({ok:true});
});

api.post("/history-position", async (c) => {
  const user = await ensureUser(c.req.raw);
  const { contentId, progress, pageIndex } = await c.req.json<{ contentId: string; progress: number; pageIndex: number }>();
  const safeProgress=Math.max(1,Number(progress)||1);
  const safePageIndex=Math.max(0,Math.floor(Number(pageIndex)||0));
  if(!contentId)return c.json({error:"Content ID required"},400);
  await database().prepare("UPDATE watch_history SET page_index=?, updated_at=CURRENT_TIMESTAMP WHERE user_email=? AND content_id=? AND progress=?").bind(safePageIndex,user.email,contentId,safeProgress).run();
  return c.json({ok:true});
});

api.get("/comments", async (c) => { const result = await database().prepare("SELECT cm.id, cm.content_id AS contentId, cm.user_email AS userEmail, COALESCE(u.display_name,cm.display_name) AS displayName, cm.body, cm.created_at AS createdAt, u.avatar_key AS avatarKey FROM comments cm LEFT JOIN users u ON u.email=cm.user_email WHERE cm.content_id = ? ORDER BY cm.id DESC LIMIT 50").bind(c.req.query("contentId") ?? "").all(); const comments=(result.results as Record<string,unknown>[]).map(row=>({...row,avatarUrl:mediaUrl(row.avatarKey as string|null),avatarKey:undefined}));return c.json({ comments }); });
api.post("/comments", async (c) => { const user = await ensureUser(c.req.raw); const { contentId, body } = await c.req.json<{ contentId: string; body: string }>(); const text=body?.trim()||"";if (!text) return c.json({ error: "Сэтгэгдэл хоосон байна" }, 400);if(text.length>2000)return c.json({error:"Сэтгэгдэл 2000 тэмдэгтээс их байна"},400);const content=await database().prepare("SELECT 1 AS ok FROM contents WHERE id=?").bind(contentId).first();if(!content)return c.json({error:"Бүтээл олдсонгүй"},404);await database().prepare("INSERT INTO comments (content_id, user_email, display_name, body) VALUES (?, ?, ?, ?)").bind(contentId, user.email, user.displayName, text).run(); return c.json({ ok: true }); });
api.post("/reports", async (c) => { const user = await ensureUser(c.req.raw); const report = await c.req.json<{ contentId: string; chapterNumber: number; issueType: string; details?: string }>(); const allowed=["Зураг ачаалахгүй байна","Зургууд дутуу / Дараалал алдагдсан","Буруу бүлэг орсон байна","Орчуулга эсвэл текстийн алдаатай","Бусад асуудал"];if(!report.contentId||!Number.isFinite(Number(report.chapterNumber))||!allowed.includes(report.issueType))return c.json({error:"Мэдээлэл дутуу байна"},400);await database().prepare("INSERT INTO error_reports (content_id,chapter_number,user_email,issue_type,details) VALUES (?,?,?,?,?)").bind(report.contentId,Number(report.chapterNumber),user.email,report.issueType,String(report.details||"").trim().slice(0,1000)).run();return c.json({ok:true}); });

api.get("/vip", async (c) => {
  const settings = await database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1").first();
  const packages = await database().prepare("SELECT id, name, duration_days AS durationDays, price, active FROM vip_packages WHERE active = 1 ORDER BY price").all();
  return c.json({ settings, packages: packages.results });
});
api.get("/social", async (c) => { c.header("Cache-Control","private, max-age=300, stale-while-revalidate=600"); const value = await database().prepare("SELECT facebook,instagram,youtube,discord,telegram FROM social_settings WHERE id=1").first(); return c.json({ social: value }); });

api.get("/admin", async (c) => {
  await ensureUser(c.req.raw);
  const mangaIds = catalog.filter((item) => item.type !== "anime").map((item) => `'${item.id.replaceAll("'", "''")}'`).join(",") || "''";
  const [users, comments, reports, views, revenue, bookmarks, vip, contents, social, contentStats] = await database().batch([
    database().prepare("SELECT id, email, display_name AS displayName, role, usercode, vip_until AS vipUntil, created_at AS createdAt FROM users ORDER BY id DESC LIMIT 200"),
    database().prepare("SELECT cm.id, cm.content_id AS contentId, ct.title AS contentTitle, ct.image AS contentImage, cm.user_email AS userEmail, cm.display_name AS displayName, u.role AS userRole, u.avatar_key AS avatarKey, cm.body, cm.created_at AS createdAt FROM comments cm LEFT JOIN contents ct ON ct.id=cm.content_id LEFT JOIN users u ON u.email=cm.user_email ORDER BY cm.id DESC LIMIT 200"),
    database().prepare("SELECT r.id, r.content_id AS contentId, c.title AS contentTitle, r.chapter_number AS chapterNumber, r.user_email AS userEmail, r.issue_type AS issueType, r.details, r.status, r.created_at AS createdAt FROM error_reports r LEFT JOIN contents c ON c.id=r.content_id ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END, r.id DESC LIMIT 300"),
    database().prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'view'"),
    database().prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM analytics_events WHERE event_type = 'payment'"),
    database().prepare(`SELECT COUNT(*) AS count FROM library_items WHERE content_id IN (${mangaIds}) OR content_id IN (SELECT id FROM contents WHERE type != 'anime')`),
    database().prepare("SELECT bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, promotion, global_discount AS globalDiscount, accent_color AS accentColor FROM vip_settings WHERE id = 1"),
    database().prepare("SELECT id, title, original_title AS originalTitle, type, status, year, genres, image, banner_image AS bannerImage, characters, description, anilist_id AS anilistId, episode_count AS episodeCount, created_at AS createdAt FROM contents ORDER BY created_at DESC"),
    database().prepare("SELECT facebook, instagram, youtube, discord, telegram FROM social_settings WHERE id = 1"),
    database().prepare("SELECT COALESCE(SUM(CASE WHEN c.type='anime' THEN 1 ELSE 0 END),0) AS episodes, COALESCE(SUM(CASE WHEN c.type!='anime' THEN 1 ELSE 0 END),0) AS chapters FROM episodes e INNER JOIN contents c ON c.id=e.content_id"),
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
  const commentRows = (comments.results as Record<string, unknown>[]).map((row) => { const fallback = catalog.find((item) => item.id === row.contentId); return { ...row, contentTitle: row.contentTitle || fallback?.title || row.contentId, contentImage: row.contentImage || fallback?.image || null, avatarUrl: mediaUrl(row.avatarKey as string | null), avatarKey: undefined }; });
  const totals = contentStats.results[0] as { episodes?: number; chapters?: number } | undefined;
  return c.json({ users: users.results, comments: commentRows, reports: reports.results, packages: packages.results, vip: vip.results[0], contents: contents.results, genres, social: social.results[0], periods: periodResults, contentStats: { episodes: Number(totals?.episodes || 0), chapters: Number(totals?.chapters || 0) }, analytics: { visits: Number((views.results[0] as { count?: number })?.count || 0), users: users.results.length, revenue: Number((revenue.results[0] as { total?: number })?.total || 0), bookmarks: Number((bookmarks.results[0] as { count?: number })?.count || 0) } });
});

api.delete("/admin/comment/:id", async (c) => {
  const result = await database().prepare("DELETE FROM comments WHERE id=?").bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true, changed: result.meta.changes });
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
  const search = String(c.req.query("query") || "").trim(); const type = c.req.query("type") === "anime" ? "ANIME" : "MANGA";
  if (search.length < 2) return c.json({ error: "Хайх нэрээ оруулна уу" }, 400);
  const query = `query($search:String,$type:MediaType){Page(page:1,perPage:10){media(search:$search,type:$type,sort:SEARCH_MATCH){id title{romaji english native} description(asHtml:false) type status startDate{year} averageScore episodes chapters genres coverImage{extraLarge large} bannerImage countryOfOrigin characters(page:1,perPage:12,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full} image{large}}}}}}}`;
  const response = await fetch("https://graphql.anilist.co/", { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": "Zuraas/1.0 (admin catalog sync)" }, body: JSON.stringify({ query, variables: { search, type } }) });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("AniList search failed", response.status, detail.slice(0, 500));
    return c.json({ error: response.status === 429 ? "AniList хүсэлт түр хязгаарлагдлаа. Түр хүлээгээд дахин оролдоно уу." : `AniList холболт амжилтгүй (${response.status})` }, 502);
  }
  const json = await response.json() as { data?: { Page?: { media?: Record<string, any>[] } }; errors?: { message:string }[] };
  if (json.errors?.length) return c.json({ error: json.errors[0].message || "AniList хайлт амжилтгүй" }, 400);
  const items=(json.data?.Page?.media||[]).map(item=>({...item,siteType:item.type==="ANIME"?"anime":item.countryOfOrigin==="KR"?"manhwa":"manga"}));
  return c.json({ items });
});

api.post("/admin/content", async (c) => {
  await ensureUser(c.req.raw);
  const item = await c.req.json<{ id?: string; title: string; originalTitle?: string; type: string; status: string; year?: number; episodeCount?: number|string; rating?: number; genres?: string; image?: string; bannerImage?: string; characters?: string; description?: string; anilistId?: number }>();
  const title = String(item.title || "").trim();
  const status = String(item.status || "").trim();
  const type = String(item.type || "").trim();
  if (!title || !["anime", "manga", "manhwa"].includes(type) || !["Ongoing", "Completed", "Hiatus"].includes(status)) {
    return c.json({ error: "Бүтээлийн нэр, төрөл эсвэл төлөв буруу байна" }, 400);
  }
  const slug = (item.id || title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `content-${Date.now()}`;
  const existing = item.anilistId
    ? await database().prepare("SELECT id FROM contents WHERE anilist_id=? OR id=? LIMIT 1").bind(item.anilistId, slug).first<{ id: string }>()
    : await database().prepare("SELECT id FROM contents WHERE id=? LIMIT 1").bind(slug).first<{ id: string }>();
  const id = existing?.id || slug;
  const parsedEpisodeCount = Number(item.episodeCount);
  const episodeCount = Number.isFinite(parsedEpisodeCount) && parsedEpisodeCount > 0 ? Math.floor(parsedEpisodeCount) : 0;
  const values = [title, item.originalTitle || title, type, status, item.year || new Date().getFullYear(), episodeCount, item.rating || 0, item.genres || "", item.image || "https://placehold.co/600x900/15171d/78859a?text=ZURAAS", item.bannerImage || "", item.characters || "[]", item.description || "", item.anilistId || null] as const;
  if (existing) {
    await database().prepare("UPDATE contents SET title=?,original_title=?,type=?,status=?,year=?,episode_count=?,rating=?,genres=?,image=?,banner_image=?,characters=?,description=?,anilist_id=? WHERE id=?").bind(...values, id).run();
  } else {
    await database().prepare("INSERT INTO contents (id,title,original_title,type,status,year,episode_count,rating,genres,image,banner_image,characters,description,anilist_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, ...values).run();
  }
  return c.json({ ok: true, id, updated: Boolean(existing) });
});

api.get("/admin/content/:id", async (c) => { const content = await database().prepare("SELECT id,title,original_title AS originalTitle,type,status,year,genres,image,banner_image AS bannerImage,characters,description,anilist_id AS anilistId,episode_count AS episodeCount,created_at AS createdAt FROM contents WHERE id=?").bind(c.req.param("id")).first(); const episodes = await database().prepare("SELECT id, number, access, publish_at AS publishAt, media_keys AS mediaKeys, created_at AS createdAt FROM episodes WHERE content_id=? ORDER BY number DESC").bind(c.req.param("id")).all(); return c.json({ content, episodes: episodes.results }); });

api.put("/admin/content/:id", async (c) => {
  const item = await c.req.json<{ title: string; originalTitle?:string; type:string; status: string; year?:number; episodeCount?:number|string; genres?:string; image?:string; bannerImage?:string; characters?:string; description: string; anilistId?:number|null }>();
  const status = String(item.status || "").trim();
  if (!item.title?.trim() || !["anime","manga","manhwa"].includes(item.type) || !["Ongoing", "On-Going", "Completed", "Hiatus"].includes(status)) return c.json({ error: "Бүтээлийн мэдээлэл буруу байна" }, 400);
  const parsedEpisodeCount=Number(item.episodeCount);
  const episodeCount=item.episodeCount===undefined||String(item.episodeCount).trim()===""?null:Number.isFinite(parsedEpisodeCount)&&parsedEpisodeCount>0?Math.floor(parsedEpisodeCount):0;
  await database().prepare("UPDATE contents SET title=?,original_title=?,type=?,status=?,year=?,episode_count=COALESCE(?,episode_count),genres=?,image=?,banner_image=?,characters=?,description=?,anilist_id=? WHERE id=?").bind(item.title.trim(), String(item.originalTitle||item.title).trim(), item.type, status, Number(item.year)||new Date().getFullYear(), episodeCount, String(item.genres||"").trim(), String(item.image||"").trim(), String(item.bannerImage||"").trim(), String(item.characters||"[]"), String(item.description||"").trim(), item.anilistId||null, c.req.param("id")).run();
  return c.json({ ok: true });
});

api.delete("/admin/content/:id", async (c) => {
  const id = c.req.param("id");
  const episodeRows = await database().prepare("SELECT media_keys AS mediaKeys FROM episodes WHERE content_id=?").bind(id).all<{ mediaKeys: string }>();
  const keys = episodeRows.results.flatMap((row) => { try { return JSON.parse(row.mediaKeys || "[]") as string[]; } catch { return []; } });
  try{await deleteStoredMedia(keys)}
  catch(error){console.error("R2 content cleanup failed",error);return c.json({error:"R2 дээрх файл устгагдсангүй. Бүтээлийн мэдээллийг хэвээр үлдээлээ."},502)}
  await database().batch([
    database().prepare("DELETE FROM episodes WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM comments WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM error_reports WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM library_items WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM watch_history WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM entry_reads WHERE content_id=?").bind(id),
    database().prepare("DELETE FROM contents WHERE id=?").bind(id),
  ]);
  return c.json({ ok: true });
});

api.get("/admin/r2/status",async(c)=>{
  try{return c.json({ok:true,...await checkR2Connection()})}
  catch(error){console.error("R2 connection check failed",error);return c.json({ok:false,error:error instanceof Error?error.message:"R2 холболт амжилтгүй"},503)}
});

api.post("/admin/r2/upload-url",async(c)=>{
  try{
    const body=await c.req.json<{contentId:string;number:number;episodeId?:number;files:{name:string;type:string;size:number}[]}>();
    const contentId=String(body.contentId||"").trim();
    const number=Number(body.number);
    const content=await database().prepare("SELECT type FROM contents WHERE id=?").bind(contentId).first<{type:string}>();
    if(!content)return c.json({error:"Сонгосон бүтээл олдсонгүй"},404);
    if(!Number.isFinite(number)||number<=0)return c.json({error:"Анги, бүлгийн дугаар буруу байна"},400);
    const files=(Array.isArray(body.files)?body.files:[]).map((file,index)=>({name:String(file.name||"file"),type:String(file.type||""),size:Number(file.size),index}));
    const descriptors=files.map(file=>({key:createEpisodeObjectKey({contentId,number,fileName:file.name,index:file.index}),size:file.size,type:file.type}));
    if(!validEpisodeFiles(descriptors,content.type))return c.json({error:content.type==="anime"?"Нэг 1GB-аас бага видео сонгоно уу":"Зөвхөн 25MB-аас бага зургууд сонгоно уу"},400);
    const duplicate=await database().prepare("SELECT id FROM episodes WHERE content_id=? AND number=? LIMIT 1").bind(contentId,number).first<{id:number}>();
    if(duplicate&&Number(body.episodeId)!==Number(duplicate.id))return c.json({error:`${content.type==="anime"?"Анги":"Бүлэг"} ${number} өмнө нь нэмэгдсэн байна`},409);
    const uploads=await Promise.all(descriptors.map(async descriptor=>({...descriptor,...await createR2PresignedUpload(descriptor)})));
    return c.json({ok:true,uploads});
  }catch(error){console.error("R2 presign failed",error);return c.json({error:error instanceof Error?error.message:"R2 upload холбоос үүссэнгүй"},500)}
});

api.post("/admin/episode", async (c) => {
  await ensureUser(c.req.raw);
  try{
    const requestType=c.req.header("content-type")||"";
    if(requestType.includes("application/json")){
      const body=await c.req.json<{contentId:string;number:number;access?:string;publishAt?:string|null;uploads:DirectUpload[]}>();
      const contentId=String(body.contentId||"").trim();
      const number=Number(body.number);
      const content=await database().prepare("SELECT type FROM contents WHERE id=?").bind(contentId).first<{type:string}>();
      if(!content)return c.json({error:"Сонгосон бүтээл олдсонгүй"},404);
      if(!Number.isFinite(number)||number<=0)return c.json({error:"Анги, бүлгийн дугаар буруу байна"},400);
      const uploads=directUploads(body.uploads);
      if(!validEpisodeFiles(uploads,content.type)||uploads.some(file=>!isEpisodeObjectKey(file.key,contentId,number)))return c.json({error:"Upload файлын мэдээлэл буруу байна"},400);
      const duplicate=await database().prepare("SELECT id FROM episodes WHERE content_id=? AND number=? LIMIT 1").bind(contentId,number).first();
      if(duplicate){await Promise.allSettled(uploads.map(file=>deleteR2Object(file.key)));return c.json({error:`${content.type==="anime"?"Анги":"Бүлэг"} ${number} өмнө нь нэмэгдсэн байна`},409)}
      await Promise.all(uploads.map(verifyR2Upload));
      const access=content.type==="anime"?"vip":body.access==="vip"?"vip":"registered";
      const publishAt=body.publishAt?String(body.publishAt):null;
      try{await database().prepare("INSERT INTO episodes (content_id,number,access,publish_at,media_keys) VALUES (?,?,?,?,?)").bind(contentId,number,access,publishAt,JSON.stringify(uploads.map(file=>file.key))).run()}
      catch(error){await Promise.allSettled(uploads.map(file=>deleteR2Object(file.key)));throw error}
      return c.json({ok:true,keys:uploads.map(file=>file.key)});
    }
    const form = await c.req.parseBody({ all: true });
    const single=(value:unknown)=>Array.isArray(value)?value[0]:value;
    const contentId=String(single(form.contentId)||"").trim();
    const number=Number(single(form.number));
    const requestedAccess=String(single(form.access)||"registered");
    const publishValue=String(single(form.publishAt)||"").trim();
    const publishAt=publishValue||null;
    if(!contentId)return c.json({error:"Бүтээл сонгогдоогүй байна"},400);
    if(!Number.isFinite(number)||number<=0)return c.json({error:"Анги, бүлгийн дугаар буруу байна"},400);
    const content=await database().prepare("SELECT type FROM contents WHERE id=?").bind(contentId).first<{type:string}>();
    if(!content)return c.json({error:"Сонгосон бүтээл олдсонгүй"},404);
    const duplicate=await database().prepare("SELECT id FROM episodes WHERE content_id=? AND number=? LIMIT 1").bind(contentId,number).first();
    if(duplicate)return c.json({error:`${content.type==="anime"?"Анги":"Бүлэг"} ${number} өмнө нь нэмэгдсэн байна`},409);
    const rawFiles=form.files;
    const files=(Array.isArray(rawFiles)?rawFiles:rawFiles?[rawFiles]:[]).filter((file):file is File=>file instanceof File&&file.size>0);
    if(!files.length)return c.json({error:content.type==="anime"?"Видео файл сонгоно уу":"Бүлгийн зургууд сонгоно уу"},400);
    if(content.type==="anime"&&files.length!==1)return c.json({error:"Нэг ангид нэг видео файл оруулна уу"},400);
    const invalid=files.find(file=>content.type==="anime"?!file.type.startsWith("video/"):!file.type.startsWith("image/"));
    if(invalid)return c.json({error:content.type==="anime"?"Зөвхөн видео файл оруулна уу":"Зөвхөн зураг оруулна уу"},400);
    const oversized=files.find(file=>file.size>(content.type==="anime"?1024*1024*1024:25*1024*1024));
    if(oversized)return c.json({error:content.type==="anime"?"Видео файл 1GB-аас бага байна":"Нэг зураг 25MB-аас бага байна"},400);
    const access=content.type==="anime"?"vip":requestedAccess==="vip"?"vip":"registered";
    const keys:string[]=[];
    try{
      for(const file of files){const key=`${contentId}-${number}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;await mediaBucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});keys.push(key)}
      await database().prepare("INSERT INTO episodes (content_id,number,access,publish_at,media_keys) VALUES (?,?,?,?,?)").bind(contentId,number,access,publishAt,JSON.stringify(keys)).run();
    }catch(error){await Promise.allSettled(keys.map(key=>mediaBucket().delete(key)));throw error}
    return c.json({ok:true,keys});
  }catch(error){
    console.error("episode upload failed",error);
    return c.json({error:"Файл хадгалах үед алдаа гарлаа. Дахин оролдоно уу."},500);
  }
});

api.put("/admin/episode/:id", async (c) => {
  const requestType=c.req.header("content-type")||"";
  if(requestType.includes("multipart/form-data")){
    await ensureUser(c.req.raw);
    const id=Number(c.req.param("id"));
    const episode=await database().prepare("SELECT e.content_id AS contentId,e.number,e.media_keys AS mediaKeys,c.type FROM episodes e JOIN contents c ON c.id=e.content_id WHERE e.id=?").bind(id).first<{contentId:string;number:number;mediaKeys:string;type:string}>();
    if(!episode)return c.json({error:"Анги, бүлэг олдсонгүй"},404);
    try{
      const form=await c.req.parseBody({all:true});
      const rawFiles=form.files;
      const files=(Array.isArray(rawFiles)?rawFiles:rawFiles?[rawFiles]:[]).filter((file):file is File=>file instanceof File&&file.size>0);
      if(!files.length)return c.json({error:episode.type==="anime"?"Шинэ видео файл сонгоно уу":"Шинэ зургууд сонгоно уу"},400);
      if(episode.type==="anime"&&files.length!==1)return c.json({error:"Нэг ангид нэг видео файл оруулна уу"},400);
      const invalid=files.find(file=>episode.type==="anime"?!file.type.startsWith("video/"):!file.type.startsWith("image/"));
      if(invalid)return c.json({error:episode.type==="anime"?"Зөвхөн видео файл оруулна уу":"Зөвхөн зураг оруулна уу"},400);
      const oversized=files.find(file=>file.size>(episode.type==="anime"?1024*1024*1024:25*1024*1024));
      if(oversized)return c.json({error:episode.type==="anime"?"Видео файл 1GB-аас бага байна":"Нэг зураг 25MB-аас бага байна"},400);
      let oldKeys:string[]=[];try{oldKeys=JSON.parse(episode.mediaKeys||"[]") as string[]}catch{oldKeys=[]}
      const replaceIndexValue=Array.isArray(form.replaceIndex)?form.replaceIndex[0]:form.replaceIndex;
      const replaceIndex=replaceIndexValue===undefined?null:Number(replaceIndexValue);
      if(replaceIndex!==null){
        if(episode.type==="anime")return c.json({error:"Видео файлыг бүтнээр нь солино уу"},400);
        if(files.length!==1)return c.json({error:"Нэг хуудсыг солихдоо нэг зураг сонгоно уу"},400);
        if(!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=oldKeys.length)return c.json({error:"Солих хуудасны дугаар буруу байна"},400);
        const file=files[0];
        const newKey=`${episode.contentId}-${episode.number}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
        try{
          await mediaBucket().put(newKey,file.stream(),{httpMetadata:{contentType:file.type}});
          const nextKeys=[...oldKeys];
          const oldKey=nextKeys[replaceIndex];
          nextKeys[replaceIndex]=newKey;
          try{await database().prepare("UPDATE episodes SET media_keys=? WHERE id=?").bind(JSON.stringify(nextKeys),id).run()}
          catch(error){await mediaBucket().delete(newKey);throw error}
          await mediaBucket().delete(oldKey).catch(()=>undefined);
          return c.json({ok:true,keys:nextKeys,replacedIndex:replaceIndex});
        }catch(error){console.error("episode page replacement failed",error);return c.json({error:"Зураг шинэчлэх үед алдаа гарлаа. Дахин оролдоно уу."},500)}
      }
      const newKeys:string[]=[];
      try{
        for(const file of files){const key=`${episode.contentId}-${episode.number}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;await mediaBucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});newKeys.push(key)}
        await database().prepare("UPDATE episodes SET media_keys=? WHERE id=?").bind(JSON.stringify(newKeys),id).run();
      }catch(error){await Promise.allSettled(newKeys.map(key=>mediaBucket().delete(key)));throw error}
      await Promise.allSettled(oldKeys.map(key=>mediaBucket().delete(key)));
      return c.json({ok:true,keys:newKeys});
    }catch(error){console.error("episode media replacement failed",error);return c.json({error:"Файл шинэчлэх үед алдаа гарлаа. Дахин оролдоно уу."},500)}
  }
  const item = await c.req.json<{ number?: number; access?: string; uploads?: DirectUpload[]; replaceIndex?: number }>();
  if(Array.isArray(item.uploads)){
    const id=Number(c.req.param("id"));
    const episode=await database().prepare("SELECT e.content_id AS contentId,e.number,e.media_keys AS mediaKeys,c.type FROM episodes e JOIN contents c ON c.id=e.content_id WHERE e.id=?").bind(id).first<{contentId:string;number:number;mediaKeys:string;type:string}>();
    if(!episode)return c.json({error:"Анги, бүлэг олдсонгүй"},404);
    const uploads=directUploads(item.uploads);
    if(!validEpisodeFiles(uploads,episode.type)||uploads.some(file=>!isEpisodeObjectKey(file.key,episode.contentId,episode.number)))return c.json({error:"Upload файлын мэдээлэл буруу байна"},400);
    await Promise.all(uploads.map(verifyR2Upload));
    let oldKeys:string[]=[];try{oldKeys=JSON.parse(episode.mediaKeys||"[]") as string[]}catch{oldKeys=[]}
    if(item.replaceIndex!==undefined){
      const index=Number(item.replaceIndex);
      if(episode.type==="anime"||uploads.length!==1||!Number.isInteger(index)||index<0||index>=oldKeys.length){await Promise.allSettled(uploads.map(file=>deleteR2Object(file.key)));return c.json({error:"Солих хуудасны мэдээлэл буруу байна"},400)}
      const nextKeys=[...oldKeys];const oldKey=nextKeys[index];nextKeys[index]=uploads[0].key;
      try{await database().prepare("UPDATE episodes SET media_keys=? WHERE id=?").bind(JSON.stringify(nextKeys),id).run()}
      catch(error){await deleteR2Object(uploads[0].key).catch(()=>undefined);throw error}
      await deleteR2Object(oldKey).catch(()=>mediaBucket().delete(oldKey));
      return c.json({ok:true,keys:nextKeys,replacedIndex:index});
    }
    const newKeys=uploads.map(file=>file.key);
    try{await database().prepare("UPDATE episodes SET media_keys=? WHERE id=?").bind(JSON.stringify(newKeys),id).run()}
    catch(error){await Promise.allSettled(newKeys.map(deleteR2Object));throw error}
    await Promise.allSettled(oldKeys.map(key=>deleteR2Object(key).catch(()=>mediaBucket().delete(key))));
    return c.json({ok:true,keys:newKeys});
  }
  const number = Number(item.number);
  if (!Number.isFinite(number) || number <= 0) return c.json({ error: "Дугаар буруу байна" }, 400);
  const episode=await database().prepare("SELECT c.type FROM episodes e JOIN contents c ON c.id=e.content_id WHERE e.id=?").bind(Number(c.req.param("id"))).first<{type:string}>();
  const access=episode?.type==="anime"?"vip":item.access === "vip" ? "vip" : "registered";
  await database().prepare("UPDATE episodes SET number=?,access=? WHERE id=?").bind(number, access, Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

api.delete("/admin/episode/:id", async (c) => {
  const episode = await database().prepare("SELECT content_id AS contentId,media_keys AS mediaKeys FROM episodes WHERE id=?").bind(Number(c.req.param("id"))).first<{ contentId: string; mediaKeys: string }>();
  if (!episode) return c.json({ error: "Анги олдсонгүй" }, 404);
  let keys: string[] = []; try { keys = JSON.parse(episode.mediaKeys || "[]") as string[]; } catch { keys = []; }
  try{await deleteStoredMedia(keys)}
  catch(error){console.error("R2 episode cleanup failed",error);return c.json({error:"R2 дээрх файл устгагдсангүй. Анги, бүлгийг хэвээр үлдээлээ."},502)}
  await database().prepare("DELETE FROM episodes WHERE id=?").bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

api.get("/media/:key", async (c) => {
  const key=c.req.param("key");
  const protectedMedia=await database().prepare("SELECT e.access,c.type FROM episodes e JOIN contents c ON c.id=e.content_id JOIN json_each(e.media_keys) media ON media.value=? LIMIT 1").bind(key).first<{access:string;type:string}>();
  if(protectedMedia&&(protectedMedia.type==="anime"||protectedMedia.access==="vip")){
    const authenticated=await authenticateRequest(c.req.raw);
    if(!authenticated)return c.json({error:"Нэвтрэх шаардлагатай"},401);
    const user=await ensureUser(c.req.raw);
    const profile=await database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(user.email).first<{vipUntil:unknown}>();
    const vipUntil=timestampMs(profile?.vipUntil);
    if(user.role!=="admin"&&vipUntil<=Date.now())return c.json({error:"VIP эрх шаардлагатай"},403);
  }
  if(key.startsWith("episodes/"))return c.redirect(await createR2PresignedRead(key),302);
  const rangeHeader=c.req.raw.headers.get("range");
  const object = await mediaBucket().get(key,rangeHeader?{range:c.req.raw.headers}:undefined);
  if (!object) return c.notFound();
  const responseHeaders = new Headers();
  object.writeHttpMetadata(responseHeaders);
  responseHeaders.set("etag", object.httpEtag);
  responseHeaders.set("accept-ranges","bytes");
  responseHeaders.set("cache-control",protectedMedia?"private, max-age=300":"private, max-age=3600");
  if(rangeHeader&&object.range&&"offset" in object.range&&"length" in object.range){
    const start=object.range.offset;
    const length=object.range.length;
    responseHeaders.set("content-range",`bytes ${start}-${start+length-1}/${object.size}`);
    responseHeaders.set("content-length",String(length));
    return new Response(object.body,{status:206,headers:responseHeaders});
  }
  return new Response(object.body, { headers:responseHeaders });
});

api.post("/admin/vip", async (c) => { await ensureUser(c.req.raw); const v = await c.req.json<{ bankName: string; accountNumber: string; accountHolder: string; promotion: string; globalDiscount: number; accentColor?: string }>(); await database().prepare("UPDATE vip_settings SET bank_name=?,account_number=?,account_holder=?,promotion=?,global_discount=?,accent_color=? WHERE id=1").bind(v.bankName, v.accountNumber, v.accountHolder, v.promotion, Number(v.globalDiscount) || 0, v.accentColor || "#8b6cf6").run(); return c.json({ ok: true }); });
api.post("/admin/package", async (c) => { await ensureUser(c.req.raw); const p = await c.req.json<{ name: string; durationDays: number; price: number }>();const name=String(p.name||"").trim().slice(0,80);const days=Math.floor(Number(p.durationDays));const price=Math.floor(Number(p.price));if(!name||!Number.isFinite(days)||days<1||days>3650||!Number.isFinite(price)||price<0)return c.json({error:"Багцын мэдээлэл буруу байна"},400);await database().prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) VALUES (?,?,?,0,1)").bind(name,days,price).run(); return c.json({ ok: true }); });
api.put("/admin/package/:id",async(c)=>{const p=await c.req.json<{name:string;durationDays:number;price:number}>();const id=Number(c.req.param("id"));const name=String(p.name||"").trim().slice(0,80);const days=Math.floor(Number(p.durationDays));const price=Math.floor(Number(p.price));if(!Number.isInteger(id)||id<1||!name||!Number.isFinite(days)||days<1||days>3650||!Number.isFinite(price)||price<0)return c.json({error:"Багцын мэдээлэл буруу байна"},400);await database().prepare("UPDATE vip_packages SET name=?,duration_days=?,price=? WHERE id=?").bind(name,days,price,id).run();return c.json({ok:true})});
api.delete("/admin/package/:id",async(c)=>{await database().prepare("DELETE FROM vip_packages WHERE id=?").bind(Number(c.req.param("id"))).run();return c.json({ok:true})});
api.post("/admin/grant-vip", async (c) => {
  const admin=await ensureUser(c.req.raw);
  const {email,days}=await c.req.json<{email:string;days:number}>();
  const safeDays=Math.max(1,Number(days)||1);
  const target=await database().prepare("SELECT email FROM users WHERE email=?").bind(email).first<{email:string}>();
  if(!target)return c.json({error:"Хэрэглэгч олдсонгүй"},404);
  await database().batch([
    database().prepare("UPDATE users SET vip_until=datetime(CASE WHEN vip_until > CURRENT_TIMESTAMP THEN vip_until ELSE CURRENT_TIMESTAMP END, ?) WHERE email=?").bind(`+${safeDays} day`,email),
    database().prepare("INSERT INTO vip_history (user_email,days,source,granted_by,expires_at) SELECT ?,?,'admin',?,vip_until FROM users WHERE email=?").bind(email,safeDays,admin.email,email),
  ]);
  const updated=await database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(email).first<{vipUntil:string|null}>();
  await database().prepare("INSERT INTO notifications (user_email,title,body,link) VALUES (?,?,?,?)").bind(email,"VIP эрх идэвхжлээ",`${safeDays} хоногийн VIP эрх амжилттай идэвхжлээ. Дуусах хугацаа: ${updated?.vipUntil||"—"}`,"/settings?tab=vip#vip-status").run();
  return c.json({ok:true,vipUntil:updated?.vipUntil||null});
});
api.put("/admin/user/:id/vip", async (c) => {
  const admin=await ensureUser(c.req.raw);
  const id=Number(c.req.param("id"));
  const {vipUntil}=await c.req.json<{vipUntil:string|null}>();
  const target=await database().prepare("SELECT email FROM users WHERE id=?").bind(id).first<{email:string}>();
  if(!target)return c.json({error:"Хэрэглэгч олдсонгүй"},404);
  let normalized:string|null=null;
  if(vipUntil){const date=new Date(vipUntil);if(Number.isNaN(date.getTime()))return c.json({error:"VIP эрхийн хугацаа буруу байна"},400);normalized=date.toISOString().slice(0,19).replace("T"," ");}
  const days=normalized?Math.max(0,Math.ceil((new Date(`${normalized.replace(" ","T")}Z`).getTime()-Date.now())/86400000)):0;
  await database().batch([
    database().prepare("UPDATE users SET vip_until=? WHERE id=?").bind(normalized,id),
    database().prepare("INSERT INTO vip_history (user_email,days,source,granted_by,expires_at) VALUES (?,?,'admin-edit',?,?)").bind(target.email,days,admin.email,normalized),
  ]);
  if(normalized){
    await database().prepare("INSERT INTO notifications (user_email,title,body,link) VALUES (?,?,?,?)").bind(target.email,"VIP эрх шинэчлэгдлээ",`Таны VIP эрхийн хүчинтэй хугацааг шинэчиллээ. Дуусах хугацаа: ${normalized}`,"/settings?tab=vip#vip-status").run();
  }
  return c.json({ok:true,vipUntil:normalized});
});
api.put("/admin/user/:id/role", async (c) => {
  const admin=await ensureUser(c.req.raw);
  const id=Number(c.req.param("id"));
  const {role}=await c.req.json<{role:"admin"|"member"}>();
  if(!Number.isInteger(id)||id<1||(role!=="admin"&&role!=="member"))return c.json({error:"Хэрэглэгчийн эрхийн мэдээлэл буруу байна"},400);
  const target=await database().prepare("SELECT email,role FROM users WHERE id=?").bind(id).first<{email:string;role:string}>();
  if(!target)return c.json({error:"Хэрэглэгч олдсонгүй"},404);
  if(role==="member"&&(target.email.toLowerCase()===admin.email.toLowerCase()||isAdminEmail(target.email)))return c.json({error:"Энэ админы эрхийг цуцлах боломжгүй"},400);
  await database().prepare("UPDATE users SET role=? WHERE id=?").bind(role,id).run();
  return c.json({ok:true,role});
});
api.delete("/admin/user/:id", async (c) => {
  const admin=await ensureUser(c.req.raw);
  const id=Number(c.req.param("id"));
  const target=await database().prepare("SELECT email FROM users WHERE id=?").bind(id).first<{email:string}>();
  if(!target)return c.json({error:"Хэрэглэгч олдсонгүй"},404);
  if(target.email.toLowerCase()===admin.email.toLowerCase()||isAdminEmail(target.email))return c.json({error:"Энэ админ бүртгэлийг устгах боломжгүй"},400);
  await database().batch([
    database().prepare("DELETE FROM auth_sessions WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM user_devices WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM vip_history WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM library_items WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM watch_history WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM entry_reads WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM comments WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM error_reports WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM notifications WHERE user_email=?").bind(target.email),
    database().prepare("DELETE FROM users WHERE id=?").bind(id),
  ]);
  return c.json({ok:true});
});
api.post("/admin/social", async (c) => { await ensureUser(c.req.raw); const s = await c.req.json<Record<string,string>>(); await database().prepare("UPDATE social_settings SET facebook=?,instagram=?,youtube=?,discord=?,telegram=? WHERE id=1").bind(s.facebook||"",s.instagram||"",s.youtube||"",s.discord||"",s.telegram||"").run(); return c.json({ ok: true }); });

export const GET = (request: Request) => api.fetch(request);
export const POST = (request: Request) => api.fetch(request);
export const PUT = (request: Request) => api.fetch(request);
export const DELETE = (request: Request) => api.fetch(request);
