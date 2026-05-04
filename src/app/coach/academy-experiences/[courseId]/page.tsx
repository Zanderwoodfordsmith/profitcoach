import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

export default async function CoachAcademyExperiencesCourseRedirectPage({ params }: Props) {
  const { courseId } = await params;
  redirect(`/coach/academy/programs/${encodeURIComponent(courseId)}`);
}
