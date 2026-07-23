import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";

async function loadEnvFile(filename) {
  try {
    const source = await readFile(path.resolve(filename), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: options.quiet ? "ignore" : "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

await loadEnvFile(".dev.vars");
await loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL тохируулаагүй байна.");
}

const databaseUrl = new URL(connectionString);
const host = databaseUrl.hostname;
const port = databaseUrl.port || "5432";
const user = decodeURIComponent(databaseUrl.username || "zuraas");
const database = databaseUrl.pathname.replace(/^\//, "") || "zuraas";

// Remote/deploy database-ийг local script удирдахгүй.
if (host !== "127.0.0.1" && host !== "localhost") {
  console.log("✓ Remote PostgreSQL тохиргоотой тул local database асаах алхмыг алгасав.");
  process.exit(0);
}

const candidates = [
  process.env.POSTGRES_BIN,
  "C:\\Program Files\\PostgreSQL\\18\\bin",
  "C:\\Program Files\\PostgreSQL\\17\\bin",
  "C:\\Program Files\\PostgreSQL\\16\\bin",
].filter(Boolean);

let postgresBin = null;
for (const candidate of candidates) {
  if (await exists(path.join(candidate, "pg_ctl.exe"))) {
    postgresBin = candidate;
    break;
  }
}
if (!postgresBin) {
  throw new Error("PostgreSQL executable олдсонгүй. PostgreSQL 16+ суулгана уу.");
}

const dataDirectory = path.resolve(".local-postgres", "data");
const logFile = path.resolve(".local-postgres", "postgres.log");
const initdb = path.join(postgresBin, "initdb.exe");
const pgCtl = path.join(postgresBin, "pg_ctl.exe");
const pgIsReady = path.join(postgresBin, "pg_isready.exe");
const createdb = path.join(postgresBin, "createdb.exe");

await mkdir(path.dirname(dataDirectory), { recursive: true });

const configPath = path.join(dataDirectory, "postgresql.conf");
if (!(await exists(path.join(dataDirectory, "PG_VERSION")))) {
  console.log("Local PostgreSQL database анх удаа үүсгэж байна...");
  const status = run(initdb, [
    "-D", dataDirectory,
    "--username", user,
    "--auth-host=trust",
    "--auth-local=trust",
    "--encoding=UTF8",
    "--no-locale",
  ]);
  if (status !== 0) throw new Error("Local PostgreSQL database үүсгэж чадсангүй.");
}

if (await exists(configPath)) {
  let conf = await readFile(configPath, "utf8");
  if (!conf.includes(`port = ${port}`)) {
    conf = conf.replace(/^#?\s*port\s*=\s*\d+/m, `port = ${port}`);
    conf = conf.replace(/^#?\s*listen_addresses\s*=\s*'.*?'/m, `listen_addresses = '${host}'`);
    await writeFile(configPath, conf, "utf8");
  }
}

const readyArgs = ["-h", host, "-p", port, "-U", user, "-d", "postgres", "-q"];
if (run(pgIsReady, readyArgs, { quiet: true }) !== 0) {
  console.log(`Local PostgreSQL ${host}:${port} дээр асааж байна...`);
  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Start-Process -FilePath '${pgCtl}' -ArgumentList 'start','-D','${dataDirectory}','-l','${logFile}','-w','-t','20' -Wait`
    ], { quiet: true });
  } else {
    run(pgCtl, ["start", "-D", dataDirectory, "-l", logFile, "-w", "-t", "20"], { quiet: true });
  }
}

const createStatus = run(createdb, ["-h", host, "-p", port, "-U", user, database], { quiet: true });
if (createStatus !== 0) {
  // Database өмнө нь байсан тохиолдолд createdb non-zero буцаадаг.
  const databaseReady = run(pgIsReady, ["-h", host, "-p", port, "-U", user, "-d", database, "-q"], { quiet: true }) === 0;
  if (!databaseReady) throw new Error(`Local PostgreSQL дээр ${database} database үүсгэж чадсангүй.`);
}

console.log(`✓ Local PostgreSQL бэлэн: ${host}:${port}/${database}`);
