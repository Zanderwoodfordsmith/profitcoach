import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { WeeklyFocusContent } from "@/components/academy/WeeklyFocusContent";
import {
  getCurrentWeeklyFocus,
  getPastWeeklyFocuses,
  loadWeeklyFocusCatalog,
  weeklyFocusHref,
  type WeeklyFocusWeek,
} from "@/lib/academy/weeklyFocus";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

type Props = {
  basePath: string;
  weekId?: string;
};

export function WeeklyFocusView({ basePath, weekId }: Props) {
  const catalog = loadWeeklyFocusCatalog();
  const current = getCurrentWeeklyFocus(catalog);
  const selected =
    (weekId
      ? catalog.weeks.find((week) => week.id === weekId)
      : null) ?? current;
  const isCurrent = selected.id === current.id;
  const past = getPastWeeklyFocuses(catalog, current.id);
  const relatedPathHref = `${basePath}/${encodeURIComponent(selected.pathId)}`;

  return (
    <div className="mx-auto flex w-[80%] max-w-3xl flex-col gap-8">
      <div>
        <Link
          href={basePath}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-[#0c5290]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Classroom
        </Link>
      </div>

      <article className="overflow-hidden rounded-xl border border-white/80 bg-white/45 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-inset ring-white/55">
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalog.coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="p-6 md:p-8">
          <p className="text-kicker font-semibold uppercase text-amber-700">
            {isCurrent ? "This Week’s Focus" : "Past Focus"}
          </p>
          <p className="mt-3 text-kicker font-semibold uppercase text-slate-500">
            {selected.pathLabel}
            {!isCurrent ? ` · Week ${selected.weekOfYear}` : null}
          </p>
          <h1 className="mt-2 text-heading font-semibold tracking-tight text-slate-900">
            {selected.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {selected.description}
          </p>

          <div className={cardClass("plain", "mt-6 p-5")}>
            <p className="text-kicker font-semibold uppercase text-slate-500">
              This week’s action
            </p>
            <p className="mt-2 text-base font-medium leading-relaxed text-slate-900">
              {selected.action}
            </p>
          </div>

          {/* Audio and lesson text load for a signed-in member, not with the page. */}
          <WeeklyFocusContent weekId={selected.id} />

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={relatedPathHref}
              className={buttonClass("main")}
            >
              Open {selected.pathLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {!isCurrent ? (
              <Link
                href={weeklyFocusHref(basePath)}
                className={buttonClass("second")}
              >
                Back to this week
              </Link>
            ) : null}
          </div>
        </div>
      </article>

      {past.length > 0 ? (
        <section className="rounded-xl border border-white/80 bg-white/35 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl ring-1 ring-inset ring-white/50">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Past weeks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Go back anytime. No streak guilt — just useful reps when you need them.
          </p>
          <ul className="mt-5 divide-y divide-slate-200/80">
            {past.map((week) => (
              <ArchiveRow
                key={week.id}
                week={week}
                href={weeklyFocusHref(basePath, week.id)}
                active={week.id === selected.id}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ArchiveRow({
  week,
  href,
  active,
}: {
  week: WeeklyFocusWeek;
  href: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-start justify-between gap-4 py-4 transition ${
          active ? "opacity-100" : "hover:opacity-90"
        }`}
      >
        <div className="min-w-0">
          <p className="text-kicker font-semibold uppercase text-slate-500">
            Week {week.weekOfYear} · {week.pathLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{week.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{week.action}</p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#0c5290]">
          Open
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </li>
  );
}
