import { patchPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Placeholder login email. The `.invalid` domain can never receive mail. */
export function removedAccessEmail(userId: string): string {
  return `removed-${userId}@removed.invalid`;
}

/**
 * Someone has left: keep their name and avatar so their posts still show who
 * wrote them, and take away every way back in and every way to contact them.
 * Safe to run again if a step failed part way.
 */
export async function removeCoachAccess(
  coachId: string
): Promise<{ removedAt: string; error: null } | { removedAt: null; error: string }> {
  // Login first: it is the part that matters most if a later step fails.
  // Replacing the email also frees their real address if they ever rejoin.
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(coachId, {
    email: removedAccessEmail(coachId),
    email_confirm: true,
    ban_duration: "876000h",
  });
  if (authError) {
    console.error("removeCoachAccess auth error:", authError);
    return { removedAt: null, error: "Could not block their login." };
  }

  const removedAt = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      phone: null,
      linkedin_url: null,
      social_links: {},
      discord_user_id: null,
      // The calendar feed works without logging in.
      community_calendar_feed_token: null,
      access_removed_at: removedAt,
    })
    .eq("id", coachId);
  if (profileError) {
    console.error("removeCoachAccess profile error:", profileError);
    return {
      removedAt: null,
      error: "Login is blocked, but their contact details could not be cleared.",
    };
  }

  try {
    await patchPracticeKnowledge({ coachId, linkedinUrl: null });
  } catch (err) {
    console.error("removeCoachAccess blueprint LinkedIn:", err);
    return {
      removedAt: null,
      error: "Login is blocked, but their LinkedIn address could not be cleared.",
    };
  }

  const { error: coachError } = await supabaseAdmin
    .from("coaches")
    .update({
      linked_in_url: null,
      directory_listed: false,
      access_tier: "early_exit",
      access_tier_locked: true,
    })
    .eq("id", coachId);
  if (coachError) {
    console.error("removeCoachAccess coach error:", coachError);
    return {
      removedAt: null,
      error: "Login is blocked, but their directory listing could not be removed.",
    };
  }

  // Other addresses support uses to match their emails to this account.
  const { error: aliasError } = await supabaseAdmin
    .from("support_email_aliases")
    .delete()
    .eq("profile_id", coachId);
  if (aliasError && aliasError.code !== "42P01") {
    console.error("removeCoachAccess support alias error:", aliasError);
    return {
      removedAt: null,
      error: "Login is blocked, but their support email addresses could not be removed.",
    };
  }

  return { removedAt, error: null };
}
