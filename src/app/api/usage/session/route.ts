import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  sessionId?: string | null;
  eventType?: "page_view" | "heartbeat";
  path?: string | null;
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
type ActiveSession = {
  id: string;
  last_activity_at: string;
  page_views: number;
  heartbeat_count: number;
};

function cleanPath(path: string | null | undefined): string {
  const raw = (path ?? "").trim();
  if (!raw) return "/";
  if (!raw.startsWith("/")) return `/${raw}`;
  return raw.slice(0, 512);
}

export async function POST(request: Request) {
  try {
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

    const body = (await request.json().catch(() => ({}))) as Body;
    const path = cleanPath(body.path);
    const eventType: "page_view" | "heartbeat" =
      body.eventType === "heartbeat" ? "heartbeat" : "page_view";

    const nowIso = new Date().toISOString();
    let role: string | null = null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role as string | null) ?? null;

    let activeSession: ActiveSession | null = null;

    const incomingSessionId = body.sessionId?.trim();
    if (incomingSessionId) {
      const { data: existing } = await supabaseAdmin
        .from("app_usage_sessions")
        .select("id, last_activity_at, page_views, heartbeat_count")
        .eq("id", incomingSessionId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();
      activeSession = (existing as ActiveSession | null) ?? null;
    }

    if (activeSession) {
      const lastMs = Date.parse(activeSession.last_activity_at);
      if (!Number.isNaN(lastMs) && Date.now() - lastMs <= SESSION_TIMEOUT_MS) {
        const nextPageViews =
          activeSession.page_views + (eventType === "page_view" ? 1 : 0);
        const nextHeartbeatCount =
          activeSession.heartbeat_count + (eventType === "heartbeat" ? 1 : 0);
        await supabaseAdmin
          .from("app_usage_sessions")
          .update({
            last_activity_at: nowIso,
            last_path: path,
            page_views: nextPageViews,
            heartbeat_count: nextHeartbeatCount,
            role,
          })
          .eq("id", activeSession.id)
          .eq("user_id", user.id);

        return NextResponse.json({ ok: true, sessionId: activeSession.id });
      }

      await supabaseAdmin
        .from("app_usage_sessions")
        .update({ ended_at: activeSession.last_activity_at })
        .eq("id", activeSession.id)
        .eq("user_id", user.id);
    }

    const newSessionId = randomUUID();
    const { error: insertError } = await supabaseAdmin.from("app_usage_sessions").insert({
      id: newSessionId,
      user_id: user.id,
      role,
      started_at: nowIso,
      last_activity_at: nowIso,
      entry_path: path,
      last_path: path,
      page_views: 1,
      heartbeat_count: eventType === "heartbeat" ? 1 : 0,
    });

    if (insertError) {
      return NextResponse.json({ error: "Unable to track usage." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sessionId: newSessionId }, { status: 201 });
  } catch (error) {
    console.error("usage/session POST error:", error);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
