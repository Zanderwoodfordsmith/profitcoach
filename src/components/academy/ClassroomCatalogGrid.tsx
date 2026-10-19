import { ClassroomCourseOverviewCard } from "@/components/academy/ClassroomCourseOverviewCard";
import { ClassroomSystemBanner } from "@/components/academy/ClassroomSystemBanner";
import {
  firstLessonInCourse,
  flattenSections,
} from "@/lib/academy/hubCatalog";
import {
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
  loadClassroomHub,
  classroomCoursesByIds,
} from "@/lib/academy/classroomHubLoad";
import type { HubCourse } from "@/lib/academy/hubCatalog";

type Props = {
  basePath: string;
};

const COURSE_COVERS: Record<
  string,
  { coverImageUrl: string; eyebrow: string; eyebrowClassName: string; accentClassName: string }
> = {
  "start-here": {
    coverImageUrl: "/academy/classroom/start-here.jpg",
    eyebrow: "Onboarding",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
  },
  "coach-action-plan": {
    coverImageUrl: "/academy/classroom/coach-action-plan.jpg",
    eyebrow: "Strategy",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#134e7d] via-[#1b74ad] to-[#37a3d8]",
  },
  "going-pro": {
    coverImageUrl: "/academy/classroom/going-pro.jpg",
    eyebrow: "Foundations",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#1d5f8a] via-[#2b86b8] to-[#54b2dd]",
  },
  "get-calls": {
    coverImageUrl: "/academy/classroom/get-calls.jpg",
    eyebrow: "Marketing",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0b4f8a] via-[#1166aa] to-[#2d9ce1]",
  },
  "win-clients": {
    coverImageUrl: "/academy/classroom/win-clients.jpg",
    eyebrow: "Sales",
    eyebrowClassName: "text-[#42a1ee]",
    accentClassName: "bg-gradient-to-br from-[#5b3df5] via-[#7b54ff] to-[#b17aff]",
  },
  "coach-clients": {
    coverImageUrl: "/academy/classroom/coach-clients.jpg",
    eyebrow: "Delivery",
    eyebrowClassName: "text-[#1ca0c2]",
    accentClassName: "bg-gradient-to-br from-[#0e7f9c] via-[#1ca0c2] to-[#4ec0db]",
  },
};

export async function ClassroomCatalogGrid({ basePath }: Props) {
  const catalog = loadClassroomHub();
  const startCourses = classroomCoursesByIds(catalog, CLASSROOM_START_COURSE_IDS);
  const pathCourses = classroomCoursesByIds(catalog, CLASSROOM_PATH_COURSE_IDS);

  return (
    <div className="mx-auto w-[80%] max-w-6xl pt-5">
      {/* One grid so cards flow 2-up (three rows of two) below xl instead of
          each row of three wrapping on its own. At xl it is still start
          courses on top, paths below, with the wider gap between them. */}
      <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-8">
        {[...startCourses, ...pathCourses].map((course) => (
          <CourseCard key={course.id} course={course} basePath={basePath} />
        ))}
      </div>
      <ClassroomSystemBanner href={`${basePath}/system`} />
    </div>
  );
}

function CourseCard({
  course,
  basePath,
}: {
  course: HubCourse;
  basePath: string;
}) {
  const meta = COURSE_COVERS[course.id] ?? {
    coverImageUrl: undefined,
    eyebrow: "Programme",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
  };

  // Link straight to the first lesson so the catalog click skips the
  // /[courseId] → /[courseId]/[lessonId] redirect hop.
  const first = firstLessonInCourse(course);
  const href = first
    ? `${basePath}/${encodeURIComponent(course.id)}/${encodeURIComponent(first.id)}`
    : `${basePath}/${encodeURIComponent(course.id)}`;

  return (
    <ClassroomCourseOverviewCard
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
}
