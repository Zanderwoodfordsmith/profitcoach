import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireCoachEffectiveId(request: Request): Promise<
  | { error: string; userId: null; viewerIsAdmin?: false }
  | { error: null; userId: string; viewerIsAdmin: boolean }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token.", userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token.", userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized.", userId: null };
  }

  return {
    error: null,
    userId: effectiveId as string,
    // Role of the actual token holder (not the impersonated coach) — used to
    // gate admin-only AI tools.
    viewerIsAdmin: profile.role === "admin",
  };
}
