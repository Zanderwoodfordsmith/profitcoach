import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuthFail = {
  error: "Missing access token." | "Invalid access token." | "Not authorized.";
  userId: null;
  role: null;
};

type AuthOk = {
  error: null;
  userId: string;
  role: "admin" | "coach";
};

/**
 * Content publisher: admin or coach (Unipile-backed posting).
 */
export async function requireContentPublisher(
  request: Request
): Promise<AuthFail | AuthOk> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) return { error: "Missing access token.", userId: null, role: null };

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return { error: "Invalid access token.", userId: null, role: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (role === "admin") {
    return { error: null, userId: user.id, role: "admin" };
  }
  if (role === "coach") {
    return { error: null, userId: user.id, role: "coach" };
  }

  return { error: "Not authorized.", userId: null, role: null };
}

/** @deprecated Prefer requireContentPublisher — kept for older call sites. */
export async function requireAdminBearer(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized."; userId: null }
  | { error: null; userId: string }
> {
  const auth = await requireContentPublisher(request);
  if (auth.error || !auth.userId) {
    return { error: auth.error ?? "Not authorized.", userId: null };
  }
  if (auth.role !== "admin") {
    return { error: "Not authorized.", userId: null };
  }
  return { error: null, userId: auth.userId };
}
