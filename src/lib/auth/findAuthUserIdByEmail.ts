import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Resolve auth user id by email without sending mail.
 * Uses admin generateLink (link is discarded); returns null if the user does not exist.
 */
export async function findAuthUserIdByEmail(
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });

  if (error || !data.user?.id) return null;
  return data.user.id;
}
