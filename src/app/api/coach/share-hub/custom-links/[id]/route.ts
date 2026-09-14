import { NextResponse } from "next/server";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { sanitizeShareUrl } from "@/lib/shareLinks/sanitizeUrl";
import {
  CUSTOM_LINK_DESCRIPTION_MAX,
  CUSTOM_LINK_TITLE_MAX,
} from "@/lib/shareLinks/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    url?: string;
    description?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = clip(body.title, CUSTOM_LINK_TITLE_MAX);
    if (!title) {
      return NextResponse.json({ error: "Add a title." }, { status: 400 });
    }
    updates.title = title;
  }
  if (body.url !== undefined) {
    const parsed = sanitizeShareUrl(body.url);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    updates.url = parsed.url;
  }
  if (body.description !== undefined) {
    const descriptionRaw = (body.description ?? "").trim();
    updates.description = descriptionRaw
      ? clip(descriptionRaw, CUSTOM_LINK_DESCRIPTION_MAX)
      : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_custom_links")
    .update(updates)
    .eq("id", id)
    .eq("coach_id", auth.coachId)
    .select("id, title, url, description, sort_order")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not update the link." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ link: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_custom_links")
    .delete()
    .eq("id", id)
    .eq("coach_id", auth.coachId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not delete the link." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
