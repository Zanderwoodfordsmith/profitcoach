import {
  START_HERE_COURSE_ID,
  START_HERE_WELCOME_LESSON_ID,
  START_HERE_WELCOME_PATH,
} from "@/lib/academy/classroomIds";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";

export {
  START_HERE_COURSE_ID,
  START_HERE_WELCOME_LESSON_ID,
  START_HERE_WELCOME_PATH,
};

/** Post-payment / welcome CTA destination. */
export const POST_PAYMENT_CONTINUE_PATH = START_HERE_WELCOME_PATH;

/** Every lesson id under the Start Here hub course (including satellites). */
export function listStartHereLessonIds(): string[] {
  const hub = loadClassroomHub();
  const course = hub.courses.find((c) => c.id === hub.startHere.courseId);
  if (!course) return [];

  const ids: string[] = [];
  const walk = (lesson: { id: string; satellites?: { id: string }[] }) => {
    ids.push(lesson.id);
    for (const sat of lesson.satellites ?? []) walk(sat);
  };
  for (const section of course.sections) {
    for (const lesson of section.lessons) walk(lesson);
  }
  return ids;
}

export function isStartHereLessonId(lessonId: string): boolean {
  return listStartHereLessonIds().includes(lessonId);
}
