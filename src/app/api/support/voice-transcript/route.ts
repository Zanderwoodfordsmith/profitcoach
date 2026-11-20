import { NextResponse } from "next/server";
import { bearerToken, verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supportVoiceTranscript } from "@/lib/support/voiceTranscript";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The transcript of a Support voice note, made on first ask and saved. */
export async function POST(request: Request) {
  const user = await verifyAccessToken(bearerToken(request));
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const result = await supportVoiceTranscript({ url, userId: user.id, isAdmin: profile?.role === "admin" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ text: result.text });
}
