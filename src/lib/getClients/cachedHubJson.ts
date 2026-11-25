import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { fetchHubQuery, invalidateHubQuery, isHubQueryFresh, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";

/**
 * A coach GET endpoint kept in the hub paint cache, so a tab shows the last
 * answer at once and refreshes behind it. Keyed by the full path (with query).
 */
export function hubJsonKey(path: string): string {
  return hubQueryKey(`json:${path}`);
}

export function peekHubJson<T>(path: string): T | undefined {
  return peekHubQuery<T>(hubJsonKey(path));
}

export function fetchHubJson<T>(
  path: string,
  opts?: { force?: boolean; staleMs?: number }
): Promise<T> {
  return fetchHubQuery<T>(
    hubJsonKey(path),
    async () => {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(path, { headers });
      const body = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not load.");
      return body;
    },
    opts
  );
}

/**
 * Warm a path without caring about the answer. Skipped when it was loaded in
 * the last two minutes, so moving between tabs doesn't ask again each time.
 */
export function prefetchHubJson(path: string): void {
  if (isHubQueryFresh(hubJsonKey(path), 2 * 60 * 1000)) return;
  void fetchHubJson(path).catch(() => undefined);
}

/** After a change, keep the old answer for painting but refetch next time. */
export function invalidateHubJson(path: string): void {
  invalidateHubQuery(hubJsonKey(path));
}
