import { requireAdmin } from "@/lib/requireAdmin";

/**
 * Voice cloning is admin-only for now. Target coach is the impersonated coach
 * when present, otherwise the admin's own profile (e.g. /admin/account).
 */
export async function requireAdminCoachVoiceTarget(request: Request): Promise<
  | {
      error:
        | "Missing access token."
        | "Invalid access token."
        | "Not authorized."
        | "Server error.";
      adminId: null;
      coachId: null;
    }
  | { error: null; adminId: string; coachId: string }
> {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return {
      error: auth.error ?? "Not authorized.",
      adminId: null,
      coachId: null,
    };
  }

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  return {
    error: null,
    adminId: auth.userId,
    coachId: impersonateId || auth.userId,
  };
}
