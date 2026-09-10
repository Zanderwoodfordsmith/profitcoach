import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() || "";
  return normalized.includes("@") ? normalized : null;
}

async function coachProfileIdIfEligible(
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .in("role", ["coach", "admin"])
    .maybeSingle();
  return (profile?.id as string | null) ?? null;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  // Paginate — GoTrue has no reliable exact-email filter on all versions.
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) return null;
    const users = data.users ?? [];
    const match = users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === email
    );
    if (match?.id) return match.id;
    if (users.length < perPage) break;
  }
  return null;
}

/**
 * Resolve a coach/admin profile for an inbound support From-address.
 * Order: explicit alias → Auth login email (coach/admin only).
 */
export async function findCoachProfileIdByEmail(
  email: string | null | undefined
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { data: alias } = await supabaseAdmin
    .from("support_email_aliases")
    .select("profile_id")
    .eq("email", normalized)
    .maybeSingle();
  if (alias?.profile_id) {
    const eligible = await coachProfileIdIfEligible(alias.profile_id as string);
    if (eligible) return eligible;
  }

  const authUserId = await findAuthUserIdByEmail(normalized);
  if (!authUserId) return null;
  return coachProfileIdIfEligible(authUserId);
}

/**
 * Remember contact_email → coach so future mailbox mail auto-links.
 * No-op when email missing or profile is not coach/admin.
 */
export async function rememberSupportEmailAlias(input: {
  email: string | null | undefined;
  profileId: string;
  createdBy?: string | null;
}): Promise<void> {
  const normalized = normalizeEmail(input.email);
  if (!normalized) return;

  const eligible = await coachProfileIdIfEligible(input.profileId);
  if (!eligible) return;

  await supabaseAdmin.from("support_email_aliases").upsert(
    {
      email: normalized,
      profile_id: eligible,
      created_by: input.createdBy ?? null,
    },
    { onConflict: "email" }
  );
}
