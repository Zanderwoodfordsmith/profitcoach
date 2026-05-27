/**
 * Import academy resource links from content/academy/business-coach-academy-resources.md
 *
 * Usage:
 *   npx tsx scripts/import-academy-resources-from-markdown.ts --dry-run
 *   npx tsx scripts/import-academy-resources-from-markdown.ts --apply
 *   npx tsx scripts/import-academy-resources-from-markdown.ts --apply --link-lessons
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  buildLegacyLessonIndex,
  lessonsForCourse,
  type LegacyLessonIndexEntry,
} from "../src/lib/academy/legacyLessonMatcher";
import { loadLegacyHub } from "../src/lib/academy/legacyHubLoad";
import {
  lessonTitleMatchScore,
} from "../src/lib/academy/normalizeMatchText";
import { parseAcademyResourcesMarkdown } from "../src/lib/academy/parseResourcesMarkdown";
import type { AcademyResourceArea } from "../src/lib/academy/parseResourcesMarkdown";
import { appendClientAlignmentMasterfileTabs } from "../src/lib/academy/clientAlignmentMasterfile";
import {
  dedupeParsedResources,
  type ResourceAppearance,
} from "../src/lib/academy/resourceUrl";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_MD = path.join(
  process.cwd(),
  "content/academy/business-coach-academy-resources.md"
);

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");
const linkLessons = argv.includes("--link-lessons");

const fileIdx = argv.indexOf("--file");
const mdPath =
  fileIdx >= 0 && argv[fileIdx + 1]
    ? path.resolve(argv[fileIdx + 1]!)
    : DEFAULT_MD;

const minScoreIdx = argv.indexOf("--min-score");
const minScore =
  minScoreIdx >= 0 && argv[minScoreIdx + 1]
    ? Number.parseFloat(argv[minScoreIdx + 1]!)
    : 0.72;

const AREA_COURSES: Record<AcademyResourceArea, string[]> = {
  "coach-delivery": ["client-delivery"],
  "profit-system": ["profit-brand-framework"],
};

function lessonCandidatesForArea(
  area: AcademyResourceArea,
  index: LegacyLessonIndexEntry[]
): LegacyLessonIndexEntry[] {
  const courseIds = AREA_COURSES[area];
  return courseIds.flatMap((courseId) => lessonsForCourse(index, courseId));
}

function findLessonForTopic(
  topic: string | null,
  area: AcademyResourceArea,
  index: LegacyLessonIndexEntry[]
): { courseId: string; lessonId: string; score: number } | null {
  const needle = topic?.trim();
  if (!needle) return null;

  let best: { courseId: string; lessonId: string; score: number } | null = null;
  for (const candidate of lessonCandidatesForArea(area, index)) {
    const score = lessonTitleMatchScore(needle, candidate.lessonTitle);
    if (!best || score > best.score) {
      best = { courseId: candidate.courseId, lessonId: candidate.lessonId, score };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

function findLessonForResourceTitle(
  title: string,
  area: AcademyResourceArea,
  index: LegacyLessonIndexEntry[]
): { courseId: string; lessonId: string; score: number } | null {
  let best: { courseId: string; lessonId: string; score: number } | null = null;
  for (const candidate of lessonCandidatesForArea(area, index)) {
    const score = lessonTitleMatchScore(title, candidate.lessonTitle);
    if (!best || score > best.score) {
      best = { courseId: candidate.courseId, lessonId: candidate.lessonId, score };
    }
  }
  if (!best || best.score < minScore) return null;
  return best;
}

function areaForSectionId(
  sectionId: string,
  sections: ReturnType<typeof parseAcademyResourcesMarkdown>["sections"]
): AcademyResourceArea {
  return sections.find((s) => s.id === sectionId)?.area ?? "coach-delivery";
}

function collectLessonLinks(
  appearancesByUrl: Map<string, ResourceAppearance[]>,
  sections: ReturnType<typeof parseAcademyResourcesMarkdown>["sections"],
  lessonIndex: LegacyLessonIndexEntry[]
): Map<string, { courseId: string; lessonId: string; score: number }[]> {
  const linksByUrl = new Map<string, { courseId: string; lessonId: string; score: number }[]>();

  for (const [normalizedUrl, appearances] of appearancesByUrl) {
    const matches: { courseId: string; lessonId: string; score: number }[] = [];
    const seenLessons = new Set<string>();

    for (const appearance of appearances) {
      const area = areaForSectionId(appearance.sectionId, sections);
      const match =
        findLessonForTopic(appearance.topic, area, lessonIndex) ??
        findLessonForResourceTitle(appearance.title, area, lessonIndex);

      if (!match) continue;
      const key = `${match.courseId}:${match.lessonId}`;
      if (seenLessons.has(key)) continue;
      seenLessons.add(key);
      matches.push(match);
    }

    if (matches.length > 0) {
      linksByUrl.set(normalizedUrl, matches);
    }
  }

  return linksByUrl;
}

async function main() {
  if (!dryRun && !apply) {
    console.error("Pass --dry-run or --apply");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!fs.existsSync(mdPath)) {
    console.error(`Markdown file not found: ${mdPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(mdPath, "utf8");
  const parsed = parseAcademyResourcesMarkdown(markdown);
  const withAlignmentTabs = appendClientAlignmentMasterfileTabs(parsed.resources);
  const { resources, appearancesByUrl, removedCount } = dedupeParsedResources(withAlignmentTabs);
  const legacyHub = loadLegacyHub();
  const lessonIndex = buildLegacyLessonIndex(legacyHub);

  console.log(
    `Parsed ${parsed.sections.length} sections, ${parsed.resources.length} resources (${removedCount} duplicate URLs merged) from ${path.basename(mdPath)}`
  );

  const lessonLinks = linkLessons
    ? collectLessonLinks(appearancesByUrl, parsed.sections, lessonIndex)
    : new Map<string, { courseId: string; lessonId: string; score: number }[]>();

  if (linkLessons) {
    const totalLinks = [...lessonLinks.values()].reduce((n, list) => n + list.length, 0);
    console.log(
      `Auto-linked ${lessonLinks.size} unique resources to ${totalLinks} lessons (min score ${minScore})`
    );
  }

  if (dryRun) {
    console.log("\nSections:");
    for (const section of parsed.sections) {
      console.log(
        `  [${section.area}] ${section.parentId ? "  " : ""}${section.title} (${section.id})`
      );
    }
    console.log("\nDuplicate URL merges:");
    for (const [url, appearances] of appearancesByUrl) {
      if (appearances.length <= 1) continue;
      console.log(`  ${url.slice(0, 80)}… (${appearances.length} → 1)`);
    }

    console.log("\nSample resources:");
    for (const resource of resources.slice(0, 8)) {
      const links = lessonLinks.get(resource.normalizedUrl);
      console.log(
        `  ${resource.title} → ${resource.resourceKind}${
          links?.length
            ? ` · ${links.length} lesson link${links.length === 1 ? "" : "s"}`
            : ""
        }`
      );
    }
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { error: clearLinksError } = await supabase
    .from("academy_lesson_resources")
    .delete()
    .neq("course_id", "");
  if (clearLinksError) throw new Error(clearLinksError.message);

  const { error: clearResourcesError } = await supabase
    .from("academy_resources")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (clearResourcesError) throw new Error(clearResourcesError.message);

  const { error: clearSectionsError } = await supabase
    .from("academy_resource_sections")
    .delete()
    .neq("id", "");
  if (clearSectionsError) throw new Error(clearSectionsError.message);

  const sortedSections = [...parsed.sections].sort((a, b) => {
    if (a.parentId === b.parentId) return a.sortOrder - b.sortOrder;
    if (!a.parentId) return -1;
    if (!b.parentId) return 1;
    return a.sortOrder - b.sortOrder;
  });

  for (const section of sortedSections) {
    const { error } = await supabase.from("academy_resource_sections").insert({
      id: section.id,
      area: section.area,
      parent_id: section.parentId,
      title: section.title,
      sort_order: section.sortOrder,
    });
    if (error) throw new Error(`Section ${section.id}: ${error.message}`);
  }

  const urlToResourceId = new Map<string, string>();

  for (const resource of resources) {
    const { data, error } = await supabase
      .from("academy_resources")
      .insert({
        section_id: resource.sectionId,
        topic: resource.topic,
        title: resource.title,
        url: resource.url,
        resource_kind: resource.resourceKind,
        sort_order: resource.sortOrder,
        source_line: resource.sourceLine,
      })
      .select("id, url")
      .single();

    if (error) throw new Error(`Resource ${resource.title}: ${error.message}`);
    urlToResourceId.set(resource.normalizedUrl, data.id as string);
  }

  if (linkLessons) {
    const rows: {
      course_id: string;
      lesson_id: string;
      resource_id: string;
      sort_order: number;
    }[] = [];
    const seen = new Set<string>();

    for (const [normalizedUrl, links] of lessonLinks) {
      const resourceId = urlToResourceId.get(normalizedUrl);
      if (!resourceId) continue;

      for (const link of links) {
        const key = `${link.courseId}:${link.lessonId}:${resourceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          course_id: link.courseId,
          lesson_id: link.lessonId,
          resource_id: resourceId,
          sort_order: rows.length,
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("academy_lesson_resources").insert(rows);
      if (error) throw new Error(error.message);
    }
    console.log(`Inserted ${rows.length} lesson resource links`);
  }

  console.log(`Imported ${parsed.sections.length} sections and ${resources.length} resources`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
