import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
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

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export async function POST(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file") ?? formData.get("avatar");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided. Use field name 'file' or 'avatar'." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File must be 2MB or smaller." },
      { status: 400 }
    );
  }

  const ext = EXT_BY_TYPE[file.type] ?? "jpg";
  const path = `${coachId}/avatar.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    const msg = uploadError.message ?? "Upload failed.";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", coachId);

  if (updateError) {
    const msg = (updateError as { message?: string }).message ?? "Profile update failed.";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }

  return NextResponse.json({ avatar_url: publicUrl });
}
