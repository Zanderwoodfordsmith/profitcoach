import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "compass", "archive", "programs", "new", "simplified", "resources"]);

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyLegacyCoursePathRedirect({ params }: Props) {
  const { courseId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(`/admin/academy/compass/${encodeURIComponent(courseId)}`);
}
