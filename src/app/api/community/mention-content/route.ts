import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { flattenSections } from "@/lib/academy/hubCatalog";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { classroomCoursesByIds, loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
} from "@/lib/academy/classroomIds";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";
import type { HubCourse } from "@/lib/academy/hubCatalog";
import { withClassroomMetadata } from "@/lib/academy/lessonContent";
import { applyLegacyCourseVisibility } from "@/lib/academy/lessonVisibility";
import { parseLessonVideoChapters } from "@/lib/academy/lessonVideoChapters";
import { RESOURCE_GROUPS, flattenResourcePages } from "@/lib/resources/library";
import { BLUEPRINT_GROUPS, sectionKey } from "@/lib/practiceKnowledge/blueprint";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";

export type MentionTreeChapter = { chapterId: string; title: string };

export type MentionTreeLesson = {
  lessonId: string;
  title: string;
  emoji?: string | null;
  /** Video chapters, when the lesson is split into them. */
  chapters?: MentionTreeChapter[];
};

export type MentionTreeSection = { title: string; lessons: MentionTreeLesson[] };

export type MentionTreeCourse = {
  /** `programs` = Classroom, `vault` = Vault (stored mention area keys). */
  area: "programs" | "vault";
  courseId: string;
  title: string;
  sections: MentionTreeSection[];
};

export type MentionTreeDocument = {
  slug: string;
  title: string;
  dek?: string;
  group: string;
};

export type MentionTreeBlueprintSection = {
  title: string;
  /** Element id on the page: `s-<page>-<id>`. */
  anchor: string;
  /** Answer boxes, anchored `f-<path>`. */
  boxes: { path: string; label: string }[];
};

export type MentionTreeBlueprintPage = {
  slug: string;
  title: string;
  href: string;
  /** Chapter: About You, Get Calls, Win Clients. */
  group: string;
  sections: MentionTreeBlueprintSection[];
};

async function requireStaff(request: Request): Promise<
  { ok: true } | { ok: false; status: number; message: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { ok: false, status: 401, message: "Missing access token." };
  }

  const user = await verifyAccessToken(token);

  if (!user) {
    return { ok: false, status: 401, message: "Invalid access token." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "coach" && role !== "admin") {
    return { ok: false, status: 403, message: "Staff only." };
  }

  return { ok: true };
}

/** Chapters with a video, keyed `${course_id}:${lesson_id}`. */
async function loadLessonChapters(): Promise<Map<string, MentionTreeChapter[]>> {
  const chapters = new Map<string, MentionTreeChapter[]>();
  const { data } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, video_chapters");
  for (const row of data ?? []) {
    const r = row as { course_id: string; lesson_id: string; video_chapters: unknown };
    const withVideo = parseLessonVideoChapters(r.video_chapters)
      .filter((c) => c.video_url || c.source_lesson_id)
      .map((c) => ({ chapterId: c.id, title: c.title }));
    if (withVideo.length > 1) chapters.set(`${r.course_id}:${r.lesson_id}`, withVideo);
  }
  return chapters;
}

/**
 * Courses as coaches see them: DB titles, hidden lessons left out, and
 * sections with no lessons left dropped.
 */
async function treeCourses(
  area: "programs" | "vault",
  courses: HubCourse[],
  chapters: Map<string, MentionTreeChapter[]>,
): Promise<MentionTreeCourse[]> {
  const visible = await Promise.all(
    courses.map(async (course) =>
      applyLegacyCourseVisibility(await withClassroomMetadata(course)),
    ),
  );
  return visible
    .map((course) => ({
      area,
      courseId: course.id,
      title: course.title,
      sections: flattenSections(course.sections)
        .map((section) => ({
          title: section.title,
          lessons: section.lessons.map((lesson) => ({
            lessonId: lesson.id,
            title: lesson.title,
            chapters: chapters.get(`${contentSourceCourseId(lesson.id)}:${lesson.id}`),
          })),
        }))
        .filter((section) => section.lessons.length > 0),
    }))
    .filter((course) => course.sections.length > 0);
}

function resourceDocuments(): MentionTreeDocument[] {
  return RESOURCE_GROUPS.flatMap((group) =>
    flattenResourcePages(group.pages).map((page) => ({
      slug: page.slug,
      title: page.title,
      dek: page.dek,
      group: group.title,
    })),
  );
}

/** Every coach's Blueprint has the same pages, sections and boxes, so one link opens each reader's own. */
function blueprintPages(): MentionTreeBlueprintPage[] {
  return BLUEPRINT_GROUPS.flatMap((group) =>
    group.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      href: page.href,
      group: group.label,
      sections: page.sections
        .filter((section) => section.face !== "stored")
        .map((section) => ({
          title: section.title,
          anchor: `s-${sectionKey(page, section).replace(":", "-")}`,
          boxes: (section.fields ?? []).map((field) => ({ path: field.path, label: field.label })),
        })),
    })),
  );
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const chapters = await loadLessonChapters();
    const classroom = classroomCoursesByIds(loadClassroomHub(), [
      ...CLASSROOM_START_COURSE_IDS,
      ...CLASSROOM_PATH_COURSE_IDS,
    ]);
    const [classroomCourses, vaultCourses] = await Promise.all([
      treeCourses("programs", classroom, chapters),
      treeCourses("vault", loadVaultHub().courses, chapters),
    ]);
    return NextResponse.json({
      courses: [...classroomCourses, ...vaultCourses],
      documents: resourceDocuments(),
      blueprint: blueprintPages(),
    });
  } catch {
    return NextResponse.json({ error: "Could not load Academy." }, { status: 500 });
  }
}
