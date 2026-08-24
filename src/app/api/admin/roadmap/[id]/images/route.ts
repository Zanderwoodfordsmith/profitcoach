import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getRoadmapJob,
  updateRoadmapJob,
  ROADMAP_IMAGES_BUCKET,
  type RoadmapJobImage,
} from "@/lib/roadmap/core";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // matches bucket limit
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload a reference image and attach it to the job. Field name: "file". */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;

  const job = await getRoadmapJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Use field name 'file'." },
      { status: 400 }
    );
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, WebP, or GIF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File must be 10MB or smaller." },
      { status: 400 }
    );
  }

  const imageId = crypto.randomUUID();
  const path = `${id}/${imageId}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(ROADMAP_IMAGES_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? "Upload failed." },
      { status: 500 }
    );
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/+$/,
    ""
  );
  const image: RoadmapJobImage = {
    id: imageId,
    path,
    url: `${supabaseUrl}/storage/v1/object/public/${ROADMAP_IMAGES_BUCKET}/${path}`,
    name: (file.name || "image").slice(0, 200),
    created_at: new Date().toISOString(),
  };

  try {
    const updated = await updateRoadmapJob(id, {
      images: [...(job.images ?? []), image],
    });
    return NextResponse.json({ job: updated }, { status: 201 });
  } catch (e) {
    // Keep storage consistent with the row if the metadata write fails.
    await supabaseAdmin.storage.from(ROADMAP_IMAGES_BUCKET).remove([path]);
    const message = e instanceof Error ? e.message : "Could not attach image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Remove an image from the job and from storage. Query param: imageId. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await params;
  const imageId = new URL(request.url).searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json(
      { error: "imageId query param is required." },
      { status: 400 }
    );
  }

  const job = await getRoadmapJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  const image = (job.images ?? []).find((i) => i.id === imageId);
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  await supabaseAdmin.storage.from(ROADMAP_IMAGES_BUCKET).remove([image.path]);
  try {
    const updated = await updateRoadmapJob(id, {
      images: (job.images ?? []).filter((i) => i.id !== imageId),
    });
    return NextResponse.json({ job: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not remove image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
