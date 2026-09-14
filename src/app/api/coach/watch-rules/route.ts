import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  isWatchEvent,
  type WatchScopeKind,
} from "@/lib/coachWatch/rules";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function asScopeKind(value: unknown): WatchScopeKind | null {
  return value === "campaign" || value === "magnet" ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const scopeKind = asScopeKind(url.searchParams.get("scope_kind"));
  const scopeId = url.searchParams.get("scope_id")?.trim() || "";
  if (!scopeKind || !scopeId) {
    return NextResponse.json({ error: "Missing scope." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_watch_rules")
    .select("id, scope_kind, scope_id, event, in_app, email, whatsapp")
    .eq("coach_id", auth.coachId)
    .eq("scope_kind", scopeKind)
    .eq("scope_id", scopeId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    scope_kind?: string;
    scope_id?: string;
    event?: string;
    in_app?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  };
  const scopeKind = asScopeKind(body.scope_kind);
  const scopeId = body.scope_id?.trim() || "";
  const event = body.event?.trim() || "";
  if (!scopeKind || !scopeId || !isWatchEvent(scopeKind, event)) {
    return NextResponse.json({ error: "Invalid watch rule." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_watch_rules")
    .upsert(
      {
        coach_id: auth.coachId,
        scope_kind: scopeKind,
        scope_id: scopeId,
        event,
        in_app: body.in_app !== false,
        email: Boolean(body.email),
        whatsapp: Boolean(body.whatsapp),
      },
      { onConflict: "coach_id,scope_kind,scope_id,event" }
    )
    .select("id, scope_kind, scope_id, event, in_app, email, whatsapp")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rule: data });
}
