import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ACADEMY_RESOURCE_AREA_LABELS,
  type AcademyResourceRow,
  type AcademyResourcesCatalog,
  type AcademyResourceSectionRow,
  buildSectionTree,
} from "@/lib/academy/resourcesCatalog";
export {
  ACADEMY_RESOURCE_AREA_LABELS,
  ACADEMY_RESOURCE_KIND_LABELS,
  type AcademyResourceDocumentBundle,
  type AcademyResourceRow,
  type AcademyResourcesCatalog,
  type AcademyResourceSectionContent,
  type AcademyResourceSectionRow,
  type AcademyResourceSectionTree,
  type AcademyResourceTopicGroup,
  type AcademyResourceWithRelated,
  buildSectionResourceContent,
  filterResourcesCatalog,
} from "@/lib/academy/resourcesCatalog";

export type AcademyLessonResourceRow = {
  course_id: string;
  lesson_id: string;
  resource_id: string;
  sort_order: number;
};

export type AcademyResourceWithSection = AcademyResourceRow & {
  section: AcademyResourceSectionRow;
};

export async function deleteAcademyResource(resourceId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("academy_resources")
    .delete()
    .eq("id", resourceId);

  if (error) {
    throw new Error(error.message ?? "Failed to delete resource.");
  }
}

export async function loadAcademyResourcesCatalog(): Promise<AcademyResourcesCatalog> {
  const [{ data: sections }, { data: resources }] = await Promise.all([
    supabaseAdmin.from("academy_resource_sections").select("*").order("sort_order"),
    supabaseAdmin.from("academy_resources").select("*").order("sort_order"),
  ]);

  // Vault worksheets (area `vault`) live on their lessons only, so keep them
  // out of the library tree and its search.
  const sectionRows = ((sections ?? []) as AcademyResourceSectionRow[]).filter(
    (section) => section.area in ACADEMY_RESOURCE_AREA_LABELS
  );
  const librarySectionIds = new Set(sectionRows.map((section) => section.id));
  const resourceRows = ((resources ?? []) as AcademyResourceRow[]).filter((resource) =>
    librarySectionIds.has(resource.section_id)
  );

  return {
    sections: sectionRows,
    resources: resourceRows,
    byArea: {
      "coach-delivery": buildSectionTree(sectionRows, resourceRows, "coach-delivery"),
      "profit-system": buildSectionTree(sectionRows, resourceRows, "profit-system"),
    },
  };
}

export async function loadLessonResources(
  courseId: string,
  lessonId: string
): Promise<AcademyResourceRow[]> {
  const { data: links } = await supabaseAdmin
    .from("academy_lesson_resources")
    .select("resource_id, sort_order")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .order("sort_order");

  const resourceIds = (links ?? []).map((row) => row.resource_id as string);
  if (resourceIds.length === 0) return [];

  const { data: resources } = await supabaseAdmin
    .from("academy_resources")
    .select("*")
    .in("id", resourceIds);

  const byId = new Map((resources ?? []).map((row) => [row.id as string, row as AcademyResourceRow]));
  return resourceIds
    .map((id) => byId.get(id))
    .filter((row): row is AcademyResourceRow => Boolean(row));
}

