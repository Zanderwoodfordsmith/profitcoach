import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Default account for general /score and /landing traffic with no ?coach= slug. */
export const PRIMARY_COACH_EMAIL =
  process.env.PRIMARY_COACH_EMAIL?.trim() || "pam@businesscoachacademy.com";

/** Client-safe slug when env is set; server resolves by email when unset. */
export const PRIMARY_COACH_SLUG_FALLBACK =
  process.env.NEXT_PUBLIC_PRIMARY_COACH_SLUG?.trim().toLowerCase() ||
  process.env.PRIMARY_COACH_SLUG?.trim().toLowerCase() ||
  "pam";

/** Pam's default booking calendar embed (ProCoach Platform). */
export const PRIMARY_COACH_CALENDAR_EMBED_CODE =
  '<iframe src="https://link.procoachplatform.com/widget/booking/YBxvoiQH6HcHjHYrOWkU" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8gGuCLQODMv5nY2iZQB9_1779293123369"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>';

let cachedPrimaryCoachSlug: string | null = null;

export function getPrimaryCoachSlug(): string {
  return PRIMARY_COACH_SLUG_FALLBACK;
}

async function lookupSlugByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    console.error("primaryCoach listUsers:", error);
    return null;
  }

  const user = (data.users ?? []).find(
    (u) => (u.email ?? "").trim().toLowerCase() === normalized
  );
  if (!user?.id) return null;

  const { data: coach, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();

  if (coachError) {
    console.error("primaryCoach coach lookup:", coachError);
    return null;
  }

  const slug = (coach?.slug as string | undefined)?.trim().toLowerCase();
  return slug || null;
}

/** Server: resolve coaches.slug for the primary marketing coach (Pam by default). */
export async function resolvePrimaryCoachSlug(): Promise<string> {
  if (cachedPrimaryCoachSlug) return cachedPrimaryCoachSlug;

  const envSlug = process.env.PRIMARY_COACH_SLUG?.trim().toLowerCase();
  if (envSlug) {
    cachedPrimaryCoachSlug = envSlug;
    return envSlug;
  }

  const slug = await lookupSlugByEmail(PRIMARY_COACH_EMAIL);
  if (slug) {
    cachedPrimaryCoachSlug = slug;
    return slug;
  }

  cachedPrimaryCoachSlug = PRIMARY_COACH_SLUG_FALLBACK;
  return cachedPrimaryCoachSlug;
}
