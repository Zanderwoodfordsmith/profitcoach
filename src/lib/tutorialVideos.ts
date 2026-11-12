/** Tutorial videos live in the `academy-lessons` storage bucket, under tutorials/. */
export function tutorialVideoUrl(fileName: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/academy-lessons/tutorials/${fileName}`;
}
