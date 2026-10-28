"use client";

import { useState } from "react";
import { ORBIT_AREA_META, QUARTER_META } from "@/lib/clientCoaching/defaults";
import type {
  CoachingPlanDocument,
  OrbitAreaId,
  QuarterKey,
  YearTargets,
} from "@/lib/clientCoaching/types";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { badgeClass } from "@/components/ui/Badge";

type Props = {
  plan: CoachingPlanDocument;
  saving: boolean;
  saveError: string | null;
  saveOk: boolean;
  onChange: (next: CoachingPlanDocument) => void;
  onSave: () => void;
};

const LABEL = "text-xs font-medium uppercase tracking-wide text-slate-500";

function YearCard({
  title,
  year,
  onChange,
}: {
  title: string;
  year: YearTargets;
  onChange: (next: YearTargets) => void;
}) {
  return (
    <div className={cardClass("plain", "p-4")}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <label className="mt-3 block">
        <span className={LABEL}>Revenue</span>
        <input
          className={fieldClass("input", "normal", "mt-1")}
          value={year.revenue}
          onChange={(e) => onChange({ ...year, revenue: e.target.value })}
          placeholder="e.g. £250k"
        />
      </label>
      <label className="mt-3 block">
        <span className={LABEL}>Profit</span>
        <input
          className={fieldClass("input", "normal", "mt-1")}
          value={year.profit}
          onChange={(e) => onChange({ ...year, profit: e.target.value })}
          placeholder="e.g. £80k"
        />
      </label>
      <label className="mt-3 block">
        <span className={LABEL}>Qualitative</span>
        <textarea
          className={fieldClass("textarea", "normal", "mt-1 min-h-[72px] resize-y")}
          value={year.qualitative}
          onChange={(e) => onChange({ ...year, qualitative: e.target.value })}
          placeholder="What does this year feel like?"
          rows={3}
        />
      </label>
    </div>
  );
}

export function ThreeYearPlanPanel({
  plan,
  saving,
  saveError,
  saveOk,
  onChange,
  onSave,
}: Props) {
  const [yearFilter, setYearFilter] = useState<1 | 2 | 3 | "all">("all");

  function updateOrbit(areaId: OrbitAreaId, patch: { now?: string; target?: string }) {
    onChange({
      ...plan,
      orbit: plan.orbit.map((a) =>
        a.areaId === areaId ? { ...a, ...patch } : a
      ),
    });
  }

  function updateQuarter(
    key: QuarterKey,
    patch: { focus?: string; outcome?: string }
  ) {
    onChange({
      ...plan,
      quarters: plan.quarters.map((q) =>
        q.key === key ? { ...q, ...patch } : q
      ),
    });
  }

  const visibleQuarters = QUARTER_META.filter(
    (q) => yearFilter === "all" || q.year === yearFilter
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-subhead font-semibold tracking-tight text-slate-900">
            3-Year Plan
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            North star, year targets, orbit areas, and a quarter-by-quarter
            spine — one place for onboarding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveOk ? (
            <span className="text-xs font-medium text-emerald-700">Saved</span>
          ) : null}
          {saveError ? (
            <span className="max-w-xs text-xs text-rose-600">{saveError}</span>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={buttonClass("main")}
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/40 p-6 shadow-sm">
        <label className="block">
          <span className={LABEL}>North star</span>
          <textarea
            className={fieldClass("textarea", "normal", "mt-2 min-h-[88px] resize-y")}
            value={plan.northStar}
            onChange={(e) => onChange({ ...plan, northStar: e.target.value })}
            placeholder="In three years, what is unmistakably true about this business and life?"
            rows={3}
          />
        </label>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">Year targets</h3>
        <p className="mt-1 text-sm text-slate-600">
          Quantitative milestones plus a short qualitative line for each year.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <YearCard
            title="Year 1"
            year={plan.years.year1}
            onChange={(year1) =>
              onChange({ ...plan, years: { ...plan.years, year1 } })
            }
          />
          <YearCard
            title="Year 2"
            year={plan.years.year2}
            onChange={(year2) =>
              onChange({ ...plan, years: { ...plan.years, year2 } })
            }
          />
          <YearCard
            title="Year 3"
            year={plan.years.year3}
            onChange={(year3) =>
              onChange({ ...plan, years: { ...plan.years, year3 } })
            }
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">Orbit</h3>
        <p className="mt-1 text-sm text-slate-600">
          Where they are now vs year-3 destination — aligned to Signature
          pillars and lifestyle lenses.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ORBIT_AREA_META.map((meta) => {
            const note =
              plan.orbit.find((a) => a.areaId === meta.id) ?? {
                areaId: meta.id,
                now: "",
                target: "",
              };
            return (
              <div
                key={meta.id}
                className={cardClass("plain", "p-4")}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {meta.label}
                  </h4>
                  <span className="text-kicker font-semibold uppercase text-slate-400">
                    {meta.group}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{meta.hint}</p>
                <label className="mt-3 block">
                  <span className={LABEL}>Now</span>
                  <textarea
                    className={fieldClass("textarea", "normal", "mt-1 min-h-[56px] resize-y")}
                    value={note.now}
                    onChange={(e) =>
                      updateOrbit(meta.id, { now: e.target.value })
                    }
                    rows={2}
                  />
                </label>
                <label className="mt-2 block">
                  <span className={LABEL}>Year 3</span>
                  <textarea
                    className={fieldClass("textarea", "normal", "mt-1 min-h-[56px] resize-y")}
                    value={note.target}
                    onChange={(e) =>
                      updateOrbit(meta.id, { target: e.target.value })
                    }
                    rows={2}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Quarterly spine
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Twelve quarters of expected focus. Mark the current quarter for
              the 90-day tab later.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Current
              <select
                className={fieldClass("select", "small", "w-auto!")}
                value={plan.currentQuarterKey}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    currentQuarterKey: e.target.value as QuarterKey,
                  })
                }
              >
                {QUARTER_META.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              {(["all", 1, 2, 3] as const).map((y) => (
                <button
                  key={String(y)}
                  type="button"
                  onClick={() => setYearFilter(y)}
                  className={`rounded-md px-2.5 py-1.5 ${
                    yearFilter === y
                      ? "bg-sky-600 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {y === "all" ? "All" : `Y${y}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleQuarters.map((meta) => {
            const item =
              plan.quarters.find((q) => q.key === meta.key) ?? {
                key: meta.key,
                focus: "",
                outcome: "",
              };
            const isCurrent = plan.currentQuarterKey === meta.key;
            return (
              <div
                key={meta.key}
                className={`rounded-xl border p-3 shadow-sm ${
                  isCurrent
                    ? "border-sky-400 bg-sky-50/60 ring-1 ring-sky-200"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {meta.label}
                  </p>
                  {isCurrent ? (
                    <span className={badgeClass("blue")}>
                      Now
                    </span>
                  ) : null}
                </div>
                <label className="mt-2 block">
                  <span className={LABEL}>Focus</span>
                  <textarea
                    className={fieldClass("textarea", "normal", "mt-1 min-h-[52px] resize-y")}
                    value={item.focus}
                    onChange={(e) =>
                      updateQuarter(meta.key, { focus: e.target.value })
                    }
                    rows={2}
                  />
                </label>
                <label className="mt-2 block">
                  <span className={LABEL}>Outcome</span>
                  <input
                    className={fieldClass("input", "normal", "mt-1")}
                    value={item.outcome}
                    onChange={(e) =>
                      updateQuarter(meta.key, { outcome: e.target.value })
                    }
                    placeholder="Metric or result"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
