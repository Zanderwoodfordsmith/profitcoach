import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "programs", "new"]);

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

/** Bookmarks from before `/coach/academy/classroom/*` existed. */
export default async function CoachAcademyLegacyLessonPathRedirect({ params }: Props) {
  const { courseId, lessonId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(
    `/coach/academy/classroom/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
