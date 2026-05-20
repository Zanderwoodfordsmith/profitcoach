import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  EXT_BY_MIME,
  mediaKindForMime,
  validateCommunityPostMediaFile,
} from "@/lib/communityPostMedia";

export const maxDuration = 300;

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

  const validated = validateCommunityPostMediaFile(file);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const kind = mediaKindForMime(validated.mime)!;
  const ext = EXT_BY_MIME[validated.mime] ?? (kind === "video" ? "mp4" : "jpg");
  const path = `${userId}/${randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("community-posts")
    .upload(path, buffer, {
      contentType: validated.mime,
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
