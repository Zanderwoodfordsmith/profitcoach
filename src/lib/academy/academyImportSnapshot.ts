import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
