import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listCoursesFlat } from "@/lib/academy/catalog";
import { loadAcademyCatalogWithDb } from "@/lib/academy/lessonContent";
import { loadLegacyHub } from "@/lib/academy/legacyHubLoad";

export type MentionTreeLesson = {
  lessonId: string;
  title: string;
  emoji?: string | null;
  /** Section/group within a course (Programs courses are split into sections). */
  section?: string;
};

export type MentionTreeCourse = {
  area: "classroom" | "programs";
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

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
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

/** Title overrides keyed `${course_id}:${lesson_id}` (used for Programs lessons). */
async function loadLessonTitleOverrides(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title");
  for (const row of data ?? []) {
    const r = row as { course_id: string; lesson_id: string; title: string | null };
    const t = r.title?.trim();
    if (t) map.set(`${r.course_id}:${r.lesson_id}`, t);
  }
  return map;
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

function loadProgramsCourses(titleOverrides: Map<string, string>): MentionTreeCourse[] {
  let hub;
  try {
    hub = loadLegacyHub();
  } catch {
    return [];
  }
  return hub.courses.map((course) => ({
    area: "programs" as const,
    courseId: course.id,
    title: course.title,
    lessons: course.sections.flatMap((section) =>
      section.lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: titleOverrides.get(`${course.id}:${lesson.id}`) ?? lesson.title,
        section: section.title,
      }))
    ),
  }));
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
      loadLessonTitleOverrides(),
    ]);
    courses = [...classroom, ...loadProgramsCourses(overrides)];
  } catch {
    return NextResponse.json({ error: "Could not load Academy." }, { status: 500 });
  }

  return NextResponse.json({ courses });
}
