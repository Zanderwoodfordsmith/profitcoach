import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "brand-assets";
const ENTRY_ID_RE = /^(pillar-[a-z]+|level-[1-5]|area-[0-9])$/;
const MAX_BYTES = 8 * 1024 * 1024;

type EntryImage = { path: string; url: string; caption: string | null };

async function getImages(entryId: string): Promise<EntryImage[]> {
  const { data } = await supabaseAdmin
    .from("brand_model_entries")
    .select("images")
    .eq("entry_id", entryId)
    .maybeSingle();
  return Array.isArray(data?.images) ? (data.images as EntryImage[]) : [];
}

async function saveImages(
  entryId: string,
  images: EntryImage[],
  userId: string
) {
  const { error } = await supabaseAdmin.from("brand_model_entries").upsert(
    {
      entry_id: entryId,
      images,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "entry_id" }
  );
  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected form data." }, { status: 400 });
  }
  const entryId = String(form.get("entry_id") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim() || null;
  const file = form.get("file");
  if (!ENTRY_ID_RE.test(entryId)) {
    return NextResponse.json({ error: "Unknown entry." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large (max 8MB)." },
      { status: 400 }
    );
  }

  const safeName = (file.name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .slice(-80);
  const path = `${entryId}/${Date.now()}-${safeName}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const images = await getImages(entryId);
  images.push({ path, url: pub.publicUrl, caption });
  try {
    await saveImages(entryId, images, auth.userId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, images });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const url = new URL(request.url);
  const entryId = url.searchParams.get("entry_id")?.trim() ?? "";
  const path = url.searchParams.get("path")?.trim() ?? "";
  if (!ENTRY_ID_RE.test(entryId) || !path.startsWith(`${entryId}/`)) {
    return NextResponse.json({ error: "Unknown image." }, { status: 400 });
  }
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
  const images = (await getImages(entryId)).filter((i) => i.path !== path);
  try {
    await saveImages(entryId, images, auth.userId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, images });
}
