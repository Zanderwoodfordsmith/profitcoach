import { isCashFlowForecastAllowedEmail } from "@/lib/cashFlowForecastAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireForecastAccess(request: Request): Promise<
  | {
      error:
        | "Missing access token."
        | "Invalid access token."
        | "Not authorized."
        | "Server error.";
      userId: null;
      email: null;
    }
  | { error: null; userId: string; email: string }
> {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim() || null;

    if (!token) {
      return { error: "Missing access token." as const, userId: null, email: null };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user?.email) {
      return { error: "Invalid access token." as const, userId: null, email: null };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !isCashFlowForecastAllowedEmail(user.email)
    ) {
      return { error: "Not authorized." as const, userId: null, email: null };
    }

    return { error: null, userId: user.id, email: user.email };
  } catch (err) {
    console.error("requireForecastAccess error:", err);
    return { error: "Server error." as const, userId: null, email: null };
  }
}
