import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademySimplifiedLessonRedirectPage({
  params,
}: Props) {
  const { courseId, lessonId } = await params;
  redirect(
    `/admin/academy/classroom/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
