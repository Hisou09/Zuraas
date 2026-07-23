import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function loadEnvFile(filename) {
  try {
    const source = await readFile(path.resolve(filename), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(".dev.vars");
await loadEnvFile(".env.local");
await loadEnvFile(".env");

const defaultDirectory = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const suppliedPath = process.env.D1_SQLITE_PATH;
const candidates = suppliedPath
  ? [path.resolve(suppliedPath)]
  : existsSync(defaultDirectory)
    ? readdirSync(defaultDirectory)
        .filter(name => name.endsWith(".sqlite") && name !== "metadata.sqlite")
        .map(name => path.join(defaultDirectory, name))
        .sort((a, b) => statSync(b).size - statSync(a).size)
    : [];

if (!candidates.length) {
  console.log("Local D1 өгөгдөл олдсонгүй — import алгаслаа.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL тохируулаагүй байна.");

const sqlitePath = candidates[0];
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pg = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
const allowedTables = [
  "users", "auth_sessions", "user_devices", "vip_history", "contents", "library_items", "watch_history",
  "comments", "error_reports", "notifications", "vip_settings", "vip_packages", "episodes", "social_settings",
  "analytics_events", "app_settings",
];
const serialTables = new Set(["users", "vip_history", "library_items", "watch_history", "comments", "error_reports", "notifications", "vip_packages", "episodes", "analytics_events"]);

function quoteIdentifier(value) { return `"${value.replaceAll('"', '""')}"`; }

try {
  const sqliteTables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  await pg.begin(async transaction => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('zuraas_d1_import'))`;
    for (const table of allowedTables) {
      if (!sqliteTables.has(table)) continue;
      const targetColumnRows = await transaction`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      const targetColumns = new Set(targetColumnRows.map(row => row.column_name));
      if (!targetColumns.size) continue;
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all();
      let imported = 0;
      for (const row of rows) {
        // D1-ийн хуучин schema-д PostgreSQL-д байхгүй нэмэлт багана байж болно.
        // Зөвхөн хоёр schema-д давхцаж буй талбаруудыг хуулна.
        const columns = Object.keys(row).filter(column => targetColumns.has(column));
        if (!columns.length) continue;
        const names = columns.map(quoteIdentifier).join(", ");
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const values = columns.map(column => row[column]);
        const result = await transaction.unsafe(`INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
        imported += Number(result.count || 0);
      }
      if (serialTables.has(table)) {
        await transaction.unsafe(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1), EXISTS(SELECT 1 FROM ${quoteIdentifier(table)}))`);
      }
      console.log(`✓ ${table}: ${imported} шинэ мөр`);
    }
  });
  console.log("Local D1 өгөгдлийг PostgreSQL руу аюулгүй хууллаа. Давтан ажиллуулахад хуучин мөр устахгүй.");
} finally {
  sqlite.close();
  await pg.end({ timeout: 5 });
}
