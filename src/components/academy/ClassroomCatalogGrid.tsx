import { ClassroomCourseOverviewCard } from "@/components/academy/ClassroomCourseOverviewCard";
import {
  findHubCourse,
  firstLessonInCourse,
  flattenSections,
  hubLessonCount,
} from "@/lib/academy/hubCatalog";
import {
  CLASSROOM_OS_COURSE_ID,
  CLASSROOM_PATH_COURSE_IDS,
  CLASSROOM_START_COURSE_IDS,
  loadClassroomHub,
  classroomCoursesByIds,
} from "@/lib/academy/classroomHubLoad";
import type { HubCourse } from "@/lib/academy/hubCatalog";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

type Props = {
  basePath: string;
};

const COURSE_COVERS: Record<
  string,
  { coverImageUrl: string; eyebrow: string; eyebrowClassName: string; accentClassName: string }
> = {
  kickstart: {
    coverImageUrl: "/academy/classroom/start-here.jpg",
    eyebrow: "Onboarding",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
  },
  "coach-action-plan": {
    coverImageUrl: "/academy/classroom/continue-training.jpg",
    eyebrow: "Strategy",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#134e7d] via-[#1b74ad] to-[#37a3d8]",
  },
  "going-pro": {
    coverImageUrl: "/academy/classroom/weekly-focus.jpg",
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
  "profit-coach-system": {
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

  const osCourse = findHubCourse(catalog, CLASSROOM_OS_COURSE_ID);
  const osLesson = osCourse ? firstLessonInCourse(osCourse) : null;
  const osHref = osLesson
    ? `${basePath}/${encodeURIComponent(osCourse!.id)}/${encodeURIComponent(osLesson.id)}`
    : basePath;

  return (
    <div className="mx-auto flex w-[80%] max-w-6xl flex-col gap-8">
      <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {startCourses.map((course) => (
          <CourseCard key={course.id} course={course} basePath={basePath} />
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {pathCourses.map((course) => (
          <CourseCard key={course.id} course={course} basePath={basePath} />
        ))}
      </div>
      {osCourse ? (
        <BottomFeatureBanner
          href={osHref}
          eyebrow="Profit Coach OS"
          title={osCourse.title}
          description={osCourse.description ?? ""}
          meta={`${hubLessonCount(osCourse)} lessons`}
        />
      ) : null}
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

function BottomFeatureBanner({
  href,
  eyebrow,
  title,
  description,
  meta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border border-white/25 bg-[#0c5290]/72 px-6 py-6 text-white shadow-[0_12px_40px_rgba(12,82,144,0.22)] backdrop-blur-xl ring-1 ring-inset ring-white/15 transition hover:bg-[#0c5290]/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/65">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 ring-1 ring-white/10">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {meta}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-slate-100">
          Explore
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
