import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("linkedin_member_connections")
    .select("linkedin_sub, scope, token_expires_at, updated_at, access_token")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load LinkedIn status." }, { status: 500 });
  }

  let account: {
    sub: string | null;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    email_verified: boolean | null;
  } | null = null;

  if (data?.access_token) {
    try {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          sub?: string;
          name?: string;
          given_name?: string;
          family_name?: string;
          email?: string;
          email_verified?: boolean;
        };
        const firstName = body.given_name ?? null;
        const lastName = body.family_name ?? null;
        const parsedName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const fullName = body.name ?? (parsedName || null);
        account = {
          sub: body.sub ?? data.linkedin_sub ?? null,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          email: body.email ?? null,
          email_verified:
            typeof body.email_verified === "boolean" ? body.email_verified : null,
        };
      }
    } catch {
      // Best-effort only; keep status endpoint resilient.
    }
  }

  // Fallback for apps where /v2/userinfo omits profile names.
  if (
    data?.access_token &&
    (!account || (!account.first_name && !account.last_name && !account.name))
  ) {
    try {
      const res = await fetch(
        "https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)",
        {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          id?: string;
          localizedFirstName?: string;
          localizedLastName?: string;
        };
        const firstName = body.localizedFirstName ?? account?.first_name ?? null;
        const lastName = body.localizedLastName ?? account?.last_name ?? null;
        const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
        account = {
          sub: account?.sub ?? body.id ?? data.linkedin_sub ?? null,
          name: account?.name ?? name,
          first_name: firstName,
          last_name: lastName,
          email: account?.email ?? null,
          email_verified: account?.email_verified ?? null,
        };
      }
    } catch {
      // Best-effort only.
    }
  }

  if (!account && data) {
    account = {
      sub: data.linkedin_sub ?? null,
      name: null,
      first_name: null,
      last_name: null,
      email: null,
      email_verified: null,
    };
  }

  return NextResponse.json({
    connected: !!data,
    connection: data
      ? {
          linkedin_sub: data.linkedin_sub,
          scope: data.scope,
          token_expires_at: data.token_expires_at,
          updated_at: data.updated_at,
        }
      : null,
    account,
  });
}
