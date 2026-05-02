import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { lessonCount, listCoursesFlat, loadAcademyCatalog } from "@/lib/academy/catalog";

type Props = {
  basePath: string;
  /** Admins: show where to edit (file in repo for now). */
  showSourceEditHint?: boolean;
};

export async function AcademyCatalogHome({ basePath, showSourceEditHint }: Props) {
  const catalog = await loadAcademyCatalog();
  const rows = listCoursesFlat(catalog);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          Internal
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Classroom</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Training for coaches. Catalog:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
            content/academy/catalog.json
          </code>
        </p>
      </header>

      {showSourceEditHint ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="region"
          aria-label="How to edit classroom content"
        >
          <p className="font-semibold text-amber-900">Editing (admins)</p>
          <p className="mt-1 text-amber-950/90">
            Update courses and lessons in{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
              content/academy/catalog.json
            </code>{" "}
            in the repo, then commit and deploy. Coaches see changes on the next deploy. An in-app
            editor can be added later if you want non-developers to edit without Git.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ category, course }) => (
          <AcademyCourseCard
            key={course.id}
            href={`${basePath}/${course.id}`}
            title={course.title}
            description={course.description ?? ""}
            categoryTitle={category.title}
            lessonCount={lessonCount(course)}
            coverImageUrl={course.coverImageUrl}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-slate-600">No courses in the catalog yet.</p>
      )}
    </div>
  );
}
