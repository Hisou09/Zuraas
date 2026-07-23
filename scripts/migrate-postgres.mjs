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
} catch (error) {
  if (error?.code === "ECONNREFUSED") {
    throw new Error("PostgreSQL ажиллахгүй байна. Local PostgreSQL-оо асаах эсвэл `docker compose up -d postgres` ажиллуулаад дахин оролдоно уу.", { cause: error });
  }
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
