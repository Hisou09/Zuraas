import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
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

/** PBKDF2-SHA256 password hash — same format as db/auth.ts hashPassword(). */
async function hashPassword(password) {
  const PASSWORD_ITERATIONS = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  const bytesToBase64 = (bytes) => {
    let value = "";
    for (const byte of bytes) value += String.fromCharCode(byte);
    return btoa(value);
  };
  return `pbkdf2$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

/** Generate a random 6-digit usercode. */
function randomUsercode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

await loadEnvFile(".dev.vars");
await loadEnvFile(".env.local");
await loadEnvFile(".env");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL тохируулаагүй байна. .dev.vars файл эсвэл deploy secret-д PostgreSQL connection string нэмнэ үү.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1, connect_timeout: 15, idle_timeout: 5, prepare: false });
const directory = path.resolve("postgres-migrations");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const filename of files) {
    const source = await readFile(path.join(directory, filename), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    const [applied] = await sql`SELECT checksum FROM schema_migrations WHERE filename=${filename}`;
    if (applied) {
      if (applied.checksum !== checksum) throw new Error(`${filename} migration өмнө ажилласан боловч агуулга нь өөрчлөгдсөн байна.`);
      console.log(`✓ ${filename} өмнө нь хийгдсэн`);
      continue;
    }

    await sql.begin(async transaction => {
      await transaction`SELECT pg_advisory_xact_lock(hashtext('zuraas_schema_migrations'))`;
      const [race] = await transaction`SELECT checksum FROM schema_migrations WHERE filename=${filename}`;
      if (race) {
        if (race.checksum !== checksum) throw new Error(`${filename} migration checksum зөрүүтэй байна.`);
        return;
      }
      await transaction.unsafe(source);
      await transaction`INSERT INTO schema_migrations (filename, checksum) VALUES (${filename}, ${checksum})`;
    });
    console.log(`✓ ${filename} амжилттай`);
  }
  console.log("PostgreSQL schema шинэчлэгдлээ. Өмнөх өгөгдөл хэвээр үлдсэн.");

  // ── Seed default admin account ──────────────────────────────────────────────
  // Idempotent: only inserts when the email doesn't exist. Safe to run on
  // every deploy — existing data is never modified.
  const ADMIN_EMAIL = "admin@app.com";
  const ADMIN_PASSWORD = "password";
  const ADMIN_DISPLAY_NAME = "Admin";

  const [existing] = await sql`SELECT email FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;
  if (!existing) {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const usercode = randomUsercode();
    await sql`
      INSERT INTO users (email, display_name, role, usercode, contact_email, password_hash)
      VALUES (${ADMIN_EMAIL}, ${ADMIN_DISPLAY_NAME}, 'admin', ${usercode}, ${ADMIN_EMAIL}, ${passwordHash})
    `;
    console.log(`✓ Admin account created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`✓ Admin account already exists: ${ADMIN_EMAIL}`);
  }
  // ────────────────────────────────────────────────────────────────────────────

} catch (error) {
  if (error?.code === "ECONNREFUSED") {
    throw new Error("PostgreSQL ажиллахгүй байна. Local PostgreSQL-оо асаах эсвэл `docker compose up -d postgres` ажиллуулаад дахин оролдоно уу.", { cause: error });
  }
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
