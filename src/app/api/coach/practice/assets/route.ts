import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  PRACTICE_ASSET_BUCKET,
  PRACTICE_ASSET_MAX_BYTES,
  PRACTICE_ASSET_MAX_FILES,
} from "@/lib/practiceKnowledge/assets";
import { sanitizeAssetKind } from "@/lib/practiceKnowledge/sanitize";
import { listIntakeAssets } from "@/lib/practiceKnowledge/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

const MAX_BYTES = PRACTICE_ASSET_MAX_BYTES;
const MAX_FILES = PRACTICE_ASSET_MAX_FILES;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(PRACTICE_ASSET_BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(PRACTICE_ASSET_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED),
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const assets = await listIntakeAssets(check.userId);
    const withUrls = await Promise.all(
      assets.map(async (asset) => {
        const { data } = await supabaseAdmin.storage
          .from(PRACTICE_ASSET_BUCKET)
          .createSignedUrl(asset.storage_path, 60 * 10);
        return { ...asset, signed_url: data?.signedUrl ?? null };
      })
    );
    return NextResponse.json({ assets: withUrls });
  } catch (err) {
    console.error("practice assets GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load files." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 8 MB or smaller." }, { status: 413 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Upload a PDF, Word document, PNG, JPEG, or WebP." },
      { status: 400 }
    );
  }

  try {
    const existing = await listIntakeAssets(check.userId);
    if (existing.length >= MAX_FILES) {
      return NextResponse.json({ error: "You can attach up to 10 files." }, { status: 400 });
    }

    await ensureBucket();
    const path = `${check.userId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PRACTICE_ASSET_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const kind = sanitizeAssetKind(form.get("kind"));
    const safeName = file.name.replace(/[^\w.\- ()]/g, "").slice(0, 120) || `upload.${ext}`;
    const { data, error } = await supabaseAdmin
      .from("coach_intake_assets")
      .insert({
        coach_id: check.userId,
        kind,
        storage_path: path,
        file_name: safeName,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save file.");

    const { data: signed } = await supabaseAdmin.storage
      .from(PRACTICE_ASSET_BUCKET)
      .createSignedUrl(path, 60 * 10);

    return NextResponse.json({
      asset: { ...data, signed_url: signed?.signedUrl ?? null },
    });
  } catch (err) {
    console.error("practice assets POST:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not upload that file." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coach_intake_assets")
    .select("id, storage_path, coach_id")
    .eq("id", id)
    .eq("coach_id", check.userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Could not delete that file." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await supabaseAdmin.storage.from(PRACTICE_ASSET_BUCKET).remove([data.storage_path]);
  await supabaseAdmin
    .from("coach_intake_assets")
    .delete()
    .eq("id", id)
    .eq("coach_id", check.userId);
  return NextResponse.json({ ok: true });
}
