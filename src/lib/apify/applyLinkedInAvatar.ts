/**
 * If the coach has no community avatar yet, download a LinkedIn photo URL
 * into the `avatars` bucket and set `profiles.avatar_url`.
 * Never overwrites an existing avatar.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ApplyLinkedInAvatarResult =
  | { status: "skipped_has_avatar"; avatarUrl: string }
  | { status: "skipped_no_photo" }
  | { status: "applied"; avatarUrl: string }
  | { status: "failed"; error: string };

function contentTypeFromResponse(
  contentTypeHeader: string | null,
  url: string
): string | null {
  const raw = (contentTypeHeader ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED_TYPES.has(raw)) return raw;
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes("profile-displayphoto")) {
    return "image/jpeg";
  }
  return null;
}

export async function applyLinkedInPhotoAsAvatarIfMissing(
  coachId: string,
  photoUrl: string | null | undefined
): Promise<ApplyLinkedInAvatarResult> {
  const photo = photoUrl?.trim() || null;
  if (!photo) return { status: "skipped_no_photo" };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("avatar_url")
    .eq("id", coachId)
    .maybeSingle();

  if (profileError) {
    return { status: "failed", error: profileError.message };
  }

  const existing = (profile?.avatar_url as string | null)?.trim() || null;
  if (existing) {
    return { status: "skipped_has_avatar", avatarUrl: existing };
  }

  let response: Response;
  try {
    response = await fetch(photo, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProfitCoachAvatarImport/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Photo download failed.",
    };
  }

  if (!response.ok) {
    return {
      status: "failed",
      error: `Photo download HTTP ${response.status}`,
    };
  }

  const contentType = contentTypeFromResponse(
    response.headers.get("content-type"),
    photo
  );
  if (!contentType) {
    return { status: "failed", error: "Unsupported photo content type." };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    return { status: "failed", error: "Empty photo download." };
  }
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    return {
      status: "failed",
      error: `Photo too large (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB).`,
    };
  }

  const ext = EXT_BY_TYPE[contentType] ?? "jpg";
  const objectPath = `${coachId}/avatar.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(objectPath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return { status: "failed", error: uploadError.message };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${objectPath}`;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", coachId);

  if (updateError) {
    return { status: "failed", error: updateError.message };
  }

  return { status: "applied", avatarUrl: publicUrl };
}
