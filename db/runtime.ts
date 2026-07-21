import { env } from "cloudflare:workers";

export function database(): D1Database {
  if (!env.DB) throw new Error("D1 database is unavailable");
  return env.DB;
}

let schemaReady: Promise<unknown> | null = null;
export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = database();
  schemaReady = db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS contents (id TEXT PRIMARY KEY, title TEXT NOT NULL, original_title TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, year INTEGER NOT NULL, episode_count INTEGER NOT NULL DEFAULT 0, rating REAL NOT NULL DEFAULT 0, genres TEXT NOT NULL DEFAULT '', image TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS library_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, content_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_email, content_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS watch_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, content_id TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_email, content_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, content_id TEXT NOT NULL, user_email TEXT NOT NULL, display_name TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS vip_settings (id INTEGER PRIMARY KEY, bank_name TEXT NOT NULL, account_number TEXT NOT NULL, account_holder TEXT NOT NULL, headline TEXT NOT NULL, promotion TEXT NOT NULL DEFAULT '', accent_color TEXT NOT NULL DEFAULT '#8b6cf6')"),
    db.prepare("CREATE TABLE IF NOT EXISTS vip_packages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, duration_days INTEGER NOT NULL, price INTEGER NOT NULL, discount_percent INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, user_email TEXT, amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  ]).then(async (result) => {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO vip_settings (id, bank_name, account_number, account_holder, headline, promotion, accent_color) VALUES (1, 'Хаан банк', '0000 0000 0000', 'Зураас ХХК', 'VIP ертөнцөд нэгдээрэй', 'Шинэ хэрэглэгчид 20% хямдрал', '#8b6cf6')"),
      db.prepare("INSERT INTO vip_packages (name, duration_days, price, discount_percent, active) SELECT '7 хоног', 7, 4900, 0, 1 WHERE NOT EXISTS (SELECT 1 FROM vip_packages)"),
      db.prepare("INSERT INTO vip_packages (name, duration_days, price, discount_percent, active) SELECT 'Сарын эрх', 30, 12900, 20, 1 WHERE (SELECT COUNT(*) FROM vip_packages) = 1"),
      db.prepare("INSERT INTO vip_packages (name, duration_days, price, discount_percent, active) SELECT 'Жилийн эрх', 365, 99000, 30, 1 WHERE (SELECT COUNT(*) FROM vip_packages) = 2"),
    ]);
    return result;
  }).catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

export function identity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email") ?? "demo@zuraas.local";
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let fullName = "Зураас хэрэглэгч";
  if (encoded && encoding === "percent-encoded-utf-8") {
    try { fullName = decodeURIComponent(encoded); } catch { /* fallback */ }
  }
  return { email, displayName: fullName };
}

export async function ensureUser(request: Request) {
  await ensureSchema();
  const user = identity(request);
  await database().prepare("INSERT INTO users (email, display_name, role) VALUES (?, ?, 'member') ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name").bind(user.email, user.displayName).run();
  return user;
}
