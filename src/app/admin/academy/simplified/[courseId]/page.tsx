import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademySimplifiedCourseRedirectPage({
  params,
}: Props) {
  const { courseId } = await params;
  redirect(`/admin/academy/classroom/${encodeURIComponent(courseId)}`);
}
