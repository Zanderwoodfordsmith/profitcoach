import { parseCoachIdHeader } from "@/lib/coachId";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";

export async function requireCoachRequest(
  request: Request,
  options?: {
    /**
     * When true, admins may access the resource as themselves (no
     * x-impersonate-coach-id). Used for account settings (profile/avatar).
     * Other coach resources still require impersonation.
     */
    allowAdminSelf?: boolean;
  }
): Promise<
  | {
      error:
        | "Missing access token."
        | "Invalid access token."
        | "Not authorized."
        | "Admin must pass x-impersonate-coach-id for this resource.";
      userId: null;
    }
  | {
      error: null;
      /** The coach being acted on: the caller, or the coach an admin is acting as. */
      userId: string;
      /** Who is signed in. */
      callerId: string;
      callerIsAdmin: boolean;
    }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const user = await verifyAccessToken(token);

  if (!user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = parseCoachIdHeader(
    request.headers.get("x-impersonate-coach-id")
  );
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  if (
    profile.role === "admin" &&
    !impersonateId &&
    !options?.allowAdminSelf
  ) {
    return {
      error: "Admin must pass x-impersonate-coach-id for this resource." as const,
      userId: null,
    };
  }

  return {
    error: null,
    userId: effectiveId as string,
    callerId: user.id,
    callerIsAdmin: profile.role === "admin",
  };
}
