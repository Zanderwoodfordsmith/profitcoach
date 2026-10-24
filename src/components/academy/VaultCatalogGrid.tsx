import { ClassroomCourseOverviewCard } from "@/components/academy/ClassroomCourseOverviewCard";
import { VaultCoachTalks } from "@/components/academy/VaultCoachTalks";
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

/** The course covers, in order, for the folded Vault card on Classroom. */
export const VAULT_COVER_IMAGES = Object.values(VAULT_COVERS).flatMap((cover) =>
  cover.coverImageUrl ? [cover.coverImageUrl] : [],
);

/** Shown as a row of single talks under the course cards, not as a card. */
const COACH_TALKS_ID = "coach-talks";

/** The Vault's course cards and talks, shown as "The Vault" on the Classroom page. */
export function VaultCourses({ basePath }: Props) {
  const catalog = loadVaultHub();
  const talks = catalog.courses.find((course) => course.id === COACH_TALKS_ID);

  return (
    <>
      <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-8">
        {catalog.courses.filter((course) => course.id !== COACH_TALKS_ID).map((course) => {
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
      {talks ? <VaultCoachTalks course={talks} basePath={basePath} /> : null}
    </>
  );
}
