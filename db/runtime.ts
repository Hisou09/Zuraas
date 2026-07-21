import { env } from "cloudflare:workers";
export const OWNER_EMAIL="kanbara120@yahoo.com";

export function database(): D1Database { if (!env.DB) throw new Error("D1 database is unavailable"); return env.DB; }
export function mediaBucket(): R2Bucket { if (!env.MEDIA) throw new Error("R2 media storage is unavailable"); return env.MEDIA; }

let schemaReady: Promise<unknown>|null=null;
function randomUsercode(){const value=new Uint32Array(1);crypto.getRandomValues(value);return String(100000+(value[0]%900000));}
export function ensureSchema(){
  if(schemaReady)return schemaReady;const db=database();
  schemaReady=(async()=>{
    const created=await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',usercode TEXT UNIQUE,vip_until TEXT,contact_email TEXT,avatar_key TEXT,cover_key TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS user_devices (device_id TEXT PRIMARY KEY,user_email TEXT NOT NULL,label TEXT NOT NULL,user_agent TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS vip_history (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,days INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'admin',granted_by TEXT,granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS contents (id TEXT PRIMARY KEY,title TEXT NOT NULL,original_title TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,year INTEGER NOT NULL,episode_count INTEGER NOT NULL DEFAULT 0,rating REAL NOT NULL DEFAULT 0,genres TEXT NOT NULL DEFAULT '',image TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',adult INTEGER NOT NULL DEFAULT 0,anilist_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS library_items (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,content_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_email,content_id))"),
      db.prepare("CREATE TABLE IF NOT EXISTS watch_history (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,content_id TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_email,content_id))"),
      db.prepare("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT,content_id TEXT NOT NULL,user_email TEXT NOT NULL,display_name TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS vip_settings (id INTEGER PRIMARY KEY,bank_name TEXT NOT NULL,account_number TEXT NOT NULL,account_holder TEXT NOT NULL,promotion TEXT NOT NULL DEFAULT '',global_discount INTEGER NOT NULL DEFAULT 0,accent_color TEXT NOT NULL DEFAULT '#8b6cf6')"),
      db.prepare("CREATE TABLE IF NOT EXISTS vip_packages (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,duration_days INTEGER NOT NULL,price INTEGER NOT NULL,discount_percent INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1)"),
      db.prepare("CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,user_email TEXT,amount INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS episodes (id INTEGER PRIMARY KEY AUTOINCREMENT,content_id TEXT NOT NULL,number REAL NOT NULL,access TEXT NOT NULL DEFAULT 'registered',publish_at TEXT,media_keys TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS social_settings (id INTEGER PRIMARY KEY,facebook TEXT NOT NULL DEFAULT '',instagram TEXT NOT NULL DEFAULT '',youtube TEXT NOT NULL DEFAULT '',discord TEXT NOT NULL DEFAULT '',telegram TEXT NOT NULL DEFAULT '')"),
    ]);
    const addMissing=async(table:string,columns:Record<string,string>)=>{const info=await db.prepare(`PRAGMA table_info(${table})`).all();const names=new Set(info.results.map((row:any)=>String(row.name)));for(const [name,sql] of Object.entries(columns))if(!names.has(name))await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${sql}`).run();};
    await addMissing("users",{usercode:"TEXT",vip_until:"TEXT",contact_email:"TEXT",avatar_key:"TEXT",cover_key:"TEXT"});
    await addMissing("contents",{description:"TEXT NOT NULL DEFAULT ''",adult:"INTEGER NOT NULL DEFAULT 0",anilist_id:"INTEGER"});
    await addMissing("vip_settings",{global_discount:"INTEGER NOT NULL DEFAULT 0"});
    const oldUsers=await db.prepare("SELECT id,email FROM users WHERE usercode IS NULL OR usercode='' ").all();for(const row of oldUsers.results as any[]){await db.prepare("UPDATE users SET usercode=? WHERE id=?").bind(randomUsercode(),row.id).run();}
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO vip_settings (id,bank_name,account_number,account_holder,promotion,global_discount,accent_color) VALUES (1,'Хаан банк','0000 0000 0000','Зураас ХХК','Шинэ хэрэглэгчид 20% хямдрал',20,'#8b6cf6')"),
      db.prepare("INSERT OR IGNORE INTO social_settings (id) VALUES (1)"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT '7 хоног',7,4900,0,1 WHERE NOT EXISTS (SELECT 1 FROM vip_packages)"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT 'Сарын эрх',30,12900,0,1 WHERE (SELECT COUNT(*) FROM vip_packages)=1"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT 'Жилийн эрх',365,99000,0,1 WHERE (SELECT COUNT(*) FROM vip_packages)=2"),
    ]);return created;
  })().catch(error=>{schemaReady=null;throw error});return schemaReady;
}

export function identity(request:Request){const email=request.headers.get("oai-authenticated-user-email")??"demo@zuraas.local";const encoded=request.headers.get("oai-authenticated-user-full-name");const encoding=request.headers.get("oai-authenticated-user-full-name-encoding");let fullName="Зураас хэрэглэгч";if(encoded&&encoding==="percent-encoded-utf-8")try{fullName=decodeURIComponent(encoded)}catch{/* fallback */}return{email,displayName:fullName};}
export async function ensureUser(request:Request){await ensureSchema();const user=identity(request);const role=user.email.toLowerCase()===OWNER_EMAIL?"admin":"member";await database().prepare("INSERT INTO users (email,display_name,role,usercode,contact_email) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=CASE WHEN excluded.email=? THEN 'admin' ELSE users.role END").bind(user.email,user.displayName,role,randomUsercode(),user.email,OWNER_EMAIL).run();const profile=await database().prepare("SELECT display_name AS displayName,contact_email AS contactEmail FROM users WHERE email=?").bind(user.email).first<{displayName:string;contactEmail:string|null}>();return{email:user.email,displayName:profile?.displayName||user.displayName,contactEmail:profile?.contactEmail||user.email};}
export async function isAdmin(request:Request){const user=await ensureUser(request);if(user.email.toLowerCase()===OWNER_EMAIL)return true;const row=await database().prepare("SELECT role FROM users WHERE email=?").bind(user.email).first<{role:string}>();return row?.role==="admin";}
