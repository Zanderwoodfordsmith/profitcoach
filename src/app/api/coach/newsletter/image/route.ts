import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

/**
 * Pictures in a coach's newsletter (the cover and any in the issue). Public,
 * because the issue is meant to be published: the link has to open anywhere.
 */
const BUCKET = "newsletter-images";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED),
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
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
    return NextResponse.json({ error: "Expected a picture." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected a picture." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Pictures must be 8 MB or smaller." }, { status: 413 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use a PNG, JPEG, WebP or GIF." }, { status: 400 });
  }

  try {
    await ensureBucket();
    const path = `${check.userId}/${randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("newsletter image:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not upload that picture." }, { status: 500 });
  }
}
