import type { LandingActor, LandingStatKind } from "@/lib/landingActors";

const actorsCache = new Map<string, LandingActor[]>();

function cacheKey(
  kind: LandingStatKind,
  from: string,
  to: string,
  impersonatingCoachId: string | null
): string {
  return `${impersonatingCoachId ?? "self"}:${kind}:${from}:${to}`;
}

export async function fetchLandingStatActors(
  kind: LandingStatKind,
  rangeQuery: string,
  accessToken: string,
  impersonatingCoachId: string | null
): Promise<LandingActor[]> {
  const key = cacheKey(
    kind,
    new URLSearchParams(rangeQuery).get("from") ?? "",
    new URLSearchParams(rangeQuery).get("to") ?? "",
    impersonatingCoachId
  );

  const cached = actorsCache.get(key);
  if (cached) return cached;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (impersonatingCoachId) {
    headers["x-impersonate-coach-id"] = impersonatingCoachId;
  }

  const params = new URLSearchParams(rangeQuery);
  params.set("kind", kind);

  const res = await fetch(`/api/coach/landing/actors?${params.toString()}`, {
    headers,
  });
  const body = (await res.json().catch(() => ({}))) as {
    actors?: LandingActor[];
    error?: string;
  };

  if (!res.ok) {
    throw new Error(body.error ?? "Unable to load landing stats.");
  }

  const actors = body.actors ?? [];
  actorsCache.set(key, actors);
  return actors;
}
