import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyProgramsCourseRedirectPage({
  params,
}: Props) {
  const { courseId } = await params;
  redirect(`/admin/academy/archive/${encodeURIComponent(courseId)}`);
}
