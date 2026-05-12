import type { ReadonlyURLSearchParams } from "next/navigation";

export type FunnelVariant = "a" | "b" | "c" | "d";

export type ScoreRouteVariant = "score-a" | "score-b";

const SCORE_VARIANT_COOKIE = "score_variant";

export function getScoreVariantCookie(): ScoreRouteVariant | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^| )${SCORE_VARIANT_COOKIE}=(score-a|score-b)`)
  );
  return match ? (match[1] as ScoreRouteVariant) : null;
}

export function setScoreVariantCookie(variant: ScoreRouteVariant) {
  if (typeof document === "undefined") return;
  document.cookie = `${SCORE_VARIANT_COOKIE}=${variant};path=/;max-age=2592000`;
}

/**
 * Resolves /score entry to score-a or score-b: explicit ?variant=, cookie,
 * coach landing_variant_preference, then random. Sets cookie when assigning.
 */
export async function resolveScoreEntryRoute(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): Promise<ScoreRouteVariant> {
  const explicit = parseVariantQueryParam(searchParams);
  if (explicit) {
    const route = funnelVariantToScoreRoute(explicit);
    setScoreVariantCookie(route);
    return route;
  }
  const existing = getScoreVariantCookie();
  if (existing) return existing;
  const coach = searchParams.get("coach")?.trim() ?? "";
  const pref = coach ? await fetchCoachLandingVariantPreference(coach) : null;
  const route: ScoreRouteVariant =
    pref === "a"
      ? "score-a"
      : pref === "b"
        ? "score-b"
        : pref === "c" || pref === "d"
          ? "score-a"
          : Math.random() < 0.5
            ? "score-a"
            : "score-b";
  setScoreVariantCookie(route);
  return route;
}

export function parseVariantQueryParam(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): FunnelVariant | null {
  const v = searchParams.get("variant")?.trim().toLowerCase();
  if (v === "a" || v === "b" || v === "c" || v === "d") return v;
  return null;
}

export function funnelVariantToScoreRoute(v: FunnelVariant): ScoreRouteVariant {
  return v === "b" ? "score-b" : "score-a";
}

export function scoreRouteToFunnelVariant(route: ScoreRouteVariant): FunnelVariant {
  return route === "score-a" ? "a" : "b";
}

export async function fetchCoachLandingVariantPreference(
  coachSlug: string
): Promise<FunnelVariant | null> {
  const slug = coachSlug.trim();
  if (!slug) return null;
  try {
    const res = await fetch(
      `/api/coach-by-slug?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { landing_variant_preference?: string | null };
    const p = j.landing_variant_preference?.trim().toLowerCase();
    if (p === "a" || p === "b" || p === "c" || p === "d") return p;
    return null;
  } catch {
    return null;
  }
}

/** Copy search params for redirect but drop `variant` (already applied to path/cookie). */
export function searchParamsWithoutVariant(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): string {
  const sp = new URLSearchParams(searchParams.toString());
  sp.delete("variant");
  const s = sp.toString();
  return s ? `?${s}` : "";
}
