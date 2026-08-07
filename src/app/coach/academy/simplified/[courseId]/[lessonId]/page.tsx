import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

/** Old `/simplified/:courseId/:lessonId` → Classroom. */
export default async function CoachAcademySimplifiedLessonRedirectPage({
  params,
}: Props) {
  const { courseId, lessonId } = await params;
  redirect(
    `/coach/academy/classroom/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
