import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireAdminBearer(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized."; userId: null }
  | { error: null; userId: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return { error: "Missing access token.", userId: null };

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) return { error: "Invalid access token.", userId: null };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized.", userId: null };
  }

  return { error: null, userId: user.id };
}
