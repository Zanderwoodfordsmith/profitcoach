import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

export default async function AdminAcademyExperiencesCourseRedirectPage({ params }: Props) {
  const { courseId } = await params;
  redirect(`/admin/academy/programs/${encodeURIComponent(courseId)}`);
}
