import Link from "next/link";

import {
  CURRICULUM_COURSES,
  CURRICULUM_DECISION_LABELS,
  CURRICULUM_RULES,
  LESSON_OPENING_STANDARD,
  classroomLessonHref,
  type CurriculumDecision,
  type CurriculumLessonRow,
} from "@/lib/academy/curriculumDecisions";

const DECISION_STYLES: Record<CurriculumDecision, string> = {
  rename: "bg-sky-50 text-sky-800 ring-sky-200",
  keep: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  fill: "bg-amber-50 text-amber-900 ring-amber-200",
  fold: "bg-violet-50 text-violet-800 ring-violet-200",
  gap: "bg-orange-50 text-orange-900 ring-orange-200",
  later: "bg-slate-100 text-slate-600 ring-slate-200",
  skip: "bg-rose-50 text-rose-800 ring-rose-200",
  reference: "bg-slate-50 text-slate-600 ring-slate-200",
};

function DecisionBadge({ decision }: { decision: CurriculumDecision }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${DECISION_STYLES[decision]}`}
    >
      {CURRICULUM_DECISION_LABELS[decision]}
    </span>
  );
}

function LessonRow({ row }: { row: CurriculumLessonRow }) {
  const href =
    row.courseId && row.lessonId
      ? classroomLessonHref(row.courseId, row.lessonId)
      : null;

  return (
    <li className="grid gap-2 border-t border-slate-200/80 py-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] sm:gap-4 sm:py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
            {row.outcomeTitle}
          </p>
          <DecisionBadge decision={row.decision} />
        </div>
        {row.currentTitle ? (
          href ? (
            <Link
              href={href}
              className="mt-1 inline-block text-sm text-sky-800 underline-offset-2 hover:underline"
            >
              Now: {row.currentTitle}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Now: {row.currentTitle}</p>
          )
        ) : (
          <p className="mt-1 text-sm text-slate-400">No current lesson</p>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-600">{row.note}</p>
    </li>
  );
}

export function CurriculumDecisionsView() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <section className="rounded-[28px] border border-white/90 bg-white/75 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.09)] ring-1 ring-inset ring-white/70 sm:p-7">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
          Rules
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {CURRICULUM_RULES.map((rule, index) => (
            <li key={rule.title} className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">
                <span className="mr-2 text-slate-400">{index + 1}.</span>
                {rule.title}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{rule.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-slate-950">
            {LESSON_OPENING_STANDARD.title}
          </p>
          <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
            {LESSON_OPENING_STANDARD.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>

      {CURRICULUM_COURSES.map((course) => (
        <section
          key={course.id}
          id={course.id}
          className="scroll-mt-28 overflow-hidden rounded-[28px] border border-white/90 bg-white/75 shadow-[0_16px_45px_rgba(15,23,42,0.09)] ring-1 ring-inset ring-white/70"
        >
          <div className="border-b border-slate-200/80 px-6 py-5 sm:px-7">
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950">
              {course.title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              {course.purpose}
            </p>
          </div>

          <div className="divide-y divide-slate-200/80">
            {course.milestones.map((milestone) => (
              <div key={milestone.id} className="px-6 py-5 sm:px-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                  Milestone
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  {milestone.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {milestone.purpose}
                </p>
                <ul className="mt-4">
                  {milestone.lessons.map((row) => (
                    <LessonRow
                      key={`${milestone.id}-${row.outcomeTitle}`}
                      row={row}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
