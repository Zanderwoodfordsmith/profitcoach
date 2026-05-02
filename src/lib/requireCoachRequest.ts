import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireCoachRequest(request: Request): Promise<
  | {
      error:
        | "Missing access token."
        | "Invalid access token."
        | "Not authorized."
        | "Admin must pass x-impersonate-coach-id for this resource.";
      userId: null;
    }
  | { error: null; userId: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
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
    return { error: "Not authorized." as const, userId: null };
  }

  if (profile.role === "admin" && !impersonateId) {
    return {
      error: "Admin must pass x-impersonate-coach-id for this resource." as const,
      userId: null,
    };
  }

  return { error: null, userId: effectiveId as string };
}
