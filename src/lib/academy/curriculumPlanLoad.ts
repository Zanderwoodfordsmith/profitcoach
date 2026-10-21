import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
} from "./classroomIds";
import { loadAcademyImportSnapshot } from "./academyImportSnapshot";
import { loadArchiveHub } from "./archiveHubLoad";
import { classroomCoursesByIds, loadClassroomHub } from "./classroomHubLoad";
import {
  curriculumPlanItemFromDb,
  curriculumRowKey,
  flattenBoardSections,
  type CurriculumBoard,
  type CurriculumBoardCourse,
  type CurriculumBoardRow,
  type CurriculumBoardSection,
  type CurriculumDriveLeftovers,
  type CurriculumPlanItem,
  type CurriculumPlanItemDbRow,
  type CurriculumScope,
  type LessonContentPresence,
} from "./curriculumPlan";
import type { HubCourse, HubLesson, HubSection } from "./hubCatalog";
import { loadClassroomCourseWithContent } from "./lessonContent";
import { loadVaultHub } from "./vaultHubLoad";

const CLASSROOM_DISPLAY_ORDER = [
  ...CLASSROOM_START_COURSE_IDS,
  ...CLASSROOM_PATH_COURSE_IDS,
] as const;

const UNSORTED_NEW_SECTION_TITLE = "New lessons";
const NOT_IN_CLASSROOM_TITLE = "Not in Classroom";

/** A course on the board, where its lessons are edited, and which tab it sits on. */
export type CurriculumPlanCourse = {
  course: HubCourse;
  scope: CurriculumScope;
  adminBase: string;
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

/**
 * Classroom courses in card order, then the lessons kept out of it
 * ("Not in Classroom"), then the Vault.
 */
export function curriculumPlanCourses(): CurriculumPlanCourse[] {
  const hub = loadClassroomHub();
  const ordered = classroomCoursesByIds(hub, CLASSROOM_DISPLAY_ORDER);
  const orderedIds = new Set(ordered.map((c) => c.id));
  const classroom = [...ordered, ...hub.courses.filter((c) => !orderedIds.has(c.id))];
  return [
    ...classroom.map((course) => ({ course, scope: "classroom" as const, adminBase: "/admin/academy/classroom" })),
    ...loadArchiveHub().courses.map((course) => ({
      course: { ...course, title: NOT_IN_CLASSROOM_TITLE },
      scope: "classroom" as const,
      adminBase: "/admin/academy/archive",
    })),
    ...loadVaultHub().courses.map((course) => ({ course, scope: "vault" as const, adminBase: "/admin/academy/vault" })),
  ];
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Same fields the lesson player shows, chapters included. */
function contentPresence(lesson: HubLesson): LessonContentPresence {
  const chapters = lesson.videoChapters ?? [];
  return {
    video: hasText(lesson.videoUrl) || chapters.some((c) => hasText(c.videoUrl)),
    transcript: hasText(lesson.transcriptText) || chapters.some((c) => hasText(c.transcriptText)),
    written:
      hasText(lesson.bodyMarkdown) ||
      hasText(lesson.guideMarkdown) ||
      chapters.some((c) => hasText(c.bodyMarkdown) || hasText(c.guideMarkdown)),
  };
}

async function loadDriveLeftovers(): Promise<CurriculumDriveLeftovers> {
  const { report, updatedAt } = await loadAcademyImportSnapshot();
  return {
    root: report?.root ?? null,
    checkedAt: updatedAt,
    files: (report?.unmatched ?? []).map((u) => ({ relativePath: u.relativePath, kind: u.kind })),
  };
}

export async function loadCurriculumBoard(): Promise<CurriculumBoard> {
  const planCourses = curriculumPlanCourses();

  // The player's own loader: drops deleted lessons, follows renamed ids and chapters.
  const [items, merged, driveLeftovers] = await Promise.all([
    loadCurriculumPlanItems(),
    Promise.all(
      planCourses.map((pc) => loadClassroomCourseWithContent(pc.course, { includeDrafts: true })),
    ),
    loadDriveLeftovers().catch((e) => {
      console.error("[curriculumPlanLoad] academy_import_snapshot:", e);
      return { root: null, checkedAt: null, files: [] };
    }),
  ]);

  const planByLesson = new Map<string, CurriculumPlanItem>();
  const newItems: CurriculumPlanItem[] = [];
  for (const item of items) {
    if (item.lessonId) planByLesson.set(item.lessonId, item);
    else newItems.push(item);
  }

  const rows: CurriculumBoardRow[] = [];
  const boardCourses: CurriculumBoardCourse[] = [];

  function lessonRow(
    pc: CurriculumPlanCourse,
    sectionTitle: string,
    lesson: HubLesson,
    parentLessonId: string | null,
  ): CurriculumBoardRow {
    return {
      key: lesson.id,
      courseId: pc.course.id,
      courseTitle: pc.course.title,
      sectionTitle,
      lessonId: lesson.id,
      currentTitle: lesson.title,
      parentLessonId,
      isDraft: lesson.draft === true,
      content: contentPresence(lesson),
      adminHref: `${pc.adminBase}/${encodeURIComponent(pc.course.id)}/${encodeURIComponent(lesson.id)}`,
      plan: planByLesson.get(lesson.id) ?? null,
    };
  }

  function buildSections(pc: CurriculumPlanCourse, sections: HubSection[]): CurriculumBoardSection[] {
    const out: CurriculumBoardSection[] = [];
    for (const section of sections) {
      const rowKeys: string[] = [];
      for (const lesson of section.lessons) {
        const row = lessonRow(pc, section.title, lesson, null);
        rows.push(row);
        rowKeys.push(row.key);
        for (const satellite of lesson.satellites ?? []) {
          const sat = lessonRow(pc, section.title, satellite, lesson.id);
          rows.push(sat);
          rowKeys.push(sat.key);
        }
      }
      const children = buildSections(pc, section.sections ?? []);
      if (rowKeys.length > 0 || children.length > 0) {
        out.push({ id: section.id, title: section.title, isNew: false, rowKeys, sections: children });
      }
    }
    return out;
  }

  planCourses.forEach((pc, i) => {
    boardCourses.push({
      id: pc.course.id,
      title: pc.course.title,
      scope: pc.scope,
      sections: buildSections(pc, merged[i].sections),
    });
  });

  const courseById = new Map(boardCourses.map((c) => [c.id, c]));

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
      courseTitle: course.title,
      sectionTitle: section.title,
      lessonId: null,
      currentTitle: null,
      parentLessonId: null,
      isDraft: false,
      content: null,
      adminHref: null,
      plan: item,
    });
    section.rowKeys.push(key);
  }

  return { courses: boardCourses, rows, driveLeftovers };
}
