import { SimplifiedCardCta } from "@/components/academy/SimplifiedCardCta";
import { SimplifiedContinueTrainingCard } from "@/components/academy/SimplifiedContinueTrainingCard";
import { SimplifiedCourseOverviewCard } from "@/components/academy/SimplifiedCourseOverviewCard";
import {
  findLegacyCourse,
  firstLessonInCourse,
  flattenSections,
  legacyLessonCount,
} from "@/lib/academy/legacyHubCatalog";
import {
  SIMPLIFIED_OS_COURSE_ID,
  loadSimplifiedHub,
  simplifiedCatalogCourses,
} from "@/lib/academy/simplifiedHubLoad";
import {
  loadWeeklyFocusCatalog,
  weeklyFocusHref,
} from "@/lib/academy/weeklyFocus";
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
    coverImageUrl: "/academy/simplified/start-here.jpg",
    eyebrow: "Onboarding",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
  },
  "get-calls": {
    coverImageUrl: "/academy/simplified/get-calls.jpg",
    eyebrow: "Marketing",
    eyebrowClassName: "text-[#0c5290]",
    accentClassName: "bg-gradient-to-br from-[#0b4f8a] via-[#1166aa] to-[#2d9ce1]",
  },
  "win-clients": {
    coverImageUrl: "/academy/simplified/win-clients.jpg",
    eyebrow: "Sales",
    eyebrowClassName: "text-[#42a1ee]",
    accentClassName: "bg-gradient-to-br from-[#5b3df5] via-[#7b54ff] to-[#b17aff]",
  },
  "profit-coach-system": {
    coverImageUrl: "/academy/simplified/coach-clients.jpg",
    eyebrow: "Delivery",
    eyebrowClassName: "text-[#1ca0c2]",
    accentClassName: "bg-gradient-to-br from-[#0e7f9c] via-[#1ca0c2] to-[#4ec0db]",
  },
};

export async function SimplifiedAcademyCatalogGrid({ basePath }: Props) {
  const catalog = loadSimplifiedHub();
  const courses = simplifiedCatalogCourses(catalog);
  const weeklyCatalog = loadWeeklyFocusCatalog();

  const startCourse = findLegacyCourse(catalog, catalog.startHere.courseId);
  const startLesson = startCourse ? firstLessonInCourse(startCourse) : null;
  const startHref = startLesson
    ? `${basePath}/${encodeURIComponent(catalog.startHere.courseId)}/${encodeURIComponent(startLesson.id)}`
    : basePath;
  const startMeta = COURSE_COVERS[catalog.startHere.courseId] ?? COURSE_COVERS.kickstart;
  const osCourse = findLegacyCourse(catalog, SIMPLIFIED_OS_COURSE_ID);
  const osLesson = osCourse ? firstLessonInCourse(osCourse) : null;
  const osHref = osLesson
    ? `${basePath}/${encodeURIComponent(osCourse!.id)}/${encodeURIComponent(osLesson.id)}`
    : basePath;
  const continueCourses = courses.map((course) => ({
    id: course.id,
    title: course.title,
    lessons: flattenSections(course.sections).flatMap((section) =>
      section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
      })),
    ),
  }));

  return (
    <div className="mx-auto flex w-[80%] max-w-6xl flex-col gap-8">
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <SimplifiedCourseOverviewCard
          href={startHref}
          courseId={catalog.startHere.courseId}
          eyebrow={catalog.startHere.eyebrow || startMeta.eyebrow}
          eyebrowClassName={startMeta.eyebrowClassName}
          title={catalog.startHere.title}
          description={catalog.startHere.description}
          accentClassName={startMeta.accentClassName}
          coverImageUrl={startMeta.coverImageUrl}
          lessons={flattenSections(startCourse?.sections ?? []).flatMap((section) =>
            section.lessons.map((lesson) => ({
              id: lesson.id,
            })),
          )}
        />
        <SimplifiedContinueTrainingCard basePath={basePath} courses={continueCourses} />
        <WeeklyFocusCard
          href={weeklyFocusHref(basePath)}
          coverImageUrl={weeklyCatalog.coverImageUrl}
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => {
          const meta = COURSE_COVERS[course.id] ?? {
            coverImageUrl: undefined,
            eyebrow: "Programme",
            eyebrowClassName: "text-[#0c5290]",
            accentClassName: "bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8]",
          };

          return (
            <SimplifiedCourseOverviewCard
              key={course.id}
              href={`${basePath}/${course.id}`}
              courseId={course.id}
              eyebrow={meta.eyebrow}
              eyebrowClassName={meta.eyebrowClassName}
              title={course.title}
              description={course.description ?? ""}
              accentClassName={meta.accentClassName}
              coverImageUrl={meta.coverImageUrl}
              lessons={flattenSections(course.sections).flatMap((section) =>
                section.lessons.map((lesson) => ({
                  id: lesson.id,
                })),
              )}
            />
          );
        })}
      </div>
      {osCourse ? (
        <BottomFeatureBanner
          href={osHref}
          eyebrow="Profit Coach OS"
          title={osCourse.title}
          description={osCourse.description ?? ""}
          meta={`${legacyLessonCount(osCourse)} lessons`}
        />
      ) : null}
    </div>
  );
}

function WeeklyFocusCard({
  href,
  coverImageUrl,
}: {
  href: string;
  coverImageUrl: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.22),0_8px_18px_rgba(15,23,42,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-700">
          Practice
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
          This Week&apos;s Focus
        </h2>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-600">
          One short task to build your coaching business this week.
        </p>
        <div className="mt-auto pt-4">
          <SimplifiedCardCta>This Week&apos;s Action</SimplifiedCardCta>
        </div>
      </div>
    </Link>
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
