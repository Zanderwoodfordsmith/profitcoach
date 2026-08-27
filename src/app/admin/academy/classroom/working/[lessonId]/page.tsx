import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { WorkingLessonPlayer } from "@/components/academy/working/WorkingLessonPlayer";
import {
  findWorkingLesson,
  firstWorkingLesson,
} from "@/lib/academy/workingLessons";

type Props = { params: Promise<{ lessonId: string }> };

export default async function AdminWorkingLessonPage({ params }: Props) {
  const { lessonId } = await params;
  const lesson = findWorkingLesson(lessonId);
  if (!lesson) {
    if (lessonId === firstWorkingLesson().id) notFound();
    redirect(
      `/admin/academy/classroom/working/${encodeURIComponent(firstWorkingLesson().id)}`,
    );
  }

  return (
    <Suspense>
      <WorkingLessonPlayer lesson={lesson} />
    </Suspense>
  );
}
