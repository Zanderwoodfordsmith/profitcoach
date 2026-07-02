/** Public Supabase bucket for membership and other marketing media. */
export const MARKETING_ASSETS_BUCKET = "Marketing Assets";

export const MEMBERSHIP_CONFERENCE_VIDEO_PATH = "BCA Conference walk around.mp4";

export function marketingAssetPublicUrl(objectPath: string): string {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const bucket = encodeURIComponent(MARKETING_ASSETS_BUCKET);
  const path = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
