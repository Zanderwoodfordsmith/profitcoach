import { isCoachClientHubAllowedEmail } from "@/lib/coachClientHubAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function coachClientHubEmailForUserId(
  userId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function isCoachClientHubAllowedUserId(
  userId: string
): Promise<boolean> {
  const email = await coachClientHubEmailForUserId(userId);
  return isCoachClientHubAllowedEmail(email);
}
