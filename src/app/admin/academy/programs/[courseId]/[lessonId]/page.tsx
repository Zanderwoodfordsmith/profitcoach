import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyProgramsLessonRedirectPage({
  params,
}: Props) {
  const { courseId, lessonId } = await params;
  redirect(
    `/admin/academy/archive/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
