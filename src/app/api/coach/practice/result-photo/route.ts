import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * A client's photo on a Blueprint result. Returns the public URL; the result
 * card stores it with the rest of the result.
 */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a photo." }, { status: 400 });
  }
  const file = form.get("file");
  const resultId = String(form.get("result_id") ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  if (!(file instanceof File) || !resultId) {
    return NextResponse.json({ error: "A photo and result_id are required." }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG or WebP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo must be 2MB or smaller." }, { status: 400 });
  }

  const path = `results/${check.userId}/${resultId}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (error) {
    console.error("result photo upload:", error.message);
    return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
  }

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return NextResponse.json({ photo_url: `${base}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}` });
}
