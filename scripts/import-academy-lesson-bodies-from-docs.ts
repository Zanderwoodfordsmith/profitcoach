/**
 * Import lesson body markdown from the hand-formatted "Old Academy" Google Docs
 * exports (one tab per lesson) into academy_lesson_content.body_markdown.
 *
 * Each `#` H1 in a source doc is a lesson tab title (possibly truncated to ~50
 * chars). We split the doc into lessons (parseLessonDocs), match each title to a
 * legacy-hub lesson (matchDocTitleToLesson + manual overrides), clean + normalize
 * the markdown, and upsert ONLY body_markdown (title/video/transcript are left
 * untouched).
 *
 * Prerequisites:
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-academy-lesson-bodies-from-docs.ts --dry-run
 *   npx tsx scripts/import-academy-lesson-bodies-from-docs.ts --apply
 *   npx tsx scripts/import-academy-lesson-bodies-from-docs.ts --dry-run --file content/academy/source/old-academy-text-content-1.md
 *   npm run import-academy-bodies -- --dry-run
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { parseLessonDocFile, type ParsedLessonDoc } from "../src/lib/academy/parseLessonDocs";
import { loadLegacyHub } from "../src/lib/academy/legacyHubLoad";
import {
  buildLegacyLessonIndex,
  matchDocTitleToLesson,
} from "../src/lib/academy/legacyLessonMatcher";
import { normalizeMatchText } from "../src/lib/academy/normalizeMatchText";
import { normalizeLessonMarkdown } from "../src/lib/academy/normalizeLessonMarkdown";
import {
  ensureLessonImageBucket,
  hostBase64Images,
  countEmbeddedImages,
  collectImageRefDefs,
} from "./lessonImageHosting";
import type { ImageRef } from "./lessonImageHosting";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_FILES = [
  "content/academy/source/old-academy-template-docs.md",
  "content/academy/source/old-academy-text-content-1.md",
  "content/academy/source/old-academy-text-content-2.md",
];
const DEFAULT_OVERRIDES = path.join(
  process.cwd(),
  "scripts/academy-lesson-body-overrides.json"
);

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");
const hostImages = !argv.includes("--no-host-images");

function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1] && !argv[i + 1]!.startsWith("-")) {
      out.push(argv[i + 1]!);
    }
  }
  return out;
}

function argValue(flag: string): string | null {
  const idx = argv.indexOf(flag);
  return idx >= 0 && argv[idx + 1] && !argv[idx + 1]!.startsWith("-")
    ? argv[idx + 1]!
    : null;
}

const fileArgs = argValues("--file");
const files = (fileArgs.length > 0 ? fileArgs : DEFAULT_FILES)
  .map((f) => path.resolve(f))
  .filter((f) => {
    const exists = fs.existsSync(f);
    if (!exists) console.warn(`[skip] source file not found: ${f}`);
    return exists;
  });

const overridesPath = argValue("--overrides")
  ? path.resolve(argValue("--overrides")!)
  : DEFAULT_OVERRIDES;

const minScore = argValue("--min-score")
  ? Number.parseFloat(argValue("--min-score")!)
  : 0.72;

const reportOut = argValue("--report-out")
  ? path.resolve(argValue("--report-out")!)
  : path.join(process.cwd(), "reports", `academy-body-import-${Date.now()}.json`);

type OverrideTarget = { courseId: string; lessonId: string };

type ResolvedKind = "override" | "matched" | "ambiguous" | "unmatched";

type Resolved = {
  lesson: ParsedLessonDoc;
  kind: ResolvedKind;
  target: OverrideTarget | null;
  score: number;
  candidates?: { lessonId: string; score: number }[];
  /** Source body after light cleanup, base64 images still inline. */
  precleanBody: string;
  /** Final body (images hosted + normalized); filled in the finalize pass. */
  cleanedBody: string;
  /** Number of embedded images in the source body (for reporting). */
  imageCount: number;
  /** Whole-file image reference definitions for this lesson's source doc. */
  fileRefDefs: Map<string, ImageRef>;
};

/**
 * Light pre-clean of a source-doc body. Base64 images are left intact here —
 * they are hosted to storage (or stripped) in the finalize pass.
 */
function cleanImportedBody(md: string): string {
  let out = md;
  // Non-breaking spaces from Google Docs -> normal spaces.
  out = out.replace(/\u00a0/g, " ");
  // Empty heading lines (`### ` with nothing after) the source sometimes leaves behind.
  out = out.replace(/^#{1,6}[ \t]*$/gm, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Fallback when image hosting is disabled or unavailable: strip embedded images. */
function stripEmbeddedImages(md: string): string {
  return md
    .replace(/^\s*\[[^\]]+\]:\s*<?\s*data:image\/[^\n]*$/gim, "")
    .replace(/!\[[^\]]*\]\(\s*data:image\/[^)]*\)/gi, "")
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadOverrides(): {
  byExact: Map<string, OverrideTarget>;
  byNormalized: Map<string, OverrideTarget>;
} {
  const byExact = new Map<string, OverrideTarget>();
  const byNormalized = new Map<string, OverrideTarget>();
  if (!fs.existsSync(overridesPath)) return { byExact, byNormalized };
  const raw = JSON.parse(fs.readFileSync(overridesPath, "utf8")) as {
    titles?: Record<string, OverrideTarget>;
  };
  for (const [title, target] of Object.entries(raw.titles ?? {})) {
    byExact.set(title, target);
    byNormalized.set(normalizeMatchText(title), target);
  }
  return { byExact, byNormalized };
}

async function main() {
  if (dryRun === apply) {
    console.error("Specify exactly one of --dry-run or --apply.");
    process.exit(1);
  }
  if (files.length === 0) {
    console.error("No source files to import.");
    process.exit(1);
  }
  if (apply && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const index = buildLegacyLessonIndex(loadLegacyHub());
  const { byExact, byNormalized } = loadOverrides();

  const resolved: Resolved[] = [];
  for (const file of files) {
    const fileText = fs.readFileSync(file, "utf8");
    const fileRefDefs = collectImageRefDefs(fileText);
    const lessons = parseLessonDocFile(file);
    console.log(`Parsed ${lessons.length} lessons from ${path.basename(file)}`);
    for (const lesson of lessons) {
      const precleanBody = cleanImportedBody(lesson.bodyMarkdown);
      const imageCount = countEmbeddedImages(precleanBody, fileRefDefs);
      const base = { precleanBody, cleanedBody: "", imageCount, fileRefDefs };

      const override =
        byExact.get(lesson.title) ?? byNormalized.get(normalizeMatchText(lesson.title));
      if (override) {
        resolved.push({ lesson, kind: "override", target: override, score: 1, ...base });
        continue;
      }

      const match = matchDocTitleToLesson(lesson.title, index, { minScore });
      if (match.status === "matched") {
        resolved.push({
          lesson,
          kind: "matched",
          target: { courseId: match.match.courseId, lessonId: match.match.lessonId },
          score: match.match.score,
          ...base,
        });
      } else if (match.status === "ambiguous") {
        resolved.push({
          lesson,
          kind: "ambiguous",
          target: null,
          score: match.candidates[0]?.score ?? 0,
          candidates: match.candidates.map((c) => ({ lessonId: c.lessonId, score: c.score })),
          ...base,
        });
      } else {
        resolved.push({
          lesson,
          kind: "unmatched",
          target: null,
          score: match.bestScore,
          candidates: match.bestCandidate
            ? [{ lessonId: match.bestCandidate.lessonId, score: match.bestCandidate.score }]
            : [],
          ...base,
        });
      }
    }
  }

  // Look up which targets already have a stored body (Task-1 overwrite vs Task-2 fill).
  const supabase =
    SUPABASE_URL && SERVICE_KEY
      ? createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  const existingByKey = new Map<
    string,
    { course_id: string; lesson_id: string; body_markdown: string | null }
  >();
  if (supabase) {
    const { data, error } = await supabase
      .from("academy_lesson_content")
      .select("course_id, lesson_id, body_markdown");
    if (error) {
      console.error(`Failed to read existing content: ${error.message}`);
      process.exit(1);
    }
    for (const row of data ?? []) {
      existingByKey.set(`${row.course_id}:${row.lesson_id}`, row);
    }
  }

  // ---- Finalize bodies: host embedded images (or strip) + normalize ----
  const doHost = hostImages && Boolean(supabase) && Boolean(SUPABASE_URL);
  if (apply && doHost && supabase) {
    await ensureLessonImageBucket(supabase);
  }
  const imageCache = new Map<string, string | null>();
  let imgHosted = 0;
  let imgReused = 0;
  let imgSkipped = 0;
  let imgDropped = 0;
  for (const r of resolved) {
    if (!r.target) continue;
    let body = r.precleanBody;
    if (doHost && supabase) {
      const res = await hostBase64Images(body, supabase, {
        supabaseUrl: SUPABASE_URL!,
        upload: apply,
        cache: imageCache,
        refDefs: r.fileRefDefs,
      });
      body = res.markdown;
      imgHosted += res.hosted;
      imgReused += res.reused;
      imgSkipped += res.skippedTiny;
      imgDropped += res.droppedOrphan;
    } else {
      body = stripEmbeddedImages(body);
    }
    r.cleanedBody = normalizeLessonMarkdown(body);
  }
  if (doHost) {
    console.log(
      `\nImages: ${imgHosted} hosted${apply ? "" : " (predicted; dry-run uploads nothing)"}, ` +
        `${imgReused} reused, ${imgSkipped} skipped (icons), ${imgDropped} orphan refs dropped.`
    );
  } else {
    console.log("\nImages: hosting disabled — embedded images stripped.");
  }

  const keyOf = (t: OverrideTarget) => `${t.courseId}:${t.lessonId}`;
  const hasExistingBody = (t: OverrideTarget) =>
    Boolean(existingByKey.get(keyOf(t))?.body_markdown?.trim());

  // Detect multiple doc lessons resolving to the same target.
  const targetCounts = new Map<string, number>();
  for (const r of resolved) {
    if (r.target) targetCounts.set(keyOf(r.target), (targetCounts.get(keyOf(r.target)) ?? 0) + 1);
  }

  // ---- Report ----
  console.log("\n=== Resolution report ===");
  let willWrite = 0;
  let willFill = 0;
  let willOverwrite = 0;
  for (const r of resolved) {
    const tag =
      r.kind === "override"
        ? "OVERRIDE"
        : r.kind === "matched"
          ? "MATCH   "
          : r.kind === "ambiguous"
            ? "AMBIG   "
            : "UNMATCH ";
    if (r.target) {
      const existing = hasExistingBody(r.target);
      const dupe = (targetCounts.get(keyOf(r.target)) ?? 0) > 1 ? " [DUP TARGET]" : "";
      willWrite += 1;
      if (existing) willOverwrite += 1;
      else willFill += 1;
      const imgTag = r.imageCount > 0 ? `, ${r.imageCount} img` : "";
      console.log(
        `  ${tag} ${r.score.toFixed(2)} "${r.lesson.title}" -> ${r.target.courseId}/${r.target.lessonId} ${
          existing ? "(reformat existing)" : "(new content)"
        }${dupe} [${r.cleanedBody.length} chars${imgTag}]`
      );
    } else {
      console.log(
        `  ${tag} ${r.score.toFixed(2)} "${r.lesson.title}" (${path.basename(r.lesson.sourceFile)}:${r.lesson.sourceLine})` +
          (r.candidates?.length
            ? ` -> ${r.candidates.map((c) => `${c.score.toFixed(2)} ${c.lessonId}`).join(" | ")}`
            : "")
      );
    }
  }

  const unresolved = resolved.filter((r) => !r.target);
  console.log(
    `\nSummary: ${resolved.length} lessons, ${willWrite} resolved (${willFill} new, ${willOverwrite} reformat), ${unresolved.length} need attention (ambiguous/unmatched).`
  );
  if (unresolved.length > 0) {
    console.log(
      "  Resolve these by adding a `titles` entry to scripts/academy-lesson-body-overrides.json"
    );
  }

  // Persist the report for review.
  fs.mkdirSync(path.dirname(reportOut), { recursive: true });
  fs.writeFileSync(
    reportOut,
    JSON.stringify(
      resolved.map((r) => ({
        title: r.lesson.title,
        sourceFile: r.lesson.sourceFile,
        sourceLine: r.lesson.sourceLine,
        kind: r.kind,
        target: r.target,
        score: r.score,
        candidates: r.candidates,
        existingBody: r.target ? hasExistingBody(r.target) : null,
        bodyChars: r.cleanedBody.length,
        imageCount: r.imageCount,
      })),
      null,
      2
    ),
    "utf8"
  );
  console.log(`Report written to ${path.relative(process.cwd(), reportOut)}`);

  if (dryRun) return;
  if (!supabase) {
    console.error("Cannot apply without Supabase credentials.");
    process.exit(1);
  }

  // ---- Apply ----
  const writes = resolved.filter((r) => r.target);

  // Back up any existing rows we are about to change.
  const backups = writes
    .map((r) => existingByKey.get(keyOf(r.target!)))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (backups.length > 0) {
    const dir = path.join(process.cwd(), "scripts", "backups");
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `academy-lesson-bodies-pre-import-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(backups, null, 2), "utf8");
    console.log(`\nBacked up ${backups.length} existing rows to ${path.relative(process.cwd(), file)}`);
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();
  for (const r of writes) {
    const target = r.target!;
    const exists = existingByKey.has(keyOf(target));
    if (exists) {
      const { error } = await supabase
        .from("academy_lesson_content")
        .update({ body_markdown: r.cleanedBody, updated_at: now })
        .eq("course_id", target.courseId)
        .eq("lesson_id", target.lessonId);
      if (error) {
        console.error(`  failed update ${keyOf(target)}: ${error.message}`);
        failed += 1;
      } else {
        updated += 1;
      }
    } else {
      const { error } = await supabase.from("academy_lesson_content").insert({
        course_id: target.courseId,
        lesson_id: target.lessonId,
        body_markdown: r.cleanedBody,
        updated_at: now,
      });
      if (error) {
        console.error(`  failed insert ${keyOf(target)}: ${error.message}`);
        failed += 1;
      } else {
        inserted += 1;
      }
    }
  }

  console.log(
    `\nApplied: ${inserted} inserted, ${updated} updated, ${failed} failed (of ${writes.length}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
