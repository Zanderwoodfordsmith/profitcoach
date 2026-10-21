import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listCoursesFlat } from "@/lib/academy/compassCatalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";
import { flattenSections } from "@/lib/academy/hubCatalog";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";
import type { HubCatalog } from "@/lib/academy/hubCatalog";
import { parseLessonVideoChapters } from "@/lib/academy/lessonVideoChapters";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";

export type MentionTreeChapter = { chapterId: string; title: string };

export type MentionTreeLesson = {
  lessonId: string;
  title: string;
  emoji?: string | null;
  /** Section/group within a course (Programs courses are split into sections). */
  section?: string;
  /** Video chapters, when the lesson is split into them. */
  chapters?: MentionTreeChapter[];
};

export type MentionTreeCourse = {
  area: "classroom" | "programs" | "vault";
  courseId: string;
  title: string;
  category?: string;
  lessons: MentionTreeLesson[];
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

type LessonOverrides = {
  /** Title overrides keyed `${course_id}:${lesson_id}` (Programs + Vault lessons). */
  titles: Map<string, string>;
  /** Chapters with a video, same keys. */
  chapters: Map<string, MentionTreeChapter[]>;
};

async function loadLessonOverrides(): Promise<LessonOverrides> {
  const titles = new Map<string, string>();
  const chapters = new Map<string, MentionTreeChapter[]>();
  const { data } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title, video_chapters");
  for (const row of data ?? []) {
    const r = row as {
      course_id: string;
      lesson_id: string;
      title: string | null;
      video_chapters: unknown;
    };
    const key = `${r.course_id}:${r.lesson_id}`;
    const t = r.title?.trim();
    if (t) titles.set(key, t);
    const withVideo = parseLessonVideoChapters(r.video_chapters)
      .filter((c) => c.video_url || c.source_lesson_id)
      .map((c) => ({ chapterId: c.id, title: c.title }));
    if (withVideo.length > 1) chapters.set(key, withVideo);
  }
  return { titles, chapters };
}

async function loadClassroomCourses(): Promise<MentionTreeCourse[]> {
  // Same source the classroom renders from: JSON catalog + DB title/content overrides.
  const catalog = await loadAcademyCatalogWithDb();
  return listCoursesFlat(catalog).map(({ category, course }) => ({
    area: "classroom" as const,
    courseId: course.id,
    title: course.title,
    category: category.title,
    lessons: (course.lessons ?? []).map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      emoji: lesson.emoji ?? null,
    })),
  }));
}

function hubCourses(
  area: "programs" | "vault",
  hub: HubCatalog,
  overrides: LessonOverrides,
): MentionTreeCourse[] {
  return hub.courses.map((course) => ({
    area,
    courseId: course.id,
    title: course.title,
    lessons: flattenSections(course.sections).flatMap((section) =>
      section.lessons.map((lesson) => {
        const key = `${contentSourceCourseId(lesson.id)}:${lesson.id}`;
        return {
          lessonId: lesson.id,
          title: overrides.titles.get(key) ?? lesson.title,
          section: section.title,
          chapters: overrides.chapters.get(key),
        };
      }),
    ),
  }));
}

function loadProgramsCourses(overrides: LessonOverrides): MentionTreeCourse[] {
  const courses: MentionTreeCourse[] = [];

  try {
    courses.push(...hubCourses("programs", loadClassroomHub(), overrides));
  } catch {
    // Classroom hub unavailable — continue with Vault and archive.
  }

  try {
    courses.push(...hubCourses("vault", loadVaultHub(), overrides));
  } catch {
    // Vault unavailable.
  }

  // Admin archive: lessons not surfaced on the Classroom hub.
  try {
    courses.push(...hubCourses("programs", loadArchiveHub(), overrides));
  } catch {
    // Archive unavailable.
  }

  return courses;
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let courses: MentionTreeCourse[];
  try {
    const [classroom, overrides] = await Promise.all([
      loadClassroomCourses(),
      loadLessonOverrides(),
    ]);
    courses = [...classroom, ...loadProgramsCourses(overrides)];
  } catch {
    return NextResponse.json({ error: "Could not load Academy." }, { status: 500 });
  }

  return NextResponse.json({ courses });
}
