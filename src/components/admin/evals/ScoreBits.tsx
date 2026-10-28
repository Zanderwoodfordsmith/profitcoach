"use client";

import { useState } from "react";

import { badgeClass } from "@/components/ui/Badge";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { BAND_LABELS, bandFor, type CheckResult, type JudgeResult, type ScoreBand } from "@/lib/evals/types";

/** Small shared pieces for the eval and coach quality pages. */

const BAND_STYLE: Record<ScoreBand, string> = {
  strong: "bg-emerald-100 text-emerald-800",
  good: "bg-teal-50 text-teal-800",
  needs_work: "bg-amber-100 text-amber-900",
  weak: "bg-rose-100 text-rose-800",
};

const BAND_CELL: Record<ScoreBand, string> = {
  strong: "bg-emerald-500 text-white",
  good: "bg-teal-400 text-white",
  needs_work: "bg-amber-300 text-amber-950",
  weak: "bg-rose-400 text-white",
};

export function ScoreChip({ score, suffix }: { score: number | null | undefined; suffix?: string }) {
  if (score == null) return <span className="text-slate-500">–</span>;
  const band = bandFor(score);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${BAND_STYLE[band]}`} title={BAND_LABELS[band]}>
      {Math.round(score)}
      {suffix ? <span className="ml-1 font-normal opacity-75">{suffix}</span> : null}
    </span>
  );
}

/** A square for grids: colour by band, the score inside, a dash when there is nothing to score. */
export function ScoreCell({ score, title }: { score: number | null | undefined; title?: string }) {
  if (score == null)
    return (
      <span className="inline-flex h-7 w-9 items-center justify-center rounded bg-slate-100 text-xs text-slate-500" title={title}>
        –
      </span>
    );
  return (
    <span className={`inline-flex h-7 w-9 items-center justify-center rounded text-xs font-semibold tabular-nums ${BAND_CELL[bandFor(score)]}`} title={title}>
      {Math.round(score)}
    </span>
  );
}

export function pct(v: number | null | undefined, dp = 0): string {
  return v == null ? "–" : `${(v * 100).toFixed(dp)}%`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Failed checks first, gates before penalties. */
export function ChecksList({ checks }: { checks: CheckResult[] }) {
  const failed = checks.filter((c) => !c.passed).sort((a, b) => (a.level === "gate" ? -1 : 1) - (b.level === "gate" ? -1 : 1));
  const passed = checks.filter((c) => c.passed);
  const [showPassed, setShowPassed] = useState(false);
  if (!checks.length) return null;
  return (
    <div className="space-y-1.5">
      {failed.map((c, i) => (
        <div key={`${c.id}-${i}`} className="flex gap-2 text-sm">
          <span
            className={badgeClass(
              c.level === "gate" ? "red" : c.level === "penalty" ? "amber" : "grey",
              "mt-0.5 shrink-0"
            )}
          >
            {c.level === "gate" ? "Fail" : c.level === "penalty" ? `-${c.points ?? 0}` : "Note"}
          </span>
          <span className="text-slate-700">{c.message}</span>
        </div>
      ))}
      {passed.length ? (
        <button type="button" onClick={() => setShowPassed((v) => !v)} className="text-xs text-slate-500 underline-offset-2 hover:underline">
          {showPassed ? "Hide" : "Show"} {passed.length} passed check{passed.length === 1 ? "" : "s"}
        </button>
      ) : null}
      {showPassed ? (
        <ul className="space-y-1 text-xs text-slate-500">
          {passed.map((c, i) => (
            <li key={`${c.id}-p-${i}`}>✓ {c.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The judge's score per criterion with its evidence and fix. */
export function JudgeBreakdown({ judge }: { judge: JudgeResult | null }) {
  if (!judge?.criteria?.length) return null;
  return (
    <div className="space-y-3">
      {judge.summary ? <p className="text-sm text-slate-700">{judge.summary}</p> : null}
      <table className="w-full text-sm">
        <tbody>
          {judge.criteria.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 align-top">
              <td className="w-10 py-1.5 pr-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold ${
                    c.score >= 4 ? "bg-emerald-100 text-emerald-800" : c.score === 3 ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {c.score}
                </span>
              </td>
              <td className="py-1.5">
                <div className="font-medium text-slate-800">{c.id.replace(/_/g, " ")}</div>
                {c.evidence ? <div className="text-xs text-slate-500">“{c.evidence}”</div> : null}
                {c.fix ? <div className="mt-0.5 text-xs text-slate-700">Fix: {c.fix}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {judge.claims?.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Claims about the coach</p>
          <ul className="mt-1 space-y-1 text-sm">
            {judge.claims.map((c, i) => (
              <li key={i} className={c.supported ? "text-slate-600" : c.severity === "stretched" ? "text-amber-800" : "text-rose-800"}>
                {c.supported ? "✓" : c.severity === "stretched" ? "≈" : "✗"} {c.claim}
                {!c.supported && c.note ? <span className="text-xs text-slate-500"> ({c.note})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export type Verdict = "agree" | "too_harsh" | "too_soft";

const VERDICT_LABELS: Record<Verdict, string> = { agree: "Judge was right", too_harsh: "Too harsh", too_soft: "Too soft" };

/** BCA's call on the judge for one piece. Saved straight away; click again to clear. */
export function VerdictButtons({ id, initial, endpoint }: { id: string; initial: Verdict | null; endpoint: "/api/admin/ava/evals" | "/api/admin/coach-quality" }) {
  const [verdict, setVerdict] = useState<Verdict | null>(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async (next: Verdict | null) => {
    setSaving(true);
    setFailed(false);
    try {
      const headers = await getCoachAuthHeaders(null);
      if (!headers) throw new Error("signed out");
      delete headers["x-impersonate-coach-id"];
      const res = await fetch(endpoint, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id, verdict: next }) });
      if (!res.ok) throw new Error("save failed");
      setVerdict(next);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">Your call:</span>
      {(Object.keys(VERDICT_LABELS) as Verdict[]).map((v) => (
        <button
          key={v}
          type="button"
          disabled={saving}
          onClick={() => void save(verdict === v ? null : v)}
          className={`rounded-md border px-2 py-0.5 text-xs ${verdict === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}
        >
          {VERDICT_LABELS[v]}
        </button>
      ))}
      {failed ? <span className="text-xs text-rose-700">Not saved, try again.</span> : null}
    </div>
  );
}
