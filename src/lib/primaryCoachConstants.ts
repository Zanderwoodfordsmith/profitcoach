/**
 * Primary / demo coach constants and pure helpers, safe to import from the
 * browser. Server-only lookups stay in primaryCoach.ts (which re-exports these).
 */

// TEMP: Profit Coach GHL snapshot testing — revert to Pam when done.
/** Default account for general /score and /landing traffic with no ?coach= slug. */
export const PRIMARY_COACH_EMAIL =
  process.env.PRIMARY_COACH_EMAIL?.trim() ||
  "profit-coach-snapshot@businesscoachacademy.com";

/** Client-safe slug when env is set; server resolves by email when unset. */
export const PRIMARY_COACH_SLUG_FALLBACK =
  process.env.NEXT_PUBLIC_PRIMARY_COACH_SLUG?.trim().toLowerCase() ||
  process.env.PRIMARY_COACH_SLUG?.trim().toLowerCase() ||
  "profit-coach-snapshot";

/** Snapshot location default booking calendar embed (ProCoach Platform). */
export const PRIMARY_COACH_CALENDAR_EMBED_CODE =
  '<iframe src="https://link.procoachplatform.com/widget/booking/8jyZoTDwjgn8kTDZlv7y" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8jyZoTDwjgn8kTDZlv7y_1779350600944"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>';

/** GHL snapshot location (see docs/ghl-lead-webhook.md). */
export const PRIMARY_COACH_LEAD_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/nkMdG4ieburQlR9ypQYd/webhook-trigger/UtLyJ7v3Vph4rBhSztbH";

export const PRIMARY_COACH_GHL_LOCATION_ID = "nkMdG4ieburQlR9ypQYd";
export const PRIMARY_COACH_GHL_CALENDAR_ID = "8jyZoTDwjgn8kTDZlv7y";

/** Internal marketing / GHL / QA demo accounts — not real member join dates. */
export const DEMO_COACH_SLUG = "zander-demo";
export const DEMO_COACH_LABEL = "Zander Demo";
/** Pam's staff coach identity (same auth user as her admin login). */
export const PAM_DEMO_COACH_SLUG = "pam";
export const PAM_DEMO_COACH_LABEL = "Pam Woodford";

const SYSTEM_COACH_SLUGS = new Set([
  PRIMARY_COACH_SLUG_FALLBACK,
  DEMO_COACH_SLUG,
  PAM_DEMO_COACH_SLUG,
]);

export function isSystemCoachSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return SYSTEM_COACH_SLUGS.has(slug.trim().toLowerCase());
}

/** Join date for admin charts; explicit dates win; system accounts skip created_at fallback. */
export function resolveCoachJoinedAt(
  slug: string | null | undefined,
  options: {
    discoCommunityJoinedOn?: string | null;
    profileCreatedAt?: string | null;
  }
): string | null {
  if (options.discoCommunityJoinedOn) {
    return options.discoCommunityJoinedOn;
  }
  if (isSystemCoachSlug(slug)) return null;
  return (options.profileCreatedAt as string | null | undefined) ?? null;
}

export function getPrimaryCoachSlug(): string {
  return PRIMARY_COACH_SLUG_FALLBACK;
}
