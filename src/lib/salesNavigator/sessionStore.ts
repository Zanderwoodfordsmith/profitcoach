import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SalesNavSessionMeta = {
  updatedAt: string;
  hasCookie: boolean;
  userAgent: string | null;
};

export async function getSalesNavSessionCookie(
  userId: string
): Promise<{ cookie: string; userAgent: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("sales_nav_sessions")
    .select("cookie_json, user_agent")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.cookie_json?.trim()) return null;
  return {
    cookie: data.cookie_json.trim(),
    userAgent: data.user_agent?.trim() || null,
  };
}

export async function getSalesNavSessionMeta(
  userId: string
): Promise<SalesNavSessionMeta | null> {
  const { data, error } = await supabaseAdmin
    .from("sales_nav_sessions")
    .select("updated_at, user_agent, cookie_json")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.cookie_json?.trim()) return null;
  return {
    updatedAt: data.updated_at,
    hasCookie: true,
    userAgent: data.user_agent ?? null,
  };
}

export async function upsertSalesNavSession(opts: {
  userId: string;
  cookieJson: string;
  userAgent?: string | null;
}): Promise<SalesNavSessionMeta> {
  const cookie = opts.cookieJson.trim();
  if (!cookie) throw new Error("Cookie payload is empty.");

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sales_nav_sessions")
    .upsert(
      {
        user_id: opts.userId,
        cookie_json: cookie,
        user_agent: opts.userAgent?.trim() || null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select("updated_at, user_agent")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save Sales Nav session.");
  }

  return {
    updatedAt: data.updated_at,
    hasCookie: true,
    userAgent: data.user_agent ?? null,
  };
}

export async function deleteSalesNavSession(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("sales_nav_sessions")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
