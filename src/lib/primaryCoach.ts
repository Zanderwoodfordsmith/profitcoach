import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { splitFullName } from "@/lib/splitFullName";
import {
  isSystemCoachSlug,
  PRIMARY_COACH_CALENDAR_EMBED_CODE,
  PRIMARY_COACH_EMAIL,
  PRIMARY_COACH_GHL_CALENDAR_ID,
  PRIMARY_COACH_GHL_LOCATION_ID,
  PRIMARY_COACH_LEAD_WEBHOOK_URL,
  PRIMARY_COACH_SLUG_FALLBACK,
} from "@/lib/primaryCoachConstants";

export * from "@/lib/primaryCoachConstants";

let cachedPrimaryCoachSlug: string | null = null;

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
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
  return user?.id ?? null;
}

async function lookupSlugByEmail(email: string): Promise<string | null> {
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) return null;

  const { data: coach, error: coachError } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", userId)
    .maybeSingle();

  if (coachError) {
    console.error("primaryCoach coach lookup:", coachError);
    return null;
  }

  const slug = (coach?.slug as string | undefined)?.trim().toLowerCase();
  return slug || null;
}

/** Server: resolve coaches.slug for the primary marketing coach. */
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

async function slugTakenByOtherCoach(
  slug: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .neq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("primaryCoach slug conflict check:", error);
    return true;
  }

  return Boolean(data?.id);
}

async function upsertPrimaryCoachRowForUser(userId: string): Promise<void> {
  const slug = PRIMARY_COACH_SLUG_FALLBACK;
  const displayName =
    slug === "profit-coach-snapshot"
      ? "Profit Coach Snapshot"
      : "Primary Coach";

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      role: "coach",
      full_name: displayName,
      coach_business_name: displayName,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    console.error("primaryCoach profile upsert:", profileError);
  }

  const coachRow: Record<string, unknown> = {
    id: userId,
    slug,
    record_kind: isSystemCoachSlug(slug) ? "system" : "member",
    calendar_embed_code: PRIMARY_COACH_CALENDAR_EMBED_CODE,
  };

  if (slug === "profit-coach-snapshot") {
    coachRow.lead_webhook_url = PRIMARY_COACH_LEAD_WEBHOOK_URL;
    coachRow.crm_location_id = PRIMARY_COACH_GHL_LOCATION_ID;
    coachRow.ghl_calendar_id = PRIMARY_COACH_GHL_CALENDAR_ID;
  }

  const slugConflict = await slugTakenByOtherCoach(slug, userId);
  if (slugConflict) {
    console.error(
      `primaryCoach: slug "${slug}" is already used by another coach`
    );
    const { calendar_embed_code, lead_webhook_url, crm_location_id, ghl_calendar_id, record_kind } =
      coachRow;
    const { error: updateError } = await supabaseAdmin
      .from("coaches")
      .update({
        calendar_embed_code,
        lead_webhook_url,
        crm_location_id,
        ghl_calendar_id,
        record_kind,
      })
      .eq("id", userId);
    if (updateError) {
      console.error("primaryCoach coaches update (slug conflict):", updateError);
    }
    return;
  }

  const { error: coachError } = await supabaseAdmin
    .from("coaches")
    .upsert(coachRow, { onConflict: "id" });

  if (coachError) {
    console.error("primaryCoach coaches upsert:", coachError);
  }
}

async function provisionPrimaryCoachAuthUser(): Promise<{ id: string } | null> {
  if (process.env.AUTO_PROVISION_PRIMARY_COACH === "false") {
    return null;
  }

  const email = PRIMARY_COACH_EMAIL;
  // Web Crypto (Node 19+ and browsers): importing Node "crypto" here pulled a
  // 120KB polyfill into every page that shows the account menu.
  const password = `${globalThis.crypto.randomUUID()}Aa1!`;
  const displayName =
    PRIMARY_COACH_SLUG_FALLBACK === "profit-coach-snapshot"
      ? "Profit Coach Snapshot"
      : "Primary Coach";
  const { first_name, last_name } = splitFullName(displayName);

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { profit_coach_primary_placeholder: true },
    });

  if (authError || !authData?.user) {
    const existingId = await findAuthUserIdByEmail(email);
    if (existingId) {
      await upsertPrimaryCoachRowForUser(existingId);
      return { id: existingId };
    }
    console.error("primaryCoach provision (auth):", authError);
    return null;
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    role: "coach",
    full_name: displayName,
    first_name,
    last_name,
    coach_business_name: displayName,
  });

  if (profileError) {
    console.error("primaryCoach provision (profile):", profileError);
    return null;
  }

  await upsertPrimaryCoachRowForUser(userId);
  return { id: userId };
}

/**
 * Ensures the primary coach has a coaches row (and GHL fields for snapshot).
 * Used by /score and general funnel when migration has not been applied yet.
 */
export async function ensurePrimaryCoachRow(): Promise<{ id: string } | null> {
  const slug = await resolvePrimaryCoachSlug();

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) {
    console.error("primaryCoach slug lookup:", lookupError);
    return null;
  }
  if (existing?.id) return { id: existing.id as string };

  let userId = await findAuthUserIdByEmail(PRIMARY_COACH_EMAIL);
  if (!userId) {
    const provisioned = await provisionPrimaryCoachAuthUser();
    if (!provisioned) return null;
    userId = provisioned.id;
  } else {
    await upsertPrimaryCoachRowForUser(userId);
  }

  const { data: after, error: afterError } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (afterError) {
    console.error("primaryCoach post-upsert lookup:", afterError);
    return null;
  }

  if (after?.id) return { id: after.id as string };

  const { data: byUserId } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  return byUserId?.id ? { id: byUserId.id as string } : null;
}

export function primaryCoachSetupErrorMessage(): string {
  return `Primary coach is not set up. Ensure slug "${PRIMARY_COACH_SLUG_FALLBACK}" exists (auth user ${PRIMARY_COACH_EMAIL} with a coaches row), or run migration 20260722120000_profit_coach_snapshot_coach.sql.`;
}
