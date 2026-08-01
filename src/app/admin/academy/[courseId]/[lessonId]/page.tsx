import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "compass", "archive", "programs", "new", "simplified", "resources"]);

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function AdminAcademyLegacyLessonPathRedirect({ params }: Props) {
  const { courseId, lessonId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(
    `/admin/academy/compass/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`,
  );
}
