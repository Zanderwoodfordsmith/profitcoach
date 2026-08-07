import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "compass", "archive", "programs", "new", "simplified", "resources"]);

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

/** Bookmarks from before `/coach/academy/compass/*` existed. */
export default async function CoachAcademyLegacyLessonPathRedirect({ params }: Props) {
  const { courseId, lessonId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(
    `/coach/academy/compass/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
