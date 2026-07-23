type CacheRecord<T> = {
  value?: T;
  updatedAt: number;
  request?: Promise<T>;
};

const store = new Map<string, CacheRecord<unknown>>();
const requestsByUrl = new Map<string, Promise<unknown>>();

function canonicalUrl(url: string) {
  if (typeof window === "undefined") return url;
  const parsed = new URL(url, window.location.origin);
  parsed.hash = "";
  return `${parsed.pathname}${parsed.search}`;
}

export function peekCachedJson<T>(key: string): T | null {
  return (store.get(key)?.value as T | undefined) ?? null;
}

export function setCachedJson<T>(key: string, value: T) {
  store.set(key, { value, updatedAt: Date.now() });
  return value;
}

export function invalidateCachedJson(key: string) {
  store.delete(key);
}

export function invalidateCachedJsonPrefix(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}

export function requestCachedJson<T>(key: string, url: string, ttl = 60_000, force = false): Promise<T> {
  const cached = store.get(key) as CacheRecord<T> | undefined;
  if (!force && cached?.value !== undefined && Date.now() - cached.updatedAt < ttl) {
    return Promise.resolve(cached.value);
  }
  if (cached?.request) return cached.request;

  const requestUrl = canonicalUrl(url);
  const existingRequest = requestsByUrl.get(requestUrl) as Promise<T> | undefined;
  if (existingRequest) {
    const sharedRequest = existingRequest
      .then(value => setCachedJson(key, value))
      .catch(error => {
        if (cached?.value !== undefined) return cached.value;
        throw error;
      })
      .finally(() => {
        const current = store.get(key) as CacheRecord<T> | undefined;
        if (current?.request) {
          store.set(key, { value: current.value, updatedAt: current.updatedAt });
        }
      });
    store.set(key, { value: cached?.value, updatedAt: cached?.updatedAt ?? 0, request: sharedRequest });
    return sharedRequest;
  }

  const request = fetch(url, { credentials: "same-origin" })
    .then(async response => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const value = await response.json() as T;
      store.set(key, { value, updatedAt: Date.now() });
      return value;
    })
    .catch(error => {
      if (cached?.value !== undefined) return cached.value;
      throw error;
    })
    .finally(() => {
      requestsByUrl.delete(requestUrl);
      const current = store.get(key) as CacheRecord<T> | undefined;
      if (current?.request) store.set(key, { value: current.value, updatedAt: current.updatedAt });
    });

  requestsByUrl.set(requestUrl, request);
  store.set(key, { value: cached?.value, updatedAt: cached?.updatedAt ?? 0, request });
  return request;
}
