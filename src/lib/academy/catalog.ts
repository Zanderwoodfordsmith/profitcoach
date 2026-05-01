import * as fs from "node:fs";
import * as path from "node:path";

import type { AcademyCatalog, AcademyCategory, AcademyCourse } from "./types";

function catalogPath(): string {
  return path.join(process.cwd(), "content", "academy", "catalog.json");
}

export async function loadAcademyCatalog(): Promise<AcademyCatalog> {
  const raw = await fs.promises.readFile(catalogPath(), "utf-8");
  return JSON.parse(raw) as AcademyCatalog;
}

export function loadAcademyCatalogSync(): AcademyCatalog {
  const raw = fs.readFileSync(catalogPath(), "utf-8");
  return JSON.parse(raw) as AcademyCatalog;
}

export function listCoursesFlat(catalog: AcademyCatalog): Array<{
  category: AcademyCategory;
  course: AcademyCourse;
}> {
  const out: Array<{ category: AcademyCategory; course: AcademyCourse }> = [];
  for (const category of catalog.categories ?? []) {
    for (const course of category.courses ?? []) {
      out.push({ category, course });
    }
  }
  return out;
}

export function findCourse(
  catalog: AcademyCatalog,
  courseId: string
): { category: AcademyCategory; course: AcademyCourse } | null {
  for (const category of catalog.categories ?? []) {
    const course = category.courses?.find((c) => c.id === courseId);
    if (course) return { category, course };
  }
  return null;
}

export function lessonCount(course: AcademyCourse): number {
  return course.lessons?.length ?? 0;
}
