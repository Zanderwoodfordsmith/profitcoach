import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyExperiencesLessonRedirectPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  redirect(
    `/admin/academy/programs/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
