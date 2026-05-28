import type { ReadonlyURLSearchParams } from "next/navigation";

/** Copy search params for redirect but drop `variant` (not used on /score for now). */
export function searchParamsWithoutVariant(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): string {
  const sp = new URLSearchParams(searchParams.toString());
  sp.delete("variant");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** `/score` → landing D (main) or B when `?variant=b`. */
export function resolveScoreLandingPath(
  searchParams: URLSearchParams,
  coachSlug?: string
): string {
  const variant = searchParams.get("variant")?.trim().toLowerCase();
  const landingVariant = variant === "b" ? "b" : "d";
  const sp = new URLSearchParams(searchParams.toString());
  if (coachSlug?.trim()) sp.set("coach", coachSlug.trim());
  sp.delete("variant");
  const q = sp.toString();
  return q ? `/landing/${landingVariant}?${q}` : `/landing/${landingVariant}`;
}
