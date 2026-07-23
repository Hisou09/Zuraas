import postgres from "postgres";
import { env } from "cloudflare:workers";

type Row = Record<string, unknown>;
type QueryResult<T extends Row = Row> = {
  results: T[];
  success: true;
  meta: { changes: number; duration: number; last_row_id: number | null };
};

type RuntimeEnv = {
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString?: string };
};

type PostgresClient = ReturnType<typeof postgres>;

function connectionString() {
  const bindings = env as unknown as RuntimeEnv;
  const url = bindings.HYPERDRIVE?.connectionString || bindings.DATABASE_URL;
  if (!url) {
    throw new Error(
      "PostgreSQL холболт тохируулагдаагүй байна. DATABASE_URL secret эсвэл HYPERDRIVE binding нэмнэ үү.",
    );
  }
  return url;
}

function createClient() {
  const url = connectionString();
  return postgres(url, {
    max: 1,
    fetch_types: false,
    prepare: true,
    idle_timeout: 10,
    connect_timeout: 15,
  });
}

function quoteCamelCaseAliases(query: string) {
  return query.replace(/\bAS\s+([a-z][A-Za-z0-9_]*)/g, (full, alias: string) =>
    /[A-Z]/.test(alias) ? `AS "${alias}"` : full,
  );
}

function replacePlaceholders(query: string) {
  let index = 0;
  let quoted: "'" | '"' | null = null;
  let output = "";
  for (let cursor = 0; cursor < query.length; cursor += 1) {
    const char = query[cursor];
    if (quoted) {
      output += char;
      if (char === quoted) {
        if (query[cursor + 1] === quoted) output += query[++cursor];
        else quoted = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quoted = char;
      output += char;
    } else if (char === "?") output += `$${++index}`;
    else output += char;
  }
  return output;
}

export function postgresQuery(source: string) {
  let query = source.trim().replace(/;$/, "");
  const ignoreConflict = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(query);
  if (ignoreConflict) query = query.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");

  query = query
    .replace(
      /datetime\(CASE WHEN vip_until > CURRENT_TIMESTAMP THEN vip_until ELSE CURRENT_TIMESTAMP END, \?\)/gi,
      "GREATEST(COALESCE(vip_until,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP) + ?::interval",
    )
    .replace(/datetime\('now',\s*\?\)/gi, "(CURRENT_TIMESTAMP + ?::interval)")
    .replace(/datetime\(([^()]+)\)/gi, "($1)::timestamptz")
    .replace(
      /JOIN\s+json_each\(([^)]+)\)\s+media\s+ON\s+media\.value\s*=\s*\?/gi,
      "JOIN LATERAL jsonb_array_elements_text($1::jsonb) media(value) ON media.value=?",
    );

  query = quoteCamelCaseAliases(query);
  if (ignoreConflict && !/\bON\s+CONFLICT\b/i.test(query)) query += " ON CONFLICT DO NOTHING";
  return replacePlaceholders(query);
}

class PostgresStatement {
  private values: unknown[] = [];

  constructor(private readonly source: string) {}

  bind(...values: unknown[]) {
    const statement = new PostgresStatement(this.source);
    statement.values = values;
    return statement;
  }

  async execute<T extends Row = Row>(sql?: PostgresClient): Promise<QueryResult<T>> {
    const started = performance.now();
    const activeClient = sql ?? createClient();
    const ownsClient = !sql;
    try {
      const rows = await activeClient.unsafe(postgresQuery(this.source), this.values as never[]) as unknown as T[] & { count?: number };
      return {
        results: Array.from(rows),
        success: true,
        meta: {
          changes: Number(rows.count || 0),
          duration: performance.now() - started,
          last_row_id: null,
        },
      };
    } finally {
      if (ownsClient) await activeClient.end({ timeout: 2 });
    }
  }

  run<T extends Row = Row>() { return this.execute<T>(); }

  async all<T extends Row = Row>() { return this.execute<T>(); }

  async first<T extends Row = Row>(): Promise<T | null> {
    const result = await this.execute<T>();
    return result.results[0] ?? null;
  }
}

export type PreparedPostgresStatement = PostgresStatement;

export function postgresDatabase() {
  return {
    prepare(query: string) { return new PostgresStatement(query); },
    async batch<T extends PreparedPostgresStatement[]>(statements: [...T]) {
      const activeClient = createClient();
      try {
        return await activeClient.begin(async (transaction) => {
          const results: QueryResult[] = [];
          for (const statement of statements) results.push(await statement.execute(transaction as unknown as PostgresClient));
          return results;
        });
      } finally {
        await activeClient.end({ timeout: 2 });
      }
    },
  };
}
