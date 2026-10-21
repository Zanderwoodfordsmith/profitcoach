import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
} from "./classroomIds";
import { classroomCoursesByIds, loadClassroomHub } from "./classroomHubLoad";
import {
  curriculumPlanItemFromDb,
  curriculumRowKey,
  flattenBoardSections,
  type CurriculumBoard,
  type CurriculumBoardCourse,
  type CurriculumBoardRow,
  type CurriculumBoardSection,
  type CurriculumPlanItem,
  type CurriculumPlanItemDbRow,
} from "./curriculumPlan";
import type { HubCourse, HubLesson, HubSection } from "./hubCatalog";

const ADMIN_CLASSROOM_BASE = "/admin/academy/classroom";

const CLASSROOM_DISPLAY_ORDER = [
  ...CLASSROOM_START_COURSE_IDS,
  ...CLASSROOM_PATH_COURSE_IDS,
] as const;

const UNSORTED_NEW_SECTION_TITLE = "New lessons";

type ContentFlags = {
  lesson_id: string;
  video_url: string | null;
  is_draft: boolean | null;
  is_deleted: boolean | null;
};

export async function loadCurriculumPlanItems(): Promise<CurriculumPlanItem[]> {
  const { data, error } = await supabaseAdmin
    .from("curriculum_plan_items")
    .select(
      "id, lesson_id, course_id, section_title, title, decision, into_key, status, placement, deck_url, script_url, video_url, source_url, note, sort_order, updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`curriculum_plan_items: ${error.message}`);
  return (data ?? []).map((row) => curriculumPlanItemFromDb(row as CurriculumPlanItemDbRow));
}

/** Classroom courses only (not the Vault), in card order. */
export function classroomPlanCourses(): HubCourse[] {
  const hub = loadClassroomHub();
  const ordered = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(ordered.map((c) => c.id));
  return [...ordered, ...hub.courses.filter((c) => !orderedIds.has(c.id))];
}

export async function loadCurriculumBoard(): Promise<CurriculumBoard> {
  const courses = classroomPlanCourses();

  const [items, contentResult] = await Promise.all([
    loadCurriculumPlanItems(),
    supabaseAdmin
      .from("academy_lesson_content")
      .select("lesson_id, video_url, is_draft, is_deleted"),
  ]);
  if (contentResult.error) {
    console.error("[curriculumPlanLoad] academy_lesson_content:", contentResult.error.message);
  }

  const contentByLesson = new Map<string, ContentFlags>();
  for (const row of (contentResult.data ?? []) as ContentFlags[]) {
    contentByLesson.set(row.lesson_id, row);
  }

  const planByLesson = new Map<string, CurriculumPlanItem>();
  const newItems: CurriculumPlanItem[] = [];
  for (const item of items) {
    if (item.lessonId) planByLesson.set(item.lessonId, item);
    else newItems.push(item);
  }

  const rows: CurriculumBoardRow[] = [];
  const boardCourses: CurriculumBoardCourse[] = [];

  function lessonRow(
    course: HubCourse,
    sectionTitle: string,
    lesson: HubLesson,
    parentLessonId: string | null,
  ): CurriculumBoardRow {
    const content = contentByLesson.get(lesson.id);
    return {
      key: lesson.id,
      courseId: course.id,
      courseTitle: course.title,
      sectionTitle,
      lessonId: lesson.id,
      currentTitle: lesson.title,
      parentLessonId,
      isDraft: content?.is_draft ?? lesson.draft === true,
      hasVideo: Boolean(content?.video_url?.trim()),
      adminHref: `${ADMIN_CLASSROOM_BASE}/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`,
      plan: planByLesson.get(lesson.id) ?? null,
    };
  }

  function buildSections(course: HubCourse, sections: HubSection[]): CurriculumBoardSection[] {
    const out: CurriculumBoardSection[] = [];
    for (const section of sections) {
      const rowKeys: string[] = [];
      for (const lesson of section.lessons) {
        if (contentByLesson.get(lesson.id)?.is_deleted) continue;
        const row = lessonRow(course, section.title, lesson, null);
        rows.push(row);
        rowKeys.push(row.key);
        for (const satellite of lesson.satellites ?? []) {
          if (contentByLesson.get(satellite.id)?.is_deleted) continue;
          const sat = lessonRow(course, section.title, satellite, lesson.id);
          rows.push(sat);
          rowKeys.push(sat.key);
        }
      }
      const children = buildSections(course, section.sections ?? []);
      if (rowKeys.length > 0 || children.length > 0) {
        out.push({ id: section.id, title: section.title, isNew: false, rowKeys, sections: children });
      }
    }
    return out;
  }

  for (const course of courses) {
    boardCourses.push({ id: course.id, title: course.title, sections: buildSections(course, course.sections) });
  }

  const courseById = new Map(boardCourses.map((c) => [c.id, c]));
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  function sectionFor(course: CurriculumBoardCourse, title: string): CurriculumBoardSection {
    const wanted = title.trim().toLowerCase();
    const found = flattenBoardSections(course.sections).find(
      (s) => s.title.trim().toLowerCase() === wanted,
    );
    if (found) return found;
    const created: CurriculumBoardSection = {
      id: `new:${title}`,
      title,
      isNew: true,
      rowKeys: [],
      sections: [],
    };
    course.sections.push(created);
    return created;
  }

  for (const item of newItems) {
    const course = courseById.get(item.courseId);
    if (!course) continue;
    const sectionTitle = item.sectionTitle?.trim() || UNSORTED_NEW_SECTION_TITLE;
    const section = sectionFor(course, sectionTitle);
    const key = curriculumRowKey(item);
    rows.push({
      key,
      courseId: course.id,
      courseTitle: courseTitleById.get(course.id) ?? course.title,
      sectionTitle: section.title,
      lessonId: null,
      currentTitle: null,
      parentLessonId: null,
      isDraft: false,
      hasVideo: false,
      adminHref: null,
      plan: item,
    });
    section.rowKeys.push(key);
  }

  return { courses: boardCourses, rows };
}
