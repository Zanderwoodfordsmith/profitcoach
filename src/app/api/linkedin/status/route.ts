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
    .select(
      "linkedin_sub, scope, token_expires_at, updated_at, access_token, display_headline, website_label, website_url, quote_handle"
    )
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
    picture: string | null;
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
          picture?: string;
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
          picture: body.picture ?? null,
        };
      }
    } catch {
      // Best-effort only.
    }
  }

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
          picture: account?.picture ?? null,
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
      picture: null,
    };
  }

  const [{ data: liSnap }, { data: profileRow }] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("snapshot")
      .eq("coach_id", auth.userId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, last_name, avatar_url")
      .eq("id", auth.userId)
      .maybeSingle(),
  ]);

  const snap = (liSnap?.snapshot ?? null) as {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    headline?: string | null;
    photoUrl?: string | null;
  } | null;

  const oauthName =
    account?.name ||
    [account?.first_name, account?.last_name].filter(Boolean).join(" ").trim() ||
    null;
  const snapName =
    snap?.fullName ||
    [snap?.firstName, snap?.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const profileName =
    profileRow?.full_name ||
    [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(" ").trim() ||
    null;

  const identityName = oauthName || profileName || (snapName || null);

  // Headline/photo come from the LinkedIn scrape when present. OAuth OpenID
  // never returns headline — only name/email/picture.
  const savedHeadline =
    typeof data?.display_headline === "string" && data.display_headline.trim()
      ? data.display_headline.trim()
      : null;

  const profile = {
    name: identityName,
    headline: savedHeadline || snap?.headline || null,
    photo_url:
      profileRow?.avatar_url ||
      account?.picture ||
      snap?.photoUrl ||
      null,
    website_label:
      (typeof data?.website_label === "string" && data.website_label.trim()) ||
      "Visit my website",
    website_url:
      (typeof data?.website_url === "string" && data.website_url.trim()) || null,
    quote_handle:
      (typeof data?.quote_handle === "string" && data.quote_handle.trim()) ||
      "Profit Coach",
  };

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
    profile,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    display_headline?: string | null;
    website_label?: string | null;
    website_url?: string | null;
    quote_handle?: string | null;
  };

  const { data: existing } = await supabaseAdmin
    .from("linkedin_member_connections")
    .select("user_id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "Connect LinkedIn before saving composer settings." },
      { status: 400 }
    );
  }

  const patch: Record<string, string | null> = {};
  if ("display_headline" in body) {
    patch.display_headline = body.display_headline?.trim() || null;
  }
  if ("website_label" in body) {
    patch.website_label = body.website_label?.trim() || null;
  }
  if ("website_url" in body) {
    patch.website_url = body.website_url?.trim() || null;
  }
  if ("quote_handle" in body) {
    patch.quote_handle = body.quote_handle?.trim() || null;
  }

  const { error } = await supabaseAdmin
    .from("linkedin_member_connections")
    .update(patch)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
