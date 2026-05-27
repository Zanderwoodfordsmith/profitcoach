/** True when URL points at a direct video file (e.g. Supabase Storage MP4), not YouTube/Vimeo. */
export function isDirectVideoFileUrl(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov|m4v|ogv)(\s|$)/i.test(path);
}
