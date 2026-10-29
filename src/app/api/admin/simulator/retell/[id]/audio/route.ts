import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Admin: the recording of one imported Retell practice call. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 401 });
  const { id } = await params;

  const { data: call } = await supabaseAdmin.from("retell_practice_calls").select("recording_path").eq("call_id", id).maybeSingle();
  if (!call?.recording_path) return NextResponse.json({ error: "No recording." }, { status: 404 });
  const { data: file, error } = await supabaseAdmin.storage.from("retell-recordings").download(call.recording_path);
  if (error || !file) return NextResponse.json({ error: "Couldn't load the recording." }, { status: 502 });

  return new Response(file, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
