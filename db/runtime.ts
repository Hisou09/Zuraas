import { catalog } from "../app/data/catalog";
import { postgresDatabase } from "./postgres";
import { env } from "cloudflare:workers";
export const ADMIN_EMAILS=["kanbara120@yahoo.com","hisou1@gmail.com"] as const;
export function isAdminEmail(email:string){return ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof ADMIN_EMAILS)[number]);}

export function database() { return postgresDatabase(); }
export function mediaBucket(): R2Bucket { if (!env.MEDIA) throw new Error("R2 media storage is unavailable"); return env.MEDIA; }

let schemaReady: Promise<unknown>|null=null;
const SCHEMA_VERSION=1;
function randomUsercode(){const value=new Uint32Array(1);crypto.getRandomValues(value);return String(100000+(value[0]%900000));}
export function ensureSchema(){
  if(schemaReady)return schemaReady;const db=database();
  schemaReady=(async()=>{
    await db.prepare("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)").run();
    const created=true;
    const oldUsers=await db.prepare("SELECT id,email FROM users WHERE usercode IS NULL OR usercode='' ").all();for(const row of oldUsers.results as any[]){await db.prepare("UPDATE users SET usercode=? WHERE id=?").bind(randomUsercode(),row.id).run();}
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO vip_settings (id,bank_name,account_number,account_holder,promotion,global_discount,accent_color) VALUES (1,'Хаан банк','0000 0000 0000','Зураас ХХК','Шинэ хэрэглэгчид 20% хямдрал',20,'#8b6cf6')"),
      db.prepare("INSERT OR IGNORE INTO social_settings (id) VALUES (1)"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT '7 хоног',7,4900,0,1 WHERE NOT EXISTS (SELECT 1 FROM vip_packages)"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT 'Сарын эрх',30,12900,0,1 WHERE (SELECT COUNT(*) FROM vip_packages)=1"),
      db.prepare("INSERT INTO vip_packages (name,duration_days,price,discount_percent,active) SELECT 'Жилийн эрх',365,99000,0,1 WHERE (SELECT COUNT(*) FROM vip_packages)=2"),
    ]);
    const seedVersion="catalog-2026-07-22-v1";
    const currentSeed=await db.prepare("SELECT value FROM app_settings WHERE key='catalog_seed_version'").first<{value:string}>();
    if(currentSeed?.value!==seedVersion){
      const statements=[
        ...catalog.map(item=>db.prepare("INSERT INTO contents (id,title,original_title,type,status,year,episode_count,rating,genres,image,banner_image,characters,description,adult,anilist_id) VALUES (?,?,?,?,?,?,0,?,?,?,?,'[]',?,0,?) ON CONFLICT(id) DO NOTHING").bind(item.id,item.title,item.originalTitle,item.type,item.status,item.year,item.rating,item.genres.join(", "),item.image,item.bannerImage||"",item.description||"",item.anilistId||null)),
        db.prepare("INSERT INTO app_settings (key,value) VALUES ('catalog_seed_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(seedVersion),
      ];
      await db.batch(statements);
    }
    await db.prepare("INSERT INTO app_settings (key,value) VALUES ('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(SCHEMA_VERSION)).run();
    return created;
  })().catch(error=>{schemaReady=null;throw error});return schemaReady;
}
