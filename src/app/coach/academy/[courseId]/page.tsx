import { notFound, redirect } from "next/navigation";

const RESERVED = new Set(["classroom", "compass", "archive", "programs", "new", "simplified", "resources"]);

type Props = { params: Promise<{ courseId: string }> };

/** Bookmarks from before `/coach/academy/compass/*` existed. */
export default async function CoachAcademyLegacyCoursePathRedirect({ params }: Props) {
  const { courseId } = await params;
  if (RESERVED.has(courseId)) notFound();
  redirect(`/coach/academy/compass/${encodeURIComponent(courseId)}`);
}
