import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Same public bucket as the newsletter's other pictures (see /api/coach/newsletter/image). */
export const COVER_BUCKET = "newsletter-images";

/** Each coach's photo with the background removed, made by scripts/newsletter-cutouts.ts. */
export function cutOutPath(coachId: string) {
  return `cutouts/${coachId}.png`;
}

export function cutOutUrl(coachId: string) {
  return supabaseAdmin.storage.from(COVER_BUCKET).getPublicUrl(cutOutPath(coachId)).data.publicUrl;
}

export async function ensureCoverBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(COVER_BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(COVER_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
}
