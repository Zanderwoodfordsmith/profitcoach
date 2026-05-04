import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

type MediaKind = "image" | "video";

function mediaKindForMime(mime: string): MediaKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

function maxBytesForMime(mime: string): number {
  return mediaKindForMime(mime) === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

async function requireStaff(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null as string | null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string };
}

export async function POST(request: Request) {
  const authCheck = await requireStaff(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = authCheck.userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") ?? formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Use field name 'file' or 'image'." },
      { status: 400 }
    );
  }

  const kind = mediaKindForMime(file.type);
  if (!kind) {
    return NextResponse.json(
      {
        error:
          "File must be an image (JPEG, PNG, WebP) or video (MP4, WebM, MOV).",
      },
      { status: 400 }
    );
  }

  const maxBytes = maxBytesForMime(file.type);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json(
      { error: `File must be ${mb}MB or smaller.` },
      { status: 400 }
    );
  }

  const ext = EXT_BY_TYPE[file.type] ?? (kind === "video" ? "mp4" : "jpg");
  const path = `${userId}/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("community-posts")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    const msg = uploadError.message ?? "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/community-posts/${path}`;

  return NextResponse.json({
    media: { url: publicUrl, kind },
  });
}
