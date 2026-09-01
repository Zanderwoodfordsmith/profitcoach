import { unlink } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteAcademyImportOverride } from "@/lib/academy/academyImportOverrides";

/** Drive import file kinds stored on snapshot unmatched/ambiguous rows. */
export type AcademyImportMediaKind = "video" | "transcript";

export type AcademyImportSnapshotReport = {
  mode?: string;
  root?: string;
  matched?: unknown[];
  ambiguous?: Array<{
    relativePath: string;
    kind: AcademyImportMediaKind;
    stem: string;
    courseId: string | null;
    candidates?: Array<{ lessonTitle: string; score: number }>;
  }>;
  unmatched?: Array<{
    relativePath: string;
    kind: AcademyImportMediaKind;
    stem: string;
    courseId: string | null;
    bestScore: number;
    bestLessonTitle: string | null;
    bestLessonId?: string | null;
    bestLessonCourseId?: string | null;
  }>;
  oversizedVideos?: Array<{
    courseId: string;
    lessonId: string;
    lessonTitle: string;
    videoPath: string;
    sizeMb: number;
    maxMb: number;
  }>;
  errors?: Array<{ relativePath: string; message: string }>;
  pendingVideos?: unknown[];
};

export async function saveAcademyImportSnapshot(
  report: AcademyImportSnapshotReport
): Promise<void> {
  const { error } = await supabaseAdmin.from("academy_import_snapshot").upsert(
    {
      id: 1,
      report,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

export async function loadAcademyImportSnapshot(): Promise<{
  report: AcademyImportSnapshotReport | null;
  updatedAt: string | null;
}> {
  const { data } = await supabaseAdmin
    .from("academy_import_snapshot")
    .select("report, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return { report: null, updatedAt: null };
  return {
    report: data.report as AcademyImportSnapshotReport,
    updatedAt: data.updated_at as string,
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

function resolveUnderRoot(root: string, relativePath: string): string | null {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || normalized.includes("\0") || path.isAbsolute(normalized)) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  return resolved;
}

export type DeleteUnmatchedImportFileResult = {
  relativePath: string;
  removedFromSnapshot: boolean;
  deletedFromDisk: boolean;
  diskMessage: string | null;
};

/**
 * Remove an unmatched/ambiguous Drive import file from the snapshot and,
 * when the snapshot root is reachable on this machine, delete the file on disk.
 * Only paths already listed in the snapshot are accepted (no arbitrary deletes).
 */
export async function deleteUnmatchedImportFile(
  relativePathInput: string
): Promise<DeleteUnmatchedImportFileResult> {
  const relativePath = normalizeRelativePath(relativePathInput);
  if (!relativePath) throw new Error("relativePath is required.");

  const { report } = await loadAcademyImportSnapshot();
  if (!report) throw new Error("No import snapshot is available.");

  const inUnmatched = (report.unmatched ?? []).some(
    (row) => normalizeRelativePath(row.relativePath) === relativePath
  );
  const inAmbiguous = (report.ambiguous ?? []).some(
    (row) => normalizeRelativePath(row.relativePath) === relativePath
  );
  if (!inUnmatched && !inAmbiguous) {
    throw new Error("That file is not listed as unmatched or ambiguous.");
  }

  let deletedFromDisk = false;
  let diskMessage: string | null = null;
  const root = report.root?.trim();
  if (root) {
    const absolute = resolveUnderRoot(root, relativePath);
    if (!absolute) {
      diskMessage = "Could not resolve a safe path under the import root.";
    } else {
      try {
        await unlink(absolute);
        deletedFromDisk = true;
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (code === "ENOENT") {
          diskMessage = "File was already missing on disk.";
        } else {
          diskMessage =
            error instanceof Error
              ? `Removed from list, but disk delete failed: ${error.message}`
              : "Removed from list, but disk delete failed.";
        }
      }
    }
  } else {
    diskMessage = "Snapshot has no import root; removed from list only.";
  }

  const nextReport: AcademyImportSnapshotReport = {
    ...report,
    unmatched: (report.unmatched ?? []).filter(
      (row) => normalizeRelativePath(row.relativePath) !== relativePath
    ),
    ambiguous: (report.ambiguous ?? []).filter(
      (row) => normalizeRelativePath(row.relativePath) !== relativePath
    ),
  };
  await saveAcademyImportSnapshot(nextReport);
  try {
    await deleteAcademyImportOverride(relativePath);
  } catch {
    // Overrides table may be absent or empty; snapshot/disk delete already succeeded.
  }

  return {
    relativePath,
    removedFromSnapshot: true,
    deletedFromDisk,
    diskMessage,
  };
}
