/** Convert PostgreSQL/SQLite timestamps to milliseconds without throwing. */
export function timestampMs(value: unknown): number {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const source = value.trim();
  if (!source) return 0;
  const normalized = source.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(normalized);
  const time = Date.parse(hasTimezone ? normalized : `${normalized}Z`);
  return Number.isFinite(time) ? time : 0;
}

export function hasActiveVip(value: unknown): boolean {
  return timestampMs(value) > Date.now();
}
