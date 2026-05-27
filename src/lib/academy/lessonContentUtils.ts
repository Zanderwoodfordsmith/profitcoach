/** Client-safe helpers for in-app lesson content (no Node/fs or Supabase). */

export type LessonInAppContent = {
  videoUrl: string | null;
  bodyMarkdown: string;
  transcriptText: string | null;
};

export function hasInAppLessonContent(
  videoUrl?: string | null,
  bodyMarkdown?: string | null,
  transcriptText?: string | null
): boolean {
  return (
    Boolean(videoUrl?.trim()) ||
    Boolean(bodyMarkdown?.trim()) ||
    Boolean(transcriptText?.trim())
  );
}
