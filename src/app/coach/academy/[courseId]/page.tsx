import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "programs", "new"]);

type Props = { params: Promise<{ courseId: string }> };

/** Bookmarks from before `/coach/academy/classroom/*` existed. */
export default async function CoachAcademyLegacyCoursePathRedirect({ params }: Props) {
  const { courseId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(`/coach/academy/classroom/${encodeURIComponent(courseId)}`);
}
