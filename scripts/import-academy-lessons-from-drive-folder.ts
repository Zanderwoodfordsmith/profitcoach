/**
 * Bulk-import academy programme videos + transcripts from a synced Google Drive folder.
 *
 * Matches files to lessons in content/academy/legacy-hub.json (Current programmes tab).
 *
 * Prerequisites:
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Local path to synced Drive (e.g. Old Academy/Videos + Transcripts)
 *
 * Usage:
 *   npx tsx scripts/import-academy-lessons-from-drive-folder.ts --dry-run --root "<path>"
 *   npx tsx scripts/import-academy-lessons-from-drive-folder.ts --apply --skip-videos --root "<path>"
 *   npx tsx scripts/import-academy-lessons-from-drive-folder.ts --apply --course kickstart --root "<path>"
 *   npx tsx scripts/import-academy-lessons-from-drive-folder.ts --apply --skip-existing --root "<path>"
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { saveAcademyImportSnapshot } from "../src/lib/academy/academyImportSnapshot";
import { stripTranscriptSpeakerLabels } from "../src/lib/academy/stripTranscriptSpeakerLabels";
import {
  buildLegacyLessonIndex,
  classifyMediaFile,
  lessonsForCourse,
  matchStemToLesson,
  resolveCourseIdForPathSegment,
  stemFromFileName,
  type LessonMatchCandidate,
  type MediaFileKind,
} from "../src/lib/academy/legacyLessonMatcher";
import type { LegacyHubCatalog } from "../src/lib/academy/legacyHubCatalog";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LEGACY_HUB_PATH = path.join(process.cwd(), "content/academy/legacy-hub.json");
const DEFAULT_OVERRIDES = path.join(process.cwd(), "scripts/academy-import-overrides.json");

/** Must match `academy-lessons` bucket `file_size_limit` (see 20260731150000 migration). */
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");
const skipVideos =
  argv.includes("--skip-videos") || argv.includes("--transcripts-only");
const continueOnError = argv.includes("--continue-on-error");
const includeAmbiguous = argv.includes("--include-ambiguous");
/** Skip upload/upsert when lesson already has video_url or transcript_text (saves bandwidth). */
const skipExisting = argv.includes("--skip-existing");

const rootIdx = argv.indexOf("--root");
const rootArg = rootIdx >= 0 ? argv[rootIdx + 1]?.trim() : null;

const courseIdx = argv.indexOf("--course");
const courseFilter = courseIdx >= 0 ? argv[courseIdx + 1]?.trim() : null;

const minScoreIdx = argv.indexOf("--min-score");
const minScore =
  minScoreIdx >= 0 && argv[minScoreIdx + 1]
    ? Number.parseFloat(argv[minScoreIdx + 1]!)
    : 0.72;

const overridesIdx = argv.indexOf("--overrides");
const overridesPath =
  overridesIdx >= 0 && argv[overridesIdx + 1]
    ? path.resolve(argv[overridesIdx + 1]!)
    : DEFAULT_OVERRIDES;

const reportIdx = argv.indexOf("--report-out");
const reportOut =
  reportIdx >= 0 && argv[reportIdx + 1]
    ? path.resolve(argv[reportIdx + 1]!)
    : path.join(process.cwd(), "reports", `academy-import-${Date.now()}.json`);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!dryRun && !apply) {
  console.error("Specify --dry-run or --apply.");
  process.exit(1);
}

if (dryRun && apply) {
  console.error("Use only one of --dry-run or --apply.");
  process.exit(1);
}

if (!rootArg) {
  console.error(
    "Usage: npx tsx scripts/import-academy-lessons-from-drive-folder.ts (--dry-run|--apply) --root <folder> [--skip-videos] [--course kickstart] [--report-out path.json]"
  );
  process.exit(1);
}

const importRoot = path.resolve(rootArg);
if (!fs.existsSync(importRoot) || !fs.statSync(importRoot).isDirectory()) {
  console.error(`Not a directory: ${importRoot}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type FileOverride = { courseId: string; lessonId: string };
type OverridesFile = { files?: Record<string, FileOverride> };

type ScannedFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  kind: MediaFileKind;
  stem: string;
  courseId: string | null;
};

type LessonBundle = {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  videoPath: string | null;
  transcriptPath: string | null;
};

type Report = {
  mode: string;
  root: string;
  courseFilter: string | null;
  skipVideos: boolean;
  matched: Array<{
    courseId: string;
    lessonId: string;
    lessonTitle: string;
    score: number;
    videoPath: string | null;
    transcriptPath: string | null;
    videoUploaded?: boolean;
    transcriptStored?: boolean;
  }>;
  ambiguous: Array<{
    relativePath: string;
    kind: MediaFileKind;
    stem: string;
    courseId: string | null;
    candidates: LessonMatchCandidate[];
  }>;
  unmatched: Array<{
    relativePath: string;
    kind: MediaFileKind;
    stem: string;
    courseId: string | null;
    bestScore: number;
    bestLessonTitle: string | null;
  }>;
  skipped: Array<{ relativePath: string; reason: string }>;
  pendingVideos: Array<{
    courseId: string;
    lessonId: string;
    lessonTitle: string;
    videoPath: string;
  }>;
  oversizedVideos: Array<{
    courseId: string;
    lessonId: string;
    lessonTitle: string;
    videoPath: string;
    sizeMb: number;
    maxMb: number;
  }>;
  skippedExisting: Array<{
    courseId: string;
    lessonId: string;
    lessonTitle: string;
    skippedVideo: boolean;
    skippedTranscript: boolean;
  }>;
  errors: Array<{ relativePath: string; message: string }>;
};

function loadCatalog(): LegacyHubCatalog {
  const raw = fs.readFileSync(LEGACY_HUB_PATH, "utf8");
  return JSON.parse(raw) as LegacyHubCatalog;
}

function loadOverrides(): Map<string, FileOverride> {
  const map = new Map<string, FileOverride>();
  if (!fs.existsSync(overridesPath)) return map;
  const data = JSON.parse(fs.readFileSync(overridesPath, "utf8")) as OverridesFile;
  for (const [rel, o] of Object.entries(data.files ?? {})) {
    if (o?.courseId && o?.lessonId) map.set(rel.replace(/\\/g, "/"), o);
  }
  return map;
}

function readDocxText(filePath: string): string {
  try {
    const xml = execFileSync("unzip", ["-p", filePath, "word/document.xml"], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    return xml
      .replace(/<w:tab[^/]*\/>/g, "\t")
      .replace(/<w:br[^/]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

function readTranscriptFile(filePath: string): string {
  const lower = filePath.toLowerCase();
  let raw = "";
  if (lower.endsWith(".docx") || lower.endsWith(".mp4.docx")) {
    raw = readDocxText(filePath);
  } else {
    raw = fs.readFileSync(filePath, "utf8");
  }
  return stripTranscriptSpeakerLabels(raw);
}

function collectMediaFiles(dir: string, baseDir: string, out: ScannedFile[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectMediaFiles(full, baseDir, out);
      continue;
    }
    const kind = classifyMediaFile(ent.name);
    if (kind === "skip") continue;

    const relativePath = path.relative(baseDir, full).replace(/\\/g, "/");
    const parts = relativePath.split("/");
    let courseId: string | null = null;

    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i]!;
      const lower = segment.toLowerCase();
      if (lower === "videos" || lower === "transcripts" || lower === "video") continue;
      const resolved = resolveCourseIdForPathSegment(segment, catalog.courses);
      if (resolved) {
        courseId = resolved;
        break;
      }
    }

    out.push({
      absolutePath: full,
      relativePath,
      fileName: ent.name,
      kind,
      stem: stemFromFileName(ent.name),
      courseId,
    });
  }
}

function academyLessonVideoPublicUrl(storagePath: string): string {
  const base = SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/academy-lessons/${storagePath}`;
}

function videoFileSizeBytes(filePath: string): number {
  return fs.statSync(filePath).size;
}

async function uploadLessonVideo(
  courseId: string,
  lessonId: string,
  filePath: string
): Promise<string> {
  const size = videoFileSizeBytes(filePath);
  if (size > MAX_VIDEO_BYTES) {
    const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
    const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
    throw new Error(
      `Video is ${sizeMb}MB (max ${maxMb}MB). Run migration 20260731150000_academy_lessons_bucket_size_limit.sql or compress the file.`
    );
  }

  const ext = path.extname(filePath).toLowerCase().replace(".", "") || "mp4";
  const safeCourse = courseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `${safeCourse}/${safeLesson}/source.${ext}`;
  const buf = fs.readFileSync(filePath);
  const mime =
    ext === "webm"
      ? "video/webm"
      : ext === "mov"
        ? "video/quicktime"
        : "video/mp4";

  const { error } = await supabase.storage.from("academy-lessons").upload(storagePath, buf, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return academyLessonVideoPublicUrl(storagePath);
}

async function loadExistingContentMap(): Promise<
  Map<string, { hasVideo: boolean; hasTranscript: boolean }>
> {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, video_url, transcript_text");
  if (error) throw new Error(error.message);
  const map = new Map<string, { hasVideo: boolean; hasTranscript: boolean }>();
  for (const row of data ?? []) {
    const r = row as {
      course_id: string;
      lesson_id: string;
      video_url: string | null;
      transcript_text: string | null;
    };
    map.set(`${r.course_id}:${r.lesson_id}`, {
      hasVideo: Boolean(r.video_url?.trim()),
      hasTranscript: Boolean(r.transcript_text?.trim()),
    });
  }
  return map;
}

async function upsertLessonFields(
  courseId: string,
  lessonId: string,
  fields: { videoUrl?: string | null; transcriptText?: string | null }
): Promise<void> {
  const { data: existing } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const row = {
    course_id: courseId,
    lesson_id: lessonId,
    title: existing?.title ?? null,
    video_url:
      fields.videoUrl !== undefined ? fields.videoUrl : (existing?.video_url ?? null),
    body_markdown: existing?.body_markdown ?? null,
    transcript_text:
      fields.transcriptText !== undefined
        ? fields.transcriptText
        : (existing?.transcript_text ?? null),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(error.message);
}

const catalog = loadCatalog();
const lessonIndex = buildLegacyLessonIndex(catalog);
const overrides = loadOverrides();

function resolveMatch(
  file: ScannedFile
): { status: "matched"; match: LessonMatchCandidate } | { status: "ambiguous"; candidates: LessonMatchCandidate[] } | { status: "unmatched"; bestScore: number; best: LessonMatchCandidate | null } | { status: "skip"; reason: string } {
  const override = overrides.get(file.relativePath);
  if (override) {
    const lesson = lessonIndex.find(
      (l) => l.courseId === override.courseId && l.lessonId === override.lessonId
    );
    return {
      status: "matched",
      match: {
        courseId: override.courseId,
        lessonId: override.lessonId,
        lessonTitle: lesson?.lessonTitle ?? override.lessonId,
        score: 1,
      },
    };
  }

  if (!file.courseId) {
    return { status: "skip", reason: "no_course_folder" };
  }

  if (courseFilter && file.courseId !== courseFilter) {
    return { status: "skip", reason: "course_filter" };
  }

  const courseLessons = lessonsForCourse(lessonIndex, file.courseId);
  const result = matchStemToLesson(file.stem, courseLessons, { minScore });

  if (result.status === "matched") return result;
  if (result.status === "ambiguous" && includeAmbiguous && result.candidates[0]) {
    return { status: "matched", match: result.candidates[0]! };
  }
  if (result.status === "ambiguous") return result;
  return {
    status: "unmatched",
    bestScore: result.bestScore,
    best: result.bestCandidate,
  };
}

async function main() {
  const scanned: ScannedFile[] = [];
  collectMediaFiles(importRoot, importRoot, scanned);

  const bundles = new Map<string, LessonBundle>();
  const report: Report = {
    mode: dryRun ? "dry-run" : "apply",
    root: importRoot,
    courseFilter,
    skipVideos,
    matched: [],
    ambiguous: [],
    unmatched: [],
    skipped: [],
    pendingVideos: [],
    oversizedVideos: [],
    skippedExisting: [],
    errors: [],
  };

  const existingContent = apply && skipExisting ? await loadExistingContentMap() : null;

  console.log(
    `[academy-import] root=${importRoot} files=${scanned.length} mode=${report.mode} skipVideos=${skipVideos} course=${courseFilter ?? "all"}`
  );

  for (const file of scanned) {
    const resolved = resolveMatch(file);
    if (resolved.status === "skip") {
      if (resolved.reason !== "course_filter") {
        report.skipped.push({ relativePath: file.relativePath, reason: resolved.reason });
      }
      continue;
    }

    if (resolved.status === "ambiguous") {
      report.ambiguous.push({
        relativePath: file.relativePath,
        kind: file.kind,
        stem: file.stem,
        courseId: file.courseId,
        candidates: resolved.candidates,
      });
      continue;
    }

    if (resolved.status === "unmatched") {
      report.unmatched.push({
        relativePath: file.relativePath,
        kind: file.kind,
        stem: file.stem,
        courseId: file.courseId,
        bestScore: resolved.bestScore,
        bestLessonTitle: resolved.best?.lessonTitle ?? null,
      });
      continue;
    }

    const { match } = resolved;
    const key = `${match.courseId}:${match.lessonId}`;
    let bundle = bundles.get(key);
    if (!bundle) {
      bundle = {
        courseId: match.courseId,
        lessonId: match.lessonId,
        lessonTitle: match.lessonTitle,
        score: match.score,
        videoPath: null,
        transcriptPath: null,
      };
      bundles.set(key, bundle);
    } else if (match.score > bundle.score) {
      bundle.score = match.score;
    }

    if (file.kind === "video") {
      if (bundle.videoPath) {
        report.skipped.push({
          relativePath: file.relativePath,
          reason: `duplicate_video_for_${key}`,
        });
      } else {
        bundle.videoPath = file.absolutePath;
      }
    } else if (file.kind === "transcript") {
      if (bundle.transcriptPath) {
        report.skipped.push({
          relativePath: file.relativePath,
          reason: `duplicate_transcript_for_${key}`,
        });
      } else {
        bundle.transcriptPath = file.absolutePath;
      }
    }
  }

  for (const bundle of bundles.values()) {
    const entry = {
      courseId: bundle.courseId,
      lessonId: bundle.lessonId,
      lessonTitle: bundle.lessonTitle,
      score: bundle.score,
      videoPath: bundle.videoPath,
      transcriptPath: bundle.transcriptPath,
    };

    if (dryRun) {
      if (bundle.videoPath && skipVideos) {
        report.pendingVideos.push({
          courseId: bundle.courseId,
          lessonId: bundle.lessonId,
          lessonTitle: bundle.lessonTitle,
          videoPath: path.relative(importRoot, bundle.videoPath),
        });
      }
      report.matched.push({
        ...entry,
        videoPath: bundle.videoPath ? path.relative(importRoot, bundle.videoPath) : null,
        transcriptPath: bundle.transcriptPath
          ? path.relative(importRoot, bundle.transcriptPath)
          : null,
        videoUploaded: Boolean(bundle.videoPath && !skipVideos),
        transcriptStored: Boolean(bundle.transcriptPath),
      });
      continue;
    }

    let videoUploaded = false;
    let transcriptStored = false;

    try {
      const existingKey = `${bundle.courseId}:${bundle.lessonId}`;
      const existing = existingContent?.get(existingKey);

      if (bundle.transcriptPath) {
        if (skipExisting && existing?.hasTranscript) {
          report.skippedExisting.push({
            courseId: bundle.courseId,
            lessonId: bundle.lessonId,
            lessonTitle: bundle.lessonTitle,
            skippedVideo: false,
            skippedTranscript: true,
          });
        } else {
          const text = readTranscriptFile(bundle.transcriptPath);
          if (text) {
            await upsertLessonFields(bundle.courseId, bundle.lessonId, {
              transcriptText: text,
            });
            transcriptStored = true;
          }
        }
      }

      if (bundle.videoPath && !skipVideos) {
        if (skipExisting && existing?.hasVideo) {
          report.skippedExisting.push({
            courseId: bundle.courseId,
            lessonId: bundle.lessonId,
            lessonTitle: bundle.lessonTitle,
            skippedVideo: true,
            skippedTranscript: false,
          });
        } else {
          const size = videoFileSizeBytes(bundle.videoPath);
          if (size > MAX_VIDEO_BYTES) {
            const sizeMb = Math.round((size / (1024 * 1024)) * 10) / 10;
            const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
            report.oversizedVideos.push({
              courseId: bundle.courseId,
              lessonId: bundle.lessonId,
              lessonTitle: bundle.lessonTitle,
              videoPath: path.relative(importRoot, bundle.videoPath),
              sizeMb,
              maxMb,
            });
            report.errors.push({
              relativePath: path.relative(importRoot, bundle.videoPath),
              message: `Video ${sizeMb}MB exceeds ${maxMb}MB limit`,
            });
          } else {
            const url = await uploadLessonVideo(
              bundle.courseId,
              bundle.lessonId,
              bundle.videoPath
            );
            await upsertLessonFields(bundle.courseId, bundle.lessonId, { videoUrl: url });
            videoUploaded = true;
          }
        }
      } else if (bundle.videoPath && skipVideos) {
        report.pendingVideos.push({
          courseId: bundle.courseId,
          lessonId: bundle.lessonId,
          lessonTitle: bundle.lessonTitle,
          videoPath: path.relative(importRoot, bundle.videoPath),
        });
      }

      report.matched.push({
        ...entry,
        videoPath: bundle.videoPath ? path.relative(importRoot, bundle.videoPath) : null,
        transcriptPath: bundle.transcriptPath
          ? path.relative(importRoot, bundle.transcriptPath)
          : null,
        videoUploaded,
        transcriptStored,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      report.errors.push({
        relativePath: `${bundle.courseId}/${bundle.lessonId}`,
        message: msg,
      });
      if (!continueOnError) throw err;
    }
  }

  fs.mkdirSync(path.dirname(reportOut), { recursive: true });
  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2));

  const csvPath = reportOut.replace(/\.json$/i, "") + "-unmatched.csv";
  const csvLines = [
    "relativePath,kind,stem,courseId,bestScore,bestLessonTitle",
    ...report.unmatched.map((u) =>
      [
        JSON.stringify(u.relativePath),
        u.kind,
        JSON.stringify(u.stem),
        u.courseId ?? "",
        u.bestScore.toFixed(3),
        JSON.stringify(u.bestLessonTitle ?? ""),
      ].join(",")
    ),
  ];
  fs.writeFileSync(csvPath, csvLines.join("\n"));

  try {
    await saveAcademyImportSnapshot(report);
    console.log("[academy-import] snapshot saved for admin Import tab");
  } catch (snapErr) {
    console.warn(
      "[academy-import] could not save admin snapshot (run migration 20260731160000?):",
      snapErr instanceof Error ? snapErr.message : snapErr
    );
  }

  console.log(`[academy-import] report=${reportOut}`);
  console.log(
    `[academy-import] matched=${report.matched.length} ambiguous=${report.ambiguous.length} unmatched=${report.unmatched.length} skipped=${report.skipped.length} pendingVideos=${report.pendingVideos.length} oversizedVideos=${report.oversizedVideos.length} skippedExisting=${report.skippedExisting.length} errors=${report.errors.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
