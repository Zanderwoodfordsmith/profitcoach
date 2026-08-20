import "server-only";

import { loadArchiveHub } from "@/lib/academy/archiveHubLoad";
import { loadClassroomHub } from "@/lib/academy/classroomHubLoad";
import {
  flattenSections,
  lessonWithSatellites,
  type HubCatalog,
  type HubCourse,
  type HubLesson,
} from "@/lib/academy/hubCatalog";
import { hasInAppLessonContent } from "@/lib/academy/lessonContentUtils";
import {
  OLD_ACADEMY_DOMAIN,
  type OldAcademyLinkAuditReport,
  type OldAcademyLinkLessonHit,
  type OldAcademyLinkOccurrence,
  type OldAcademyLinkResourceHit,
  type OldAcademyLinkSource,
} from "@/lib/academy/oldAcademyLinkAuditTypes";
import { contentSourceCourseId } from "@/lib/academy/programmeContentSource";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export {
  OLD_ACADEMY_DOMAIN,
  type OldAcademyLinkAuditReport,
  type OldAcademyLinkLessonHit,
  type OldAcademyLinkOccurrence,
  type OldAcademyLinkResourceHit,
  type OldAcademyLinkSource,
} from "@/lib/academy/oldAcademyLinkAuditTypes";

type ContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  audio_url: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
  transcript_text: string | null;
};

function extractLinks(text: string | null | undefined, domain: string): string[] {
  if (!text) return [];
  const escaped = domain.replace(/\./g, "\\.");
  const re = new RegExp(
    `https?:\\/\\/[^\\s)\\]"'<>]*${escaped}[^\\s)\\]"'<>]*`,
    "gi",
  );
  const matches = text.match(re);
  if (matches?.length) return Array.from(new Set(matches));
  return text.toLowerCase().includes(domain.toLowerCase()) ? [domain] : [];
}

function isHomepageStub(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes(domain.toLowerCase())) return false;
    const path = parsed.pathname.replace(/\/+$/, "");
    return path === "" || path === "/";
  } catch {
    return url.replace(/\/+$/, "").toLowerCase() === `https://${domain}`.toLowerCase();
  }
}

function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}:${lessonId}`;
}

type MutableHit = OldAcademyLinkLessonHit & {
  occurrenceKeys: Set<string>;
};

function ensureHit(
  map: Map<string, MutableHit>,
  seed: Omit<OldAcademyLinkLessonHit, "occurrences">,
): MutableHit {
  const key = lessonKey(seed.courseId, seed.lessonId);
  const existing = map.get(key);
  if (existing) {
    existing.hasInAppContent = existing.hasInAppContent || seed.hasInAppContent;
    existing.academyUrlIsHomepageStub =
      existing.academyUrlIsHomepageStub || seed.academyUrlIsHomepageStub;
    return existing;
  }
  const created: MutableHit = {
    ...seed,
    occurrences: [],
    occurrenceKeys: new Set(),
  };
  map.set(key, created);
  return created;
}

function addOccurrence(hit: MutableHit, source: OldAcademyLinkSource, url: string) {
  const key = `${source}|${url}`;
  if (hit.occurrenceKeys.has(key)) return;
  hit.occurrenceKeys.add(key);
  hit.occurrences.push({ source, url });
}

function walkHub(
  map: Map<string, MutableHit>,
  catalog: HubCatalog,
  surface: "classroom" | "archive",
  adminBasePath: string,
  domain: string,
  contentByKey: Map<string, ContentRow>,
) {
  for (const course of catalog.courses) {
    for (const section of flattenSections(course.sections)) {
      for (const parent of section.lessons) {
        for (const lesson of lessonWithSatellites(parent)) {
          const provisional: OldAcademyLinkOccurrence[] = [];
          for (const url of extractLinks(lesson.academyUrl, domain)) {
            provisional.push({ source: "hub_academyUrl", url });
          }
          for (const url of extractLinks(lesson.bodyMarkdown, domain)) {
            provisional.push({ source: "hub_bodyMarkdown", url });
          }
          for (const url of extractLinks(lesson.guideMarkdown, domain)) {
            provisional.push({ source: "hub_guideMarkdown", url });
          }
          for (const url of extractLinks(lesson.notice, domain)) {
            provisional.push({ source: "hub_notice", url });
          }
          if (provisional.length === 0) continue;

          const contentCourseId = contentSourceCourseId(lesson.id);
          const content =
            contentByKey.get(lessonKey(contentCourseId, lesson.id)) ??
            contentByKey.get(lessonKey(course.id, lesson.id));
          const hasInApp = hasInAppLessonContent(
            content?.video_url ?? lesson.videoUrl,
            content?.body_markdown ?? lesson.bodyMarkdown,
            content?.transcript_text ?? lesson.transcriptText,
            content?.guide_markdown ?? lesson.guideMarkdown,
            content?.audio_url ?? lesson.audioUrl,
          );

          const hit = ensureHit(map, {
            surface,
            courseId: course.id,
            courseTitle: course.title,
            sectionTitle: section.title,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            adminLessonHref: `${adminBasePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`,
            hasInAppContent: hasInApp,
            academyUrlIsHomepageStub: provisional.some(
              (o) =>
                o.source === "hub_academyUrl" && isHomepageStub(o.url, domain),
            ),
          });

          for (const occ of provisional) addOccurrence(hit, occ.source, occ.url);
        }
      }
    }
  }
}

function scanContentRows(
  map: Map<string, MutableHit>,
  rows: ContentRow[],
  domain: string,
  lessonIndex: Map<string, { surface: "classroom" | "archive"; course: HubCourse; sectionTitle: string; lesson: HubLesson }>,
) {
  for (const row of rows) {
    const fieldChecks: Array<[OldAcademyLinkSource, string | null]> = [
      ["body_markdown", row.body_markdown],
      ["guide_markdown", row.guide_markdown],
      ["transcript_text", row.transcript_text],
      ["video_url", row.video_url],
      ["audio_url", row.audio_url],
    ];
    const found: OldAcademyLinkOccurrence[] = [];
    for (const [source, value] of fieldChecks) {
      for (const url of extractLinks(value, domain)) {
        found.push({ source, url });
      }
    }
    if (found.length === 0) continue;

    const indexed =
      lessonIndex.get(lessonKey(row.course_id, row.lesson_id)) ??
      [...lessonIndex.values()].find((v) => v.lesson.id === row.lesson_id);

    const surface = indexed?.surface ?? "classroom";
    const courseId = indexed?.course.id ?? row.course_id;
    const courseTitle = indexed?.course.title ?? row.course_id;
    const sectionTitle = indexed?.sectionTitle ?? "";
    const lessonTitle = indexed?.lesson.title ?? row.title ?? row.lesson_id;
    const adminBase =
      surface === "archive" ? "/admin/academy/archive" : "/admin/academy/classroom";

    const hit = ensureHit(map, {
      surface,
      courseId,
      courseTitle,
      sectionTitle,
      lessonId: row.lesson_id,
      lessonTitle,
      adminLessonHref: `${adminBase}/${encodeURIComponent(courseId)}/${encodeURIComponent(row.lesson_id)}`,
      hasInAppContent: hasInAppLessonContent(
        row.video_url,
        row.body_markdown,
        row.transcript_text,
        row.guide_markdown,
        row.audio_url,
      ),
      academyUrlIsHomepageStub: false,
    });

    for (const occ of found) addOccurrence(hit, occ.source, occ.url);
  }
}

function buildLessonIndex(
  classroom: HubCatalog,
  archive: HubCatalog,
): Map<
  string,
  {
    surface: "classroom" | "archive";
    course: HubCourse;
    sectionTitle: string;
    lesson: HubLesson;
  }
> {
  const index = new Map<
    string,
    {
      surface: "classroom" | "archive";
      course: HubCourse;
      sectionTitle: string;
      lesson: HubLesson;
    }
  >();

  function add(surface: "classroom" | "archive", catalog: HubCatalog) {
    for (const course of catalog.courses) {
      for (const section of flattenSections(course.sections)) {
        for (const parent of section.lessons) {
          for (const lesson of lessonWithSatellites(parent)) {
            const entry = {
              surface,
              course,
              sectionTitle: section.title,
              lesson,
            };
            index.set(lessonKey(course.id, lesson.id), entry);
            index.set(lessonKey(contentSourceCourseId(lesson.id), lesson.id), entry);
          }
        }
      }
    }
  }

  add("classroom", classroom);
  add("archive", archive);
  return index;
}

export async function loadOldAcademyLinkAudit(
  domain = OLD_ACADEMY_DOMAIN,
): Promise<OldAcademyLinkAuditReport> {
  const classroom = loadClassroomHub();
  const archive = loadArchiveHub();

  const { data: contentRows, error: contentError } = await supabaseAdmin
    .from("academy_lesson_content")
    .select(
      "course_id, lesson_id, title, video_url, audio_url, body_markdown, guide_markdown, transcript_text",
    );

  if (contentError) {
    console.error("[oldAcademyLinkAudit] academy_lesson_content:", contentError.message);
  }

  const contentByKey = new Map<string, ContentRow>();
  for (const row of (contentRows ?? []) as ContentRow[]) {
    contentByKey.set(lessonKey(row.course_id, row.lesson_id), row);
  }

  const map = new Map<string, MutableHit>();
  walkHub(map, classroom, "classroom", "/admin/academy/classroom", domain, contentByKey);
  walkHub(map, archive, "archive", "/admin/academy/archive", domain, contentByKey);

  const lessonIndex = buildLessonIndex(classroom, archive);
  scanContentRows(map, (contentRows ?? []) as ContentRow[], domain, lessonIndex);

  const { data: resourceRows, error: resourceError } = await supabaseAdmin
    .from("academy_resources")
    .select("id, title, url");

  if (resourceError) {
    console.error("[oldAcademyLinkAudit] academy_resources:", resourceError.message);
  }

  const resources: OldAcademyLinkResourceHit[] = [];
  for (const row of resourceRows ?? []) {
    const urls = extractLinks(row.url as string | null, domain);
    if (!urls.length) continue;
    resources.push({
      id: row.id as string,
      title: (row.title as string | null) ?? (row.id as string),
      url: (row.url as string) ?? urls[0],
    });
  }

  const lessons = Array.from(map.values())
    .map(({ occurrenceKeys: _keys, ...hit }) => hit)
    .sort((a, b) => {
      const surface = a.surface.localeCompare(b.surface);
      if (surface !== 0) return surface;
      const course = a.courseTitle.localeCompare(b.courseTitle);
      if (course !== 0) return course;
      return a.lessonTitle.localeCompare(b.lessonTitle);
    });

  let occurrenceCount = 0;
  let hubAcademyUrlCount = 0;
  let contentFieldCount = 0;
  for (const lesson of lessons) {
    occurrenceCount += lesson.occurrences.length;
    for (const occ of lesson.occurrences) {
      if (occ.source === "hub_academyUrl") hubAcademyUrlCount += 1;
      else if (
        occ.source === "body_markdown" ||
        occ.source === "guide_markdown" ||
        occ.source === "transcript_text" ||
        occ.source === "video_url" ||
        occ.source === "audio_url"
      ) {
        contentFieldCount += 1;
      }
    }
  }

  return {
    domain,
    generatedAt: new Date().toISOString(),
    lessons,
    resources,
    summary: {
      lessonCount: lessons.length,
      occurrenceCount,
      hubAcademyUrlCount,
      contentFieldCount,
      withoutInAppContentCount: lessons.filter((l) => !l.hasInAppContent).length,
      homepageStubCount: lessons.filter((l) => l.academyUrlIsHomepageStub).length,
      resourceCount: resources.length,
    },
  };
}
