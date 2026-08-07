import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

/** Old `/simplified/:courseId` → Classroom. */
export default async function CoachAcademySimplifiedCourseRedirectPage({
  params,
}: Props) {
  const { courseId } = await params;
  redirect(`/coach/academy/classroom/${encodeURIComponent(courseId)}`);
}
