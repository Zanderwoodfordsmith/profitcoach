import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function CoachAcademyExperiencesLessonRedirectPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  redirect(
    `/coach/academy/programs/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
