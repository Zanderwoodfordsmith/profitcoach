/**
 * In-memory stale-while-revalidate cache for Get Clients hub lists.
 * AuthZ still happens on every network fetch; this is a paint cache only.
 * Never persist to localStorage / sessionStorage — payloads include PII.
 */

export const HUB_STALE_MS = 15_000;
export const HUB_GC_MS = 10 * 60 * 1000;

type Entry<T> = {
  data: T | undefined;
  at: number;
  inflight: Promise<T> | null;
};

const cache = new Map<string, Entry<unknown>>();

function gc(now = Date.now()) {
  for (const [key, entry] of cache) {
    if (entry.inflight) continue;
    if (now - entry.at > HUB_GC_MS) cache.delete(key);
  }
}

export function peekHubQuery<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || entry.data === undefined) return undefined;
  // at === 0 means invalidated-but-keep for instant paint
  if (entry.at > 0 && Date.now() - entry.at > HUB_GC_MS) {
    if (!entry.inflight) cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function isHubQueryFresh(
  key: string,
  staleMs: number = HUB_STALE_MS
): boolean {
  const entry = cache.get(key);
  if (!entry || entry.data === undefined || entry.at === 0) return false;
  return Date.now() - entry.at < staleMs;
}

export function writeHubQuery<T>(key: string, data: T): void {
  gc();
  const prev = cache.get(key) as Entry<T> | undefined;
  cache.set(key, {
    data,
    at: Date.now(),
    inflight: prev?.inflight ?? null,
  });
}

export function patchHubQuery<T>(key: string, updater: (prev: T) => T): void {
  const prev = peekHubQuery<T>(key);
  if (prev === undefined) return;
  writeHubQuery(key, updater(prev));
}

export function invalidateHubQuery(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.at = 0;
}

export function clearHubQueries(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function fetchHubQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean; staleMs?: number }
): Promise<T> {
  const staleMs = opts?.staleMs ?? HUB_STALE_MS;
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing?.inflight) return existing.inflight;
  if (
    existing &&
    existing.data !== undefined &&
    !opts?.force &&
    Date.now() - existing.at < staleMs
  ) {
    return existing.data;
  }

  const request = fetcher()
    .then((data) => {
      const cur = cache.get(key) as Entry<T> | undefined;
      cache.set(key, {
        data,
        at: Date.now(),
        inflight: cur?.inflight === request ? null : cur?.inflight ?? null,
      });
      return data;
    })
    .catch((err) => {
      const cur = cache.get(key) as Entry<T> | undefined;
      if (cur?.inflight === request) cur.inflight = null;
      throw err;
    });

  cache.set(key, {
    data: existing?.data,
    at: existing?.at ?? 0,
    inflight: request,
  });
  return request;
}
