import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ENTRY_ID_RE = /^(pillar-[a-z]+|level-[1-5]|area-[0-9])$/;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("brand_model_entries")
    .select("entry_id, copy_md, images, updated_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  let body: { entry_id?: string; copy_md?: string };
  try {
    body = (await request.json()) as { entry_id?: string; copy_md?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const entryId = body.entry_id?.trim();
  if (!entryId || !ENTRY_ID_RE.test(entryId)) {
    return NextResponse.json({ error: "Unknown entry." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("brand_model_entries").upsert(
    {
      entry_id: entryId,
      copy_md:
        typeof body.copy_md === "string" && body.copy_md.trim()
          ? body.copy_md
          : null,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    },
    { onConflict: "entry_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
