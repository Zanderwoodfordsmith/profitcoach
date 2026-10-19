import { ClassroomCourseOverviewCard } from "@/components/academy/ClassroomCourseOverviewCard";
import { firstLessonInCourse, flattenSections } from "@/lib/academy/hubCatalog";
import { loadVaultHub } from "@/lib/academy/vaultHubLoad";

type Props = {
  basePath: string;
};

const VAULT_COVERS: Record<
  string,
  { coverImageUrl?: string; eyebrow: string; eyebrowClassName: string; accentClassName: string }
> = {
  stryvx: {
    // Alternative: /academy/vault/stryvx-hologram.jpg (the original StryvX brain photo).
    coverImageUrl: "/academy/vault/stryvx.jpg",
    eyebrow: "Personal growth",
    eyebrowClassName: "text-[#0e7f9c]",
    accentClassName: "bg-gradient-to-br from-[#0f2f4f] via-[#155e75] to-[#1ca0c2]",
  },
  books: {
    // Alternatives: /academy/vault/books.jpg (open book of light), /academy/vault/books-person.jpg (separate head and shoulders).
    coverImageUrl: "/academy/vault/books-person-2.jpg",
    eyebrow: "Book summaries",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0f2f4f] via-[#0c5290] to-[#1a8fd4]",
  },
  "how-to": {
    // Alternatives: /academy/vault/how-to-gears.jpg (meshing gears), /academy/vault/how-to.jpg (laptop fan, close to Books).
    coverImageUrl: "/academy/vault/how-to-toggles.jpg",
    eyebrow: "Tools & set-up",
    eyebrowClassName: "text-[#0f766e]",
    accentClassName: "bg-gradient-to-br from-[#0f2f4f] via-[#0f766e] to-[#2dd4c4]",
  },
};

export function VaultCatalogGrid({ basePath }: Props) {
  const catalog = loadVaultHub();

  return (
    <div className="mx-auto w-[80%] max-w-6xl pt-5">
      <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-8">
        {catalog.courses.map((course) => {
          const meta = VAULT_COVERS[course.id] ?? {
            eyebrow: "Programme",
            eyebrowClassName: "text-[#0c5290]",
            accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
          };
          // Straight to the first lesson, same as the Classroom cards.
          const first = firstLessonInCourse(course);
          const href = first
            ? `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(first.id)}`
            : `${basePath}/${encodeURIComponent(course.id)}`;
          return (
            <ClassroomCourseOverviewCard
              key={course.id}
              href={href}
              courseId={course.id}
              eyebrow={meta.eyebrow}
              eyebrowClassName={meta.eyebrowClassName}
              title={course.title}
              description={course.description ?? ""}
              accentClassName={meta.accentClassName}
              coverImageUrl={meta.coverImageUrl}
              lessons={flattenSections(course.sections).flatMap((section) =>
                section.lessons.map((lesson) => ({ id: lesson.id })),
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
