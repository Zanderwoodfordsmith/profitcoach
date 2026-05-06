"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSignatureMatrixColumns, type SignatureScore } from "@/lib/signatureModelV2";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { OutlinedSelect } from "@/components/settings/OutlinedFormField";
import { supabaseClient } from "@/lib/supabaseClient";

type MatrixCoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  joined_at: string | null;
  current_monthly_income: number | null;
  ideal_monthly_income: number | null;
  updated_at: string | null;
  scores: Record<string, SignatureScore>;
};

type ScoreFilter = "all" | "scored";
type SortBy = "default" | "most_red" | "lowest_avg";

const SCORE_CELL_STYLE: Record<Exclude<SignatureScore, null>, string> = {
  red: "bg-rose-500 text-white",
  yellow: "bg-amber-400 text-amber-950",
  green: "bg-emerald-500 text-white",
};

const SCORE_LABEL: Record<Exclude<SignatureScore, null>, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
};

function getScoreCellClasses(score: SignatureScore): string {
  if (!score) {
    return "bg-slate-200";
  }
  return SCORE_CELL_STYLE[score];
}

function getScoreText(score: SignatureScore): string {
  if (!score) return "";
  return "";
}

function getScoreLabel(score: SignatureScore): string {
  if (!score) return "Not scored";
  return SCORE_LABEL[score];
}

function scoreToNumber(score: SignatureScore): number | null {
  if (score === "red") return 0;
  if (score === "yellow") return 1;
  if (score === "green") return 2;
  return null;
}

function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(value: string): string {
  const dt = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(dt);
}

const PILLAR_DIVIDER = "border-l border-slate-300";
const MODULE_COUNT_MAX = 12;
const ROW_MAX_SCORE = MODULE_COUNT_MAX * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function opacityFromFixedMax(value: number, maxValue: number): number {
  const ratio = maxValue > 0 ? clamp(value / maxValue, 0, 1) : 0;
  return 0.1 + ratio * 0.65;
}

function opacityFromRowScale(value: number, values: number[]): number {
  if (values.length === 0) return 0.1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return value > 0 ? 0.425 : 0.1;
  }
  const ratio = (value - min) / (max - min);
  return 0.1 + ratio * 0.65;
}

function tintStyle(rgb: string, opacity: number): { backgroundColor: string } {
  return { backgroundColor: `rgba(${rgb}, ${opacity.toFixed(3)})` };
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function isPillarStart(
  cols: Array<{ pillarTitle: string }>,
  index: number
): boolean {
  if (index <= 0) return false;
  return cols[index].pillarTitle !== cols[index - 1].pillarTitle;
}

export default function AdminClientSuccessPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MatrixCoachRow[]>([]);
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("scored");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => getSignatureMatrixColumns(), []);
  const groupedColumns = useMemo(() => {
    const groups: Array<{ title: string; count: number }> = [];
    for (const col of columns) {
      const last = groups[groups.length - 1];
      if (last && last.title === col.pillarTitle) {
        last.count += 1;
      } else {
        groups.push({ title: col.pillarTitle, count: 1 });
      }
    }
    return groups;
  }, [columns]);

  const rowMetricsByCoachId = useMemo(() => {
    const metrics = new Map<
      string,
      {
        redCount: number;
        yellowCount: number;
        greenCount: number;
        scoredCount: number;
        totalPoints: number;
        average: number | null;
      }
    >();
    for (const coach of rows) {
      let redCount = 0;
      let yellowCount = 0;
      let greenCount = 0;
      let scoredCount = 0;
      let sum = 0;
      for (const column of columns) {
        const numeric = scoreToNumber(
          (coach.scores?.[column.moduleId] ?? null) as SignatureScore
        );
        if (numeric === null) continue;
        scoredCount += 1;
        sum += numeric;
        if (numeric === 0) redCount += 1;
        else if (numeric === 1) yellowCount += 1;
        else greenCount += 1;
      }
      metrics.set(coach.id, {
        redCount,
        yellowCount,
        greenCount,
        scoredCount,
        totalPoints: sum,
        average: scoredCount > 0 ? sum / scoredCount : null,
      });
    }
    return metrics;
  }, [rows, columns]);

  const filteredRows = useMemo(() => {
    const baseRows =
      scoreFilter === "all"
        ? rows
        : rows.filter((coach) => (rowMetricsByCoachId.get(coach.id)?.scoredCount ?? 0) > 0);

    if (sortBy === "default") return baseRows;

    const sorted = [...baseRows];
    sorted.sort((a, b) => {
      const aMetrics = rowMetricsByCoachId.get(a.id);
      const bMetrics = rowMetricsByCoachId.get(b.id);

      if (sortBy === "most_red") {
        const redDiff = (bMetrics?.redCount ?? 0) - (aMetrics?.redCount ?? 0);
        if (redDiff !== 0) return redDiff;
        const avgA = aMetrics?.average ?? Number.POSITIVE_INFINITY;
        const avgB = bMetrics?.average ?? Number.POSITIVE_INFINITY;
        return avgA - avgB;
      }

      const avgA = aMetrics?.average ?? Number.POSITIVE_INFINITY;
      const avgB = bMetrics?.average ?? Number.POSITIVE_INFINITY;
      if (avgA !== avgB) return avgA - avgB;
      return (bMetrics?.redCount ?? 0) - (aMetrics?.redCount ?? 0);
    });
    return sorted;
  }, [rows, scoreFilter, sortBy, rowMetricsByCoachId]);

  const columnMetrics = useMemo(() => {
    return columns.map((column) => {
      let red = 0;
      let yellow = 0;
      let green = 0;
      let scoredCount = 0;
      let sum = 0;
      for (const coach of filteredRows) {
        const numeric = scoreToNumber(
          (coach.scores?.[column.moduleId] ?? null) as SignatureScore
        );
        if (numeric === null) continue;
        scoredCount += 1;
        sum += numeric;
        if (numeric === 0) red += 1;
        else if (numeric === 1) yellow += 1;
        else green += 1;
      }
      return {
        red,
        yellow,
        green,
        scoredCount,
        totalPoints: sum,
        average: scoredCount > 0 ? sum / scoredCount : null,
      };
    });
  }, [columns, filteredRows]);

  const overallCellTotals = useMemo(() => {
    return columnMetrics.reduce(
      (acc, metric) => {
        acc.red += metric.red;
        acc.yellow += metric.yellow;
        acc.green += metric.green;
        return acc;
      },
      { red: 0, yellow: 0, green: 0 }
    );
  }, [columnMetrics]);

  const redColumnValues = useMemo(() => columnMetrics.map((metric) => metric.red), [columnMetrics]);
  const yellowColumnValues = useMemo(
    () => columnMetrics.map((metric) => metric.yellow),
    [columnMetrics]
  );
  const greenColumnValues = useMemo(
    () => columnMetrics.map((metric) => metric.green),
    [columnMetrics]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setCheckingRole(true);
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        if (!cancelled) {
          setError("Unable to load your profile.");
          setCheckingRole(false);
          setLoading(false);
        }
        return;
      }

      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      setCheckingRole(false);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("Unable to load client success matrix.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch("/api/admin/coach-signature-matrix", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as {
        coaches?: MatrixCoachRow[];
        error?: string;
      };

      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Unable to load client success matrix.");
        setLoading(false);
        return;
      }

      setRows(body.coaches ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!checkingRole && !loading && !error && rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No coaches found yet, so there is no client success matrix to display.
        </p>
      ) : null}

      {!checkingRole && !error ? (
        <div className="flex flex-wrap items-end gap-3">
          <OutlinedSelect
            id="client-success-score-filter"
            label="Compass scoring"
            value={scoreFilter}
            onChange={(event) => setScoreFilter(event.target.value as ScoreFilter)}
            wrapperClassName="w-full max-w-xs"
          >
            <option value="all">All coaches</option>
            <option value="scored">Scored compass only</option>
          </OutlinedSelect>
          <OutlinedSelect
            id="client-success-sort"
            label="Sort coaches"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            wrapperClassName="w-full max-w-xs"
          >
            <option value="default">Default (slug)</option>
            <option value="most_red">Most reds first</option>
            <option value="lowest_avg">Lowest average first</option>
          </OutlinedSelect>
          {!loading ? (
            <p className="pb-2 text-sm text-slate-600">
              Showing {filteredRows.length} of {rows.length} coaches
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="inline-block rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <table className="border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-4 py-2"
              >
                Coach
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 px-3 py-2 text-left"
              >
                Joined
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 px-3 py-2 text-right"
              >
                <span className="normal-case tracking-normal">
                  Current
                  <br />
                  income
                </span>
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 px-3 py-2 text-right"
              >
                <span className="normal-case tracking-normal">
                  Ideal
                  <br />
                  income
                </span>
              </th>
              {groupedColumns.map((group, groupIndex) => (
                <th
                  key={group.title}
                  colSpan={group.count}
                  className={`border-b border-slate-200 px-2 py-2 text-center ${
                    groupIndex > 0 ? PILLAR_DIVIDER : ""
                  }`}
                >
                  {group.title}
                </th>
              ))}
              <th
                colSpan={4}
                className="border-b border-l border-slate-200 px-3 py-2 text-center"
              >
                Coach totals
              </th>
            </tr>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column, colIndex) => (
                <th
                  key={column.moduleId}
                  className={`min-w-[3.25rem] border-b border-slate-200 px-2 py-2 text-center ${
                    isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                  }`}
                  title={`${column.code} - ${column.displayTitle}`}
                >
                  <span className="normal-case tracking-normal">
                    {(() => {
                      const words = column.displayTitle.trim().split(/\s+/);
                      if (words.length <= 1) return column.displayTitle;
                      return (
                        <>
                          {words[0]}
                          <br />
                          {words.slice(1).join(" ")}
                        </>
                      );
                    })()}
                  </span>
                </th>
              ))}
              <th className="border-b border-l border-slate-200 px-2 py-2 text-center">R</th>
              <th className="border-b border-slate-200 px-2 py-2 text-center">Y</th>
              <th className="border-b border-slate-200 px-2 py-2 text-center">G</th>
              <th className="border-b border-slate-200 px-2 py-2 text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((coach) => (
              <tr key={coach.id} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 whitespace-nowrap border-r border-t border-slate-100 bg-white px-4 py-2 align-top">
                  <p className="font-medium text-slate-900">{coach.full_name ?? "—"}</p>
                </td>
                <td className="whitespace-nowrap border-r border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
                  {coach.joined_at ? formatShortDate(coach.joined_at) : "—"}
                </td>
                <td className="whitespace-nowrap border-r border-t border-slate-100 px-3 py-2 text-right text-xs font-medium text-slate-800">
                  {coach.current_monthly_income == null
                    ? "—"
                    : formatGbp(coach.current_monthly_income)}
                </td>
                <td className="whitespace-nowrap border-r border-t border-slate-100 px-3 py-2 text-right text-xs font-medium text-slate-800">
                  {coach.ideal_monthly_income == null
                    ? "—"
                    : formatGbp(coach.ideal_monthly_income)}
                </td>
                {columns.map((column, colIndex) => {
                  const score = (coach.scores?.[column.moduleId] ?? null) as SignatureScore;
                  const label = getScoreLabel(score);
                  return (
                    <td
                      key={`${coach.id}-${column.moduleId}`}
                      className={`border-t border-slate-100 px-2 py-1.5 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                    >
                      <div
                        title={`${column.code} - ${column.displayTitle}: ${label}`}
                        aria-label={`${column.code} - ${column.displayTitle}: ${label}`}
                        className={`mx-auto flex h-4 w-4 items-center justify-center rounded-sm ${getScoreCellClasses(
                          score
                        )}`}
                      >
                        {getScoreText(score)}
                      </div>
                    </td>
                  );
                })}
                <td
                  className="border-l border-t border-slate-100 px-2 py-2 text-center text-xs font-semibold text-rose-700"
                  style={tintStyle(
                    "254, 202, 202",
                    opacityFromFixedMax(
                      rowMetricsByCoachId.get(coach.id)?.redCount ?? 0,
                      MODULE_COUNT_MAX
                    )
                  )}
                >
                  {rowMetricsByCoachId.get(coach.id)?.redCount ?? 0}
                </td>
                <td
                  className="border-t border-slate-100 px-2 py-2 text-center text-xs font-semibold text-amber-700"
                  style={tintStyle(
                    "254, 240, 138",
                    opacityFromFixedMax(
                      rowMetricsByCoachId.get(coach.id)?.yellowCount ?? 0,
                      MODULE_COUNT_MAX
                    )
                  )}
                >
                  {rowMetricsByCoachId.get(coach.id)?.yellowCount ?? 0}
                </td>
                <td
                  className="border-t border-slate-100 px-2 py-2 text-center text-xs font-semibold text-emerald-700"
                  style={tintStyle(
                    "187, 247, 208",
                    opacityFromFixedMax(
                      rowMetricsByCoachId.get(coach.id)?.greenCount ?? 0,
                      MODULE_COUNT_MAX
                    )
                  )}
                >
                  {rowMetricsByCoachId.get(coach.id)?.greenCount ?? 0}
                </td>
                <td className="border-t border-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                  {formatPercent(
                    ((rowMetricsByCoachId.get(coach.id)?.totalPoints ?? 0) / ROW_MAX_SCORE) * 100
                  )}
                </td>
              </tr>
            ))}
            {!loading && filteredRows.length > 0 ? (
              <tr className="bg-slate-50/70">
                <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-xs font-semibold text-slate-700">
                  R
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                {columns.map((column, colIndex) => {
                  const metric = columnMetrics[colIndex];
                  return (
                    <td
                      key={`totals-${column.moduleId}`}
                      className={`border-t border-slate-200 px-2 py-2 text-center text-[11px] text-slate-700 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                      style={tintStyle(
                        "254, 202, 202",
                        opacityFromRowScale(metric.red, redColumnValues)
                      )}
                    >
                      <span className="font-semibold text-rose-600">{metric.red}</span>
                    </td>
                  );
                })}
                <td
                  className="border-l border-t border-slate-200 px-2 py-2 text-center text-xs font-semibold text-rose-700"
                  style={tintStyle(
                    "254, 202, 202",
                    opacityFromFixedMax(overallCellTotals.red, filteredRows.length * MODULE_COUNT_MAX)
                  )}
                >
                  {overallCellTotals.red}
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
              </tr>
            ) : null}
            {!loading && filteredRows.length > 0 ? (
              <tr className="bg-slate-50/70">
                <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-xs font-semibold text-slate-700">
                  Y
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                {columns.map((column, colIndex) => {
                  const metric = columnMetrics[colIndex];
                  return (
                    <td
                      key={`totals-yellow-${column.moduleId}`}
                      className={`border-t border-slate-200 px-2 py-2 text-center text-[11px] text-slate-700 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                      style={tintStyle(
                        "254, 240, 138",
                        opacityFromRowScale(metric.yellow, yellowColumnValues)
                      )}
                    >
                      <span className="font-semibold text-amber-700">{metric.yellow}</span>
                    </td>
                  );
                })}
                <td className="border-l border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td
                  className="border-t border-slate-200 px-2 py-2 text-center text-xs font-semibold text-amber-700"
                  style={tintStyle(
                    "254, 240, 138",
                    opacityFromFixedMax(
                      overallCellTotals.yellow,
                      filteredRows.length * MODULE_COUNT_MAX
                    )
                  )}
                >
                  {overallCellTotals.yellow}
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
              </tr>
            ) : null}
            {!loading && filteredRows.length > 0 ? (
              <tr className="bg-slate-50/70">
                <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-xs font-semibold text-slate-700">
                  G
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                {columns.map((column, colIndex) => {
                  const metric = columnMetrics[colIndex];
                  return (
                    <td
                      key={`totals-green-${column.moduleId}`}
                      className={`border-t border-slate-200 px-2 py-2 text-center text-[11px] text-slate-700 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                      style={tintStyle(
                        "187, 247, 208",
                        opacityFromRowScale(metric.green, greenColumnValues)
                      )}
                    >
                      <span className="font-semibold text-emerald-700">{metric.green}</span>
                    </td>
                  );
                })}
                <td className="border-l border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td
                  className="border-t border-slate-200 px-2 py-2 text-center text-xs font-semibold text-emerald-700"
                  style={tintStyle(
                    "187, 247, 208",
                    opacityFromFixedMax(
                      overallCellTotals.green,
                      filteredRows.length * MODULE_COUNT_MAX
                    )
                  )}
                >
                  {overallCellTotals.green}
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
              </tr>
            ) : null}
            {!loading && filteredRows.length > 0 ? (
              <tr className="bg-slate-50/70">
                <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-xs font-semibold text-slate-700">
                  %
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                <td className="border-r border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  —
                </td>
                {columns.map((column, colIndex) => {
                  const metric = columnMetrics[colIndex];
                  const pct =
                    metric.scoredCount > 0
                      ? (metric.totalPoints / (metric.scoredCount * 2)) * 100
                      : null;
                  return (
                    <td
                      key={`totals-pct-${column.moduleId}`}
                      className={`border-t border-slate-200 px-2 py-2 text-center text-[11px] font-semibold text-slate-700 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                    >
                      {formatPercent(pct)}
                    </td>
                  );
                })}
                <td className="border-l border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
                  —
                </td>
                <td className="border-t border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                  {formatPercent(
                    (() => {
                      const totalPoints = columnMetrics.reduce(
                        (acc, metric) => acc + metric.totalPoints,
                        0
                      );
                      const totalPossible = columnMetrics.reduce(
                        (acc, metric) => acc + metric.scoredCount * 2,
                        0
                      );
                      if (totalPossible <= 0) return null;
                      return (totalPoints / totalPossible) * 100;
                    })()
                  )}
                </td>
              </tr>
            ) : null}
            {!loading && filteredRows.length === 0 && rows.length > 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 8}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  No coaches match the selected filter.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + 8}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  Loading client success matrix…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>
      {!loading && !error && filteredRows.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Module comparison graph</p>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-rose-500" />
                Red
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-amber-400" />
                Yellow
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                Green
              </span>
            </div>
          </div>
          <div className="mx-auto w-full max-w-4xl space-y-2">
            {columns.map((column, colIndex) => {
              const metric = columnMetrics[colIndex];
              const pct =
                metric.scoredCount > 0
                  ? Math.round((metric.totalPoints / (metric.scoredCount * 2)) * 100)
                  : 0;
              const redPct =
                metric.scoredCount > 0 ? (metric.red / metric.scoredCount) * 100 : 0;
              const yellowPct =
                metric.scoredCount > 0 ? (metric.yellow / metric.scoredCount) * 100 : 0;
              const greenPct =
                metric.scoredCount > 0 ? (metric.green / metric.scoredCount) * 100 : 0;
              return (
                <div
                  key={`module-progress-${column.moduleId}`}
                  className="grid grid-cols-[minmax(140px,190px)_1fr_auto] items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2"
                >
                  <span className="text-xs font-medium text-slate-700">
                    {column.code} {column.displayTitle}
                  </span>
                  <div className="h-3 w-full overflow-hidden rounded bg-slate-200">
                    <div className="flex h-full w-full">
                      <div className="h-full bg-rose-500" style={{ width: `${redPct}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${yellowPct}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${greenPct}%` }} />
                    </div>
                  </div>
                  <span className="w-12 text-right text-xs font-semibold text-slate-900">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
