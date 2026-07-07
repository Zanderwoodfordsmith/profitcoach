/**
 * Find academy lessons that still link to the OLD academy (Business Coach
 * Academy on Disco) so someone (Zac) can go in and update them.
 *
 * Read-only. Scans the live database:
 *   - academy_lesson_content.body_markdown
 *   - academy_lesson_content.transcript_text
 *   - academy_lesson_content.video_url
 *   - academy_resources.url
 *
 * For each hit it prints the lesson title, where the link lives, the exact
 * URL(s) found, and a direct /admin edit link.
 *
 * Usage:
 *   npx tsx scripts/find-old-academy-links.ts
 *   npx tsx scripts/find-old-academy-links.ts --domain businesscoachacademy.com   (broader sweep)
 *   npx tsx scripts/find-old-academy-links.ts --base-url https://your-app.com     (absolute edit links)
 *   npx tsx scripts/find-old-academy-links.ts --json                              (machine-readable)
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { loadAcademyCatalogSync } from "../src/lib/academy/catalog";
import { loadLegacyHub } from "../src/lib/academy/legacyHubLoad";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const DOMAIN = argValue("--domain") ?? "academy.businesscoachacademy.com";
const BASE_URL = (argValue("--base-url") ?? "").replace(/\/$/, "");
const AS_JSON = process.argv.includes("--json");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ContentRow = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  video_url: string | null;
  body_markdown: string | null;
  transcript_text: string | null;
  updated_at: string;
};

type ResourceRow = {
  id: string;
  title: string | null;
  url: string | null;
};

type LessonMeta = {
  surface: "classroom" | "programs";
  courseTitle: string;
  lessonTitle: string;
};

/** Build course:lesson -> {surface, titles} from the JSON catalogs. */
function buildLessonIndex(): Map<string, LessonMeta> {
  const index = new Map<string, LessonMeta>();

  // Classroom (catalog.json)
  try {
    const catalog = loadAcademyCatalogSync();
    for (const category of catalog.categories ?? []) {
      for (const course of category.courses ?? []) {
        for (const lesson of course.lessons ?? []) {
          index.set(`${course.id}:${lesson.id}`, {
            surface: "classroom",
            courseTitle: course.title ?? course.id,
            lessonTitle: lesson.title ?? lesson.id,
          });
        }
      }
    }
  } catch (err) {
    console.error("Warning: could not load classroom catalog:", (err as Error).message);
  }

  // Programs (legacy-hub.json)
  try {
    const hub = loadLegacyHub();
    for (const course of hub.courses) {
      for (const section of course.sections) {
        for (const lesson of section.lessons) {
          index.set(`${course.id}:${lesson.id}`, {
            surface: "programs",
            courseTitle: course.title ?? course.id,
            lessonTitle: lesson.title ?? lesson.id,
          });
        }
      }
    }
  } catch (err) {
    console.error("Warning: could not load programs catalog:", (err as Error).message);
  }

  return index;
}

/** Pull every occurrence of a URL on the target domain out of some text. */
function extractLinks(text: string | null | undefined, domain: string): string[] {
  if (!text) return [];
  const re = new RegExp(`https?:\\/\\/[^\\s)\\]"'<>]*${domain.replace(/\./g, "\\.")}[^\\s)\\]"'<>]*`, "gi");
  const matches = text.match(re);
  if (!matches) {
    // Bare host without protocol (e.g. inside prose or an href fragment).
    return text.toLowerCase().includes(domain.toLowerCase()) ? [domain] : [];
  }
  return Array.from(new Set(matches));
}

function editUrl(surface: "classroom" | "programs" | "unknown", courseId: string, lessonId: string): string {
  const path =
    surface === "unknown"
      ? `/admin/academy/${courseId}/${lessonId}`
      : `/admin/academy/${surface}/${courseId}/${lessonId}`;
  return `${BASE_URL}${path}`;
}

type LessonHit = {
  courseId: string;
  lessonId: string;
  surface: "classroom" | "programs" | "unknown";
  courseTitle: string;
  lessonTitle: string;
  editUrl: string;
  fields: { field: string; links: string[] }[];
};

async function main() {
  const index = buildLessonIndex();

  // 1. Lesson content rows.
  const { data: contentData, error: contentErr } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title, video_url, body_markdown, transcript_text, updated_at");

  if (contentErr) {
    console.error("Failed to query academy_lesson_content:", contentErr.message);
    process.exit(1);
  }

  const lessonHits: LessonHit[] = [];

  for (const row of (contentData ?? []) as ContentRow[]) {
    const fields: { field: string; links: string[] }[] = [];

    const bodyLinks = extractLinks(row.body_markdown, DOMAIN);
    if (bodyLinks.length) fields.push({ field: "body_markdown", links: bodyLinks });

    const transcriptLinks = extractLinks(row.transcript_text, DOMAIN);
    if (transcriptLinks.length) fields.push({ field: "transcript_text", links: transcriptLinks });

    const videoLinks = extractLinks(row.video_url, DOMAIN);
    if (videoLinks.length) fields.push({ field: "video_url", links: videoLinks });

    if (fields.length === 0) continue;

    const meta = index.get(`${row.course_id}:${row.lesson_id}`);
    const surface = meta?.surface ?? "unknown";
    lessonHits.push({
      courseId: row.course_id,
      lessonId: row.lesson_id,
      surface,
      courseTitle: meta?.courseTitle ?? row.course_id,
      lessonTitle: meta?.lessonTitle ?? row.title ?? row.lesson_id,
      editUrl: editUrl(surface, row.course_id, row.lesson_id),
      fields,
    });
  }

  // 2. Resource library rows.
  const { data: resourceData, error: resourceErr } = await supabase
    .from("academy_resources")
    .select("id, title, url");

  const resourceHits: ResourceRow[] = [];
  if (resourceErr) {
    console.error("Warning: could not query academy_resources:", resourceErr.message);
  } else {
    for (const row of (resourceData ?? []) as ResourceRow[]) {
      if (extractLinks(row.url, DOMAIN).length) resourceHits.push(row);
    }
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ domain: DOMAIN, lessonHits, resourceHits }, null, 2));
    return;
  }

  // Human-readable report.
  console.log("");
  console.log(`Old-academy link audit — matching "${DOMAIN}"`);
  console.log("=".repeat(72));

  if (lessonHits.length === 0) {
    console.log("\nNo lessons found with links to that domain. 🎉");
  } else {
    lessonHits.sort((a, b) =>
      `${a.surface}${a.courseTitle}`.localeCompare(`${b.surface}${b.courseTitle}`)
    );
    console.log(`\n${lessonHits.length} lesson(s) need updating:\n`);
    let n = 0;
    for (const hit of lessonHits) {
      n += 1;
      console.log(`${n}. [${hit.surface}] ${hit.courseTitle} → ${hit.lessonTitle}`);
      console.log(`   ids:  ${hit.courseId} / ${hit.lessonId}`);
      console.log(`   edit: ${hit.editUrl}`);
      for (const f of hit.fields) {
        console.log(`   in ${f.field}:`);
        for (const link of f.links) {
          console.log(`      - ${link}`);
        }
      }
      console.log("");
    }
  }

  if (resourceHits.length > 0) {
    console.log("-".repeat(72));
    console.log(`\n${resourceHits.length} resource link(s) also point to that domain:\n`);
    for (const r of resourceHits) {
      console.log(`   - ${r.title ?? r.id}: ${r.url}`);
    }
    console.log("");
  }

  console.log("=".repeat(72));
  console.log(
    `Totals: ${lessonHits.length} lesson(s), ${resourceHits.length} resource(s).`
  );
  console.log(
    "Note: this scans in-app lesson content. Legacy 'Programs' external CTA " +
      "links (academyUrl) live in content/academy/legacy-hub.json, not the DB."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
