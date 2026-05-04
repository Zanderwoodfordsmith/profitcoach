import { notFound } from "next/navigation";

import { LegacyAcademyLessonPlayer } from "@/components/academy/LegacyAcademyLessonPlayer";
import { findLegacyCourse, findLessonInCourse } from "@/lib/academy/legacyHubCatalog";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";

const BASE = "/coach/academy/programs";
const CLASSROOM = "/coach/academy/classroom";

type Props = { params: Promise<{ courseId: string; lessonId: string }> };

export default async function CoachAcademyProgramsLessonPage({ params }: Props) {
  const { courseId, lessonId } = await params;
  const data = loadLegacyHub();
  const course = findLegacyCourse(data, courseId);
  if (!course) notFound();

  const lesson = findLessonInCourse(course, lessonId);
  if (!lesson) notFound();

  return (
    <div className="pt-6">
      <LegacyAcademyLessonPlayer
        data={data}
        course={course}
        lesson={lesson}
        basePath={BASE}
        classroomHref={CLASSROOM}
      />
    </div>
  );
}
