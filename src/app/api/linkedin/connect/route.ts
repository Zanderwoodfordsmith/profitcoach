import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encodeLinkedInState } from "@/lib/linkedinOAuth";

const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"];

export async function GET(request: Request) {
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? "";
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? "";
  const stateSecret =
    process.env.LINKEDIN_STATE_SECRET ?? process.env.LINKEDIN_CLIENT_SECRET ?? "";

  if (!clientId || !redirectUri || !stateSecret) {
    return NextResponse.json(
      { error: "LinkedIn OAuth is not configured." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const now = Math.floor(Date.now() / 1000);
  const state = encodeLinkedInState(
    {
      uid: user.id,
      nonce: randomBytes(12).toString("hex"),
      iat: now,
      exp: now + 60 * 10,
    },
    stateSecret
  );

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ url: authUrl.toString() });
}
