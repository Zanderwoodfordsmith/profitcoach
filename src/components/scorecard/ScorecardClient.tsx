"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  averageWeeklyActual,
  rowWeeklyValue,
  sumWeeklyActual,
} from "@/lib/scorecardCompute";
import type { ScorecardManualKey } from "@/lib/scorecardManual";
import { SCORECARD_METRIC_OPTIONS } from "@/lib/scorecardMetricOptions";
import {
  buildScorecardTargets,
  chartUnitForRow,
  DEFAULT_SCORECARD_CLIENT_PRICE,
  scorecardTrafficLight,
  SCORECARD_ROW_DIRECTION,
  type ScorecardRowId,
  type TrafficLight,
} from "@/lib/scorecardTargets";
import {
  defaultScorecardPeriodStartMonday,
  mondayOfWeekContaining,
  rollScorecardStartMonday,
  thisMondayIsoFromDate,
  toIsoDate,
} from "@/lib/scorecardWeeks";
import { supabaseClient } from "@/lib/supabaseClient";
import type { ScorecardManualWeek } from "@/lib/scorecardManual";

import {
  ScorecardComboChart,
  SCORECARD_VISIBLE_WEEKS,
} from "@/components/scorecard/ScorecardComboChart";

const LIGHT_CLASS: Record<TrafficLight, string> = {
  green: "bg-emerald-500 ring-1 ring-emerald-500/35",
  yellow: "bg-amber-400 ring-1 ring-amber-400/45",
  red: "bg-rose-500 ring-1 ring-rose-500/35",
  neutral: "border border-slate-300 bg-slate-100",
};

type RowSpec =
  | { kind: "section"; label: string }
  | {
      kind: "input" | "calc";
      id: ScorecardRowId;
      label: string;
      manualKey?: ScorecardManualKey;
    };

const ROWS: RowSpec[] = [
  { kind: "section", label: "Evergreen" },
  {
    kind: "input",
    id: "cashNew",
    label: "Cash from new clients",
    manualKey: "cashNew",
  },
  {
    kind: "input",
    id: "cashOld",
    label: "Cash from old clients",
    manualKey: "cashOld",
  },
  { kind: "calc", id: "cashIn", label: "Cash in (calculated)" },
  {
    kind: "input",
    id: "cashOut",
    label: "Cash out",
    manualKey: "cashOut",
  },
  { kind: "calc", id: "netCash", label: "Net cash (calculated)" },
  { kind: "section", label: "North Star" },
  {
    kind: "input",
    id: "newClientsWon",
    label: "New clients won",
    manualKey: "newClientsWon",
  },
  {
    kind: "calc",
    id: "salesOpportunities",
    label: "Sales opportunities (calculated)",
  },
  { kind: "calc", id: "closeRate", label: "Close rate % (calculated)" },
  { kind: "section", label: "Marketing" },
  {
    kind: "input",
    id: "connectionRequestsSent",
    label: "Connection requests sent",
    manualKey: "connectionRequestsSent",
  },
  {
    kind: "input",
    id: "newConnections",
    label: "New connections",
    manualKey: "newConnections",
  },
  {
    kind: "input",
    id: "otherOutreach",
    label: "Other outreach",
    manualKey: "otherOutreach",
  },
  { kind: "input", id: "replied", label: "Replied", manualKey: "replied" },
  {
    kind: "input",
    id: "interested",
    label: "Interested",
    manualKey: "interested",
  },
  {
    kind: "calc",
    id: "connectionRate",
    label: "Connection rate % (calculated)",
  },
  {
    kind: "calc",
    id: "interestRate",
    label: "Interest rate % (calculated)",
  },
  {
    kind: "calc",
    id: "interestedToValueSession",
    label: "Interested → Value session % (calculated)",
  },
  { kind: "section", label: "Sales calls — value sessions" },
  {
    kind: "input",
    id: "valueSessionsAdded",
    label: "Added",
    manualKey: "valueSessionsAdded",
  },
  {
    kind: "input",
    id: "valueSessionsScheduled",
    label: "Scheduled",
    manualKey: "valueSessionsScheduled",
  },
  {
    kind: "input",
    id: "valueSessionsShowed",
    label: "Showed",
    manualKey: "valueSessionsShowed",
  },
  {
    kind: "calc",
    id: "valueShowRate",
    label: "Show rate % (calculated)",
  },
  { kind: "section", label: "Sales calls — follow-up" },
  {
    kind: "input",
    id: "followUpAdded",
    label: "Added",
    manualKey: "followUpAdded",
  },
  {
    kind: "input",
    id: "followUpScheduled",
    label: "Scheduled",
    manualKey: "followUpScheduled",
  },
  {
    kind: "input",
    id: "followUpShowed",
    label: "Showed",
    manualKey: "followUpShowed",
  },
  {
    kind: "calc",
    id: "followUpShowRate",
    label: "Show rate % (calculated)",
  },
  {
    kind: "input",
    id: "overlappingCalls",
    label: "Overlapping value / follow-up calls",
    manualKey: "overlappingCalls",
  },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCount(n: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtRatio(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function formatCell(rowId: ScorecardRowId, v: number | null) {
  if (v === null) return "—";
  const u = chartUnitForRow(rowId);
  if (u === "money") return fmtMoney(v);
  if (u === "ratio") return fmtRatio(v);
  return fmtCount(v);
}

function shortWeekLabel(iso: string) {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function mondayIsoToDateInputValue(iso: string): string {
  return iso;
}

function dateInputToMondayIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const picked = new Date(y, m - 1, d);
  if (Number.isNaN(picked.getTime())) return null;
  return toIsoDate(mondayOfWeekContaining(picked));
}

type WeekPayload = {
  week_start_date: string;
  manual_values: Partial<ScorecardManualWeek>;
};

function MetricSelect({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: ScorecardRowId;
  onChange: (id: ScorecardRowId) => void;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        className="max-w-[200px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm outline-none ring-sky-400 focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value as ScorecardRowId)}
      >
        {SCORECARD_METRIC_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ScorecardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();

  const base = pathname.startsWith("/admin")
    ? "/admin/signature"
    : "/coach/signature";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekPayload[]>([]);
  const [weekStarts, setWeekStarts] = useState<string[]>([]);
  const [ladderGoalLevel, setLadderGoalLevel] = useState<string | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<string | null>(null);
  const [anchorMonday, setAnchorMonday] = useState(() =>
    defaultScorecardPeriodStartMonday()
  );
  const hydratedSavedAnchor = useRef(false);
  const [leftMetric, setLeftMetric] = useState<ScorecardRowId>("newClientsWon");
  const [rightMetric, setRightMetric] = useState<ScorecardRowId>("cashIn");
  const [tick, setTick] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;

    const roleRes = await fetch("/api/profile-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const roleBody = (await roleRes.json().catch(() => ({}))) as {
      role?: string;
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (roleBody.role === "admin" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId]);

  const queueSave = useCallback(
    (iso: string, manual: Partial<ScorecardManualWeek>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const headers = await authHeaders();
        if (!headers) return;
        setSaving(true);
        try {
          const res = await fetch("/api/coach/scorecard", {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              updates: [{ week_start_date: iso, manual_values: manual }],
            }),
          });
          if (!res.ok) {
            const b = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setError(b.error ?? "Save failed.");
          } else {
            setError(null);
          }
        } catch {
          setError("Save failed.");
        } finally {
          setSaving(false);
        }
      }, 650);
    },
    [authHeaders]
  );

  const effectiveStartMonday = useMemo(
    () =>
      rollScorecardStartMonday(
        anchorMonday,
        thisMondayIsoFromDate(),
        SCORECARD_VISIBLE_WEEKS
      ),
    [anchorMonday, tick]
  );

  useEffect(() => {
    if (effectiveStartMonday === anchorMonday) return;
    setAnchorMonday(effectiveStartMonday);
  }, [effectiveStartMonday, anchorMonday]);

  const load = useCallback(async () => {
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const start = rollScorecardStartMonday(
        anchorMonday,
        thisMondayIsoFromDate(),
        SCORECARD_VISIBLE_WEEKS
      );
      const res = await fetch(
        `/api/coach/scorecard?startMonday=${encodeURIComponent(start)}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        weeks?: WeekPayload[];
        ladder_goal_level?: string | null;
        scorecard_period_start_monday?: string | null;
        period?: { week_starts?: string[]; start_monday?: string };
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load scorecard.");
        return;
      }
      setLadderGoalLevel(body.ladder_goal_level ?? null);
      const saved = body.scorecard_period_start_monday ?? null;
      setProfileAnchor(saved);
      if (saved && !hydratedSavedAnchor.current) {
        hydratedSavedAnchor.current = true;
        const rolledSaved = rollScorecardStartMonday(
          saved,
          thisMondayIsoFromDate(),
          SCORECARD_VISIBLE_WEEKS
        );
        if (rolledSaved !== start) {
          setAnchorMonday(rolledSaved);
          return;
        }
      }
      setWeeks(body.weeks ?? []);
      setWeekStarts(body.period?.week_starts ?? []);
    } catch {
      setError("Could not load scorecard.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, anchorMonday, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (tick === 0) return;
    if (!profileAnchor) return;
    const rolled = rollScorecardStartMonday(
      profileAnchor,
      thisMondayIsoFromDate(),
      SCORECARD_VISIBLE_WEEKS
    );
    if (rolled === profileAnchor) return;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/scorecard", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          scorecard_period_start_monday: rolled,
        }),
      });
      if (res.ok) {
        setProfileAnchor(rolled);
        setAnchorMonday(rolled);
      }
    })();
  }, [tick, profileAnchor, authHeaders]);

  const { targets, monthlyIncomeGoal } = useMemo(
    () =>
      buildScorecardTargets({
        ladderGoalLevel: ladderGoalLevel,
        pricePerClientMonth: DEFAULT_SCORECARD_CLIENT_PRICE,
      }),
    [ladderGoalLevel]
  );

  const manualWeeks = useMemo(
    () => weeks.map((w) => w.manual_values),
    [weeks]
  );

  const showMondayNudge = useMemo(() => new Date().getDay() === 1, []);

  const persistAnchor = useCallback(
    async (iso: string | null) => {
      const headers = await authHeaders();
      if (!headers) return;
      setSaving(true);
      try {
        const res = await fetch("/api/coach/scorecard", {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            scorecard_period_start_monday: iso,
          }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(b.error ?? "Could not save period.");
        } else {
          setError(null);
          setProfileAnchor(iso);
        }
      } catch {
        setError("Could not save period.");
      } finally {
        setSaving(false);
      }
    },
    [authHeaders]
  );

  const onPeriodDateChange = (raw: string) => {
    const snapped = dateInputToMondayIso(raw);
    if (!snapped) return;
    hydratedSavedAnchor.current = true;
    setAnchorMonday(snapped);
    void persistAnchor(snapped);
  };

  const onUseRollingWindow = () => {
    hydratedSavedAnchor.current = false;
    const d = defaultScorecardPeriodStartMonday();
    setAnchorMonday(d);
    void persistAnchor(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading scorecard…
      </div>
    );
  }

  const n = weekStarts.length;

  return (
    <div className="max-w-[1800px] pb-16">
      {showMondayNudge ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <Bell className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <span>
            Time to update your Scorecard for this week.{" "}
            <Link
              href={`${base}/scorecard`}
              className="font-medium text-sky-800 underline"
            >
              Open My Scorecard
            </Link>
          </span>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Saving…
          </span>
        ) : (
          <span>Saved</span>
        )}
      </div>

      {monthlyIncomeGoal === null ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Set a goal on{" "}
          <Link href={`${base}/ladder`} className="font-medium underline">
            My Ladder
          </Link>{" "}
          for targets.
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 align-top">
              <th
                className="w-[220px] min-w-[200px] max-w-[240px] border-r border-slate-200 px-3 py-2 align-top"
                scope="col"
              >
                <div className="flex flex-col gap-3 pr-1">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <MetricSelect
                      label="Left axis"
                      value={leftMetric}
                      onChange={setLeftMetric}
                      className="min-w-0 flex-1"
                    />
                    <MetricSelect
                      label="Right axis"
                      value={rightMetric}
                      onChange={setRightMetric}
                      className="min-w-0 flex-1"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-slate-200/80 pt-2">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      First week (Monday)
                    </label>
                    <input
                      type="date"
                      className="w-full max-w-[11.5rem] rounded-md border border-slate-200 px-2 py-1 text-sm shadow-sm"
                      value={mondayIsoToDateInputValue(anchorMonday)}
                      onChange={(e) => onPeriodDateChange(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={onUseRollingWindow}
                      className="w-max rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Use rolling window
                    </button>
                    {profileAnchor ? (
                      <p className="text-[10px] leading-snug text-slate-500">
                        Saved start; advances when the grid needs another week
                        ahead.
                      </p>
                    ) : null}
                  </div>
                </div>
              </th>
              <th
                className="border-b border-slate-200 p-0"
                colSpan={n}
                scope="colgroup"
              >
                <ScorecardComboChart
                  weekStarts={weekStarts}
                  weeks={manualWeeks}
                  leftMetric={leftMetric}
                  rightMetric={rightMetric}
                />
              </th>
              <th
                colSpan={5}
                className="border-l border-slate-200 bg-slate-50"
                aria-hidden
              />
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-3 py-2">
                Metric
              </th>
              {weekStarts.map((iso) => (
                <th key={iso} className="min-w-[64px] px-1 py-2 text-center">
                  {shortWeekLabel(iso)}
                </th>
              ))}
              <th className="min-w-[64px] px-1 py-2 text-center">Σ</th>
              <th className="min-w-[64px] px-1 py-2 text-center">Avg / wk</th>
              <th className="min-w-[64px] px-1 py-2 text-center">Target / wk</th>
              <th className="min-w-[64px] px-1 py-2 text-center">Q target</th>
              <th className="min-w-[52px] px-1 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => {
              if (row.kind === "section") {
                return (
                  <tr key={`s-${idx}`} className="bg-slate-100/90">
                    <td
                      colSpan={n + 6}
                      className="sticky left-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              const tid = row.id;
              const trow = targets[tid];
              const avg = averageWeeklyActual(tid, manualWeeks);
              const sum = sumWeeklyActual(tid, manualWeeks);
              const light = scorecardTrafficLight({
                actualAvg: avg,
                weeklyTarget: monthlyIncomeGoal !== null ? trow.weekly : null,
                direction: SCORECARD_ROW_DIRECTION[tid],
              });

              return (
                <tr
                  key={tid}
                  className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50"
                >
                  <td
                    className={`sticky left-0 z-10 border-r border-slate-100 px-3 py-1.5 text-slate-800 ${
                      row.kind === "calc" ? "bg-slate-100" : "bg-white"
                    }`}
                  >
                    {row.label}
                  </td>
                  {weekStarts.map((iso, wi) => {
                    const w = weeks[wi];
                    const display = rowWeeklyValue(tid, w?.manual_values ?? {});
                    if (row.kind === "input" && row.manualKey) {
                      const mk = row.manualKey;
                      const rawV = w?.manual_values?.[mk];
                      const displayStr =
                        typeof rawV === "number" && Number.isFinite(rawV)
                          ? String(rawV)
                          : "";
                      return (
                        <td key={iso} className="px-0.5 py-0.5">
                          <input
                            className="w-full min-w-[56px] rounded border border-white bg-white px-1 py-1 text-center text-sm tabular-nums outline-none ring-sky-400 focus:ring-2"
                            inputMode="decimal"
                            value={displayStr}
                            onChange={(e) => {
                              const t = e.target.value;
                              setWeeks((prev) => {
                                const next = [...prev];
                                const roww = { ...next[wi] };
                                let num = 0;
                                if (t.trim() !== "") {
                                  const n0 = Number(t);
                                  if (!Number.isFinite(n0) || n0 < 0) {
                                    return prev;
                                  }
                                  num = n0;
                                }
                                roww.manual_values = {
                                  ...roww.manual_values,
                                  [mk]: num,
                                };
                                next[wi] = roww;
                                queueSave(
                                  roww.week_start_date,
                                  roww.manual_values
                                );
                                return next;
                              });
                            }}
                            aria-label={`${row.label} ${iso}`}
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={iso}
                        className="bg-slate-100 px-1 py-1.5 text-center tabular-nums text-slate-700"
                      >
                        {formatCell(tid, display)}
                      </td>
                    );
                  })}
                  <td className="bg-slate-50 px-1 py-1.5 text-center tabular-nums text-slate-700">
                    {sum === null ? "—" : formatCell(tid, sum)}
                  </td>
                  <td className="bg-slate-50 px-1 py-1.5 text-center tabular-nums text-slate-700">
                    {avg === null ? "—" : formatCell(tid, avg)}
                  </td>
                  <td className="bg-slate-50 px-1 py-1.5 text-center tabular-nums text-slate-600">
                    {monthlyIncomeGoal === null
                      ? "—"
                      : formatCell(tid, trow.weekly)}
                  </td>
                  <td className="bg-slate-50 px-1 py-1.5 text-center tabular-nums text-slate-600">
                    {monthlyIncomeGoal === null ||
                    chartUnitForRow(tid) === "ratio"
                      ? "—"
                      : formatCell(tid, trow.quarterly)}
                  </td>
                  <td className="bg-slate-50 px-1 py-1 text-center">
                    <span
                      className={`mx-auto inline-block h-3.5 w-3.5 rounded-full ${LIGHT_CLASS[light]}`}
                      title={light}
                      aria-label={`Status: ${light}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
