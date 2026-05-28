import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AcademyImportOverride = {
  relativePath: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

type OverrideRow = {
  relative_path: string;
  course_id: string;
  lesson_id: string;
  lesson_title: string | null;
  created_at: string;
  updated_at: string;
};

function rowToOverride(row: OverrideRow): AcademyImportOverride {
  return {
    relativePath: row.relative_path,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadAcademyImportOverrides(): Promise<AcademyImportOverride[]> {
  const { data, error } = await supabaseAdmin
    .from("academy_import_overrides")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToOverride(row as OverrideRow));
}

export async function upsertAcademyImportOverride(input: {
  relativePath: string;
  courseId: string;
  lessonId: string;
  lessonTitle?: string | null;
}): Promise<AcademyImportOverride> {
  const relativePath = input.relativePath.replace(/\\/g, "/").trim();
  const { data, error } = await supabaseAdmin
    .from("academy_import_overrides")
    .upsert(
      {
        relative_path: relativePath,
        course_id: input.courseId,
        lesson_id: input.lessonId,
        lesson_title: input.lessonTitle?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "relative_path" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToOverride(data as OverrideRow);
}

export async function deleteAcademyImportOverride(relativePath: string): Promise<void> {
  const normalized = relativePath.replace(/\\/g, "/").trim();
  const { error } = await supabaseAdmin
    .from("academy_import_overrides")
    .delete()
    .eq("relative_path", normalized);
  if (error) throw new Error(error.message);
}

export function overridesByPath(
  overrides: AcademyImportOverride[]
): Map<string, AcademyImportOverride> {
  const map = new Map<string, AcademyImportOverride>();
  for (const o of overrides) {
    map.set(o.relativePath, o);
  }
  return map;
}
