"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";

import { StickyPageHeader } from "@/components/layout";
import { ChecksList, JudgeBreakdown, ScoreChip, VerdictButtons, pct, shortDate, type Verdict } from "@/components/admin/evals/ScoreBits";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { CheckResult, JudgeResult } from "@/lib/evals/types";

type SkillSummary = {
  skill: string;
  n: number;
  scored: number;
  errors: number;
  truncated: number;
  mean: number | null;
  ci95: number | null;
  pass_rate: number | null;
  gates: Record<string, number>;
  penalties: Record<string, number>;
  criteria: Record<string, number>;
  cost_usd: number;
  extra?: TriageExtra;
};

type TriageExtra = {
  accuracy: number;
  lenient_accuracy: number;
  majority_baseline: number;
  disposition_accuracy: number;
  calendar_precision: number | null;
  calendar_at_85: { acted: number; wrong: string[] };
  high_confidence: { n: number; accuracy: number | null };
  per_class: Record<string, { n: number; precision: number | null; recall: number | null }>;
  confusion: Record<string, Record<string, number>>;
  misses: string[];
};

type Run = {
  id: string;
  kind: "suite" | "coach_audit" | "calibration";
  label: string | null;
  skills: string[];
  git_sha: string | null;
  config: Record<string, unknown>;
  summary: Record<string, SkillSummary>;
  cost_usd: number | null;
  status: string;
  started_at: string;
};

type Result = {
  id: string;
  skill: string;
  case_id: string;
  rep: number;
  status: "scored" | "truncated" | "error";
  score: number | null;
  passed: boolean | null;
  hard_fails: string[];
  checks: CheckResult[];
  judge: JudgeResult | null;
  metrics: Record<string, unknown>;
  output: string | null;
  cost_usd: number;
  error: string | null;
  admin_verdict: Verdict | null;
};

const SKILL_LABELS: Record<string, string> = {
  "linkedin.headline": "LinkedIn headline",
  "linkedin.about": "LinkedIn About",
  "linkedin.experience": "LinkedIn current role",
  "campaign.connection": "Connection note",
  "campaign.followups": "Follow-ups",
  "campaign.nurture": "Ongoing nurture",
  "reply.draft": "Replies (Blueprint and live)",
  "reply.triage": "Reply triage",
  "research.pains": "Pain research",
  "judge.check": "Judge check",
};

const SKILL_ORDER = Object.keys(SKILL_LABELS);

async function api<T>(query = ""): Promise<T> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) throw new Error("Sign in again.");
  delete headers["x-impersonate-coach-id"];
  const res = await fetch(`/api/admin/ava/evals${query}`, { headers });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Could not load evals.");
  return body;
}

function SkillCard({ s, previous, onPick, active }: { s: SkillSummary; previous?: SkillSummary; onPick: () => void; active: boolean }) {
  const triage = s.skill === "reply.triage" ? s.extra : undefined;
  const headline = triage ? triage.accuracy * 100 : s.skill === "judge.check" ? (s.pass_rate ?? 0) * 100 : s.mean;
  const prevHeadline = previous ? (previous.skill === "reply.triage" && previous.extra ? previous.extra.accuracy * 100 : previous.mean) : null;
  const delta = headline != null && prevHeadline != null ? Math.round(headline - prevHeadline) : null;
  const gates = Object.entries(s.gates).sort((a, b) => b[1] - a[1]);
  return (
    <button
      type="button"
      onClick={onPick}
      className={`rounded-lg border bg-white p-4 text-left transition-colors hover:border-slate-400 ${active ? "border-slate-900" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{SKILL_LABELS[s.skill] ?? s.skill}</p>
        <ScoreChip score={headline} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {triage
          ? `${pct(triage.accuracy)} right (${pct(triage.lenient_accuracy)} counting defensible calls) vs ${pct(triage.majority_baseline)} for always guessing the commonest.`
          : s.skill === "judge.check"
            ? `${s.scored} known-good and known-bad pieces; the judge sided correctly on ${pct(s.pass_rate)}.`
            : `${s.scored} case${s.scored === 1 ? "" : "s"}, ${pct(s.pass_rate)} pass${s.ci95 != null ? `, ±${Math.round(s.ci95)}` : ""}.`}
        {delta != null && delta !== 0 ? <span className={delta > 0 ? " text-emerald-700" : " text-rose-700"}> {delta > 0 ? `+${delta}` : delta} since last run.</span> : null}
      </p>
      {triage ? (
        <p className="mt-1 text-xs text-slate-600">
          Calendar precision {pct(triage.calendar_precision)}. At 85%+ confidence it said “calendar” {triage.calendar_at_85.acted} times
          {triage.calendar_at_85.wrong.length ? `, wrongly ${triage.calendar_at_85.wrong.length}` : ", never wrongly"}.
        </p>
      ) : null}
      {gates.length ? (
        <p className="mt-1 text-xs text-rose-700">
          Failed: {gates.slice(0, 3).map(([k, v]) => `${k.replace(/_/g, " ")} ×${v}`).join(", ")}
        </p>
      ) : null}
      {s.errors + s.truncated ? <p className="mt-1 text-xs text-slate-500">{s.errors + s.truncated} not scored (errors are never counted as fails)</p> : null}
    </button>
  );
}

function Confusion({ extra }: { extra: TriageExtra }) {
  const classes = [...new Set([...Object.keys(extra.confusion), ...Object.values(extra.confusion).flatMap((r) => Object.keys(r))])].sort();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Reply triage: what BCA expected (rows) vs what Ava said (columns)</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="text-xs tabular-nums">
          <thead>
            <tr>
              <th />
              {classes.map((c) => (
                <th key={c} className="px-2 py-1 font-medium text-slate-500">
                  {c.replace("_", " ")}
                </th>
              ))}
              <th className="px-2 py-1 font-medium text-slate-500">recall</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((row) => (
              <tr key={row}>
                <td className="pr-2 font-medium text-slate-700">{row.replace("_", " ")}</td>
                {classes.map((col) => {
                  const n = extra.confusion[row]?.[col] ?? 0;
                  return (
                    <td key={col} className={`px-2 py-1 text-center ${n ? (row === col ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900") : "text-slate-300"}`}>
                      {n || "·"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center text-slate-600">{pct(extra.per_class[row]?.recall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extra.misses.length ? (
        <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
          {extra.misses.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ResultDetail({ r }: { r: Result }) {
  const [trajectory, setTrajectory] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50 px-4 py-4">
      {r.error ? <p className="text-sm text-rose-700">Not scored: {r.error}</p> : null}
      {r.judge ? <VerdictButtons id={r.id} initial={r.admin_verdict} endpoint="/api/admin/ava/evals" /> : null}
      {r.output ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What Ava wrote</p>
          <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 font-sans text-sm text-slate-800">{r.output}</pre>
        </div>
      ) : null}
      {r.metrics && r.skill === "reply.triage" ? (
        <p className="text-sm text-slate-700">
          Expected <b>{String(r.metrics.expected)}</b>
          {(r.metrics.acceptable as string[] | undefined)?.length ? ` (also fine: ${(r.metrics.acceptable as string[]).join(", ")})` : ""}, Ava said{" "}
          <b>{String(r.metrics.predicted)}</b> at {Math.round(Number(r.metrics.confidence) * 100)}%. {String(r.metrics.reason ?? "")}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Code checks</p>
          <ChecksList checks={r.checks ?? []} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Judge</p>
          <JudgeBreakdown judge={r.judge} />
        </div>
      </div>
      <div>
        {trajectory ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">{JSON.stringify(trajectory, null, 1)}</pre>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const body = await api<{ result: { trajectory: Record<string, unknown> } }>(`?result=${r.id}`);
                setTrajectory(body.result.trajectory ?? {});
              } finally {
                setLoading(false);
              }
            }}
            className="text-xs text-slate-600 underline-offset-2 hover:underline"
          >
            {loading ? "Loading…" : "Show the prompt Ava got and the judge's raw answer"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AvaEvals() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [verdicts, setVerdicts] = useState<Record<Verdict, number> | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [loadedResults, setLoadedResults] = useState<{ run: string; rows: Result[] } | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ runs: Run[]; verdicts: Record<Verdict, number> }>()
      .then((body) => {
        if (cancelled) return;
        setRuns(body.runs);
        setVerdicts(body.verdicts);
        const suite = body.runs.find((r) => r.kind === "suite" && r.status === "done" && !/not comparable/i.test(r.label ?? ""));
        setRunId(suite?.id ?? null);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load evals."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    void api<{ results: Result[] }>(`?run=${runId}`)
      .then((body) => !cancelled && setLoadedResults({ run: runId, rows: body.results }))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load results."));
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const results = loadedResults?.run === runId ? loadedResults.rows : null;
  const suiteRuns = useMemo(() => (runs ?? []).filter((r) => r.kind === "suite"), [runs]);
  const run = suiteRuns.find((r) => r.id === runId) ?? null;
  // The previous run that covered each skill, for the trend.
  const previousFor = (s: string) => {
    const i = suiteRuns.findIndex((r) => r.id === runId);
    return suiteRuns.slice(i + 1).find((r) => r.status === "done" && r.summary?.[s] && !/not comparable/i.test(r.label ?? ""))?.summary[s];
  };
  const summaries = run ? SKILL_ORDER.map((k) => run.summary?.[k]).filter((s): s is SkillSummary => Boolean(s)) : [];
  const shown = (results ?? []).filter((r) => !skill || r.skill === skill).sort((a, b) => (a.score ?? -1) - (b.score ?? -1));
  const triage = run?.summary?.["reply.triage"]?.extra;

  return (
    <div className="flex w-full min-w-0 flex-col">
      <StickyPageHeader
        title="Ava evals"
        description="Ava's report card. Her real prompts run on fictional coaches and labelled replies, then code checks and a judge score each piece against the rubrics in Ava → Knowledge."
      />
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/ava" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Ava
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin/client-success/quality" className="text-sm text-slate-600 underline-offset-2 hover:underline">
              Coach audit →
            </Link>
            {suiteRuns.length ? (
              <select
                value={runId ?? ""}
                onChange={(e) => {
                  setRunId(e.target.value);
                  setSkill(null);
                  setOpen(null);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                aria-label="Run"
              >
                {suiteRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {shortDate(r.started_at)} · {r.label || "Run"} {r.cost_usd != null ? `· $${Number(r.cost_usd).toFixed(2)}` : ""}
                    {r.status !== "done" ? ` (${r.status})` : ""}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {!runs && !error ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading runs…
          </p>
        ) : null}
        {runs && !suiteRuns.length ? (
          <p className="text-sm text-slate-600">
            No eval runs yet. Run <code className="rounded bg-slate-100 px-1">npx tsx scripts/ava-evals.ts</code>.
          </p>
        ) : null}

        {run ? (
          <p className="text-xs text-slate-500">
            Writers on {String(run.config?.writer_model ?? "?")}, triage on {String(run.config?.triage_model ?? "?")}, judged by {String(run.config?.judge_model ?? "?")}.
            {run.git_sha ? ` Code ${run.git_sha}.` : ""} {Object.keys((run.config?.overrides as object) ?? {}).length ? "Tried with local file changes." : ""}
            {verdicts && verdicts.agree + verdicts.too_harsh + verdicts.too_soft > 0
              ? ` You agreed with the judge on ${verdicts.agree} of ${verdicts.agree + verdicts.too_harsh + verdicts.too_soft} pieces you checked (${verdicts.too_harsh} too harsh, ${verdicts.too_soft} too soft).`
              : " Mark a few cases “Judge was right”, “Too harsh” or “Too soft” so we know how far to trust its scores."}
          </p>
        ) : null}

        {summaries.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <SkillCard key={s.skill} s={s} previous={previousFor(s.skill)} active={skill === s.skill} onPick={() => setSkill(skill === s.skill ? null : s.skill)} />
            ))}
          </div>
        ) : null}

        {triage && (!skill || skill === "reply.triage") ? <Confusion extra={triage} /> : null}

        {results ? (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <h3 className="text-sm font-semibold text-slate-900">{skill ? SKILL_LABELS[skill] ?? skill : "Every case"}, weakest first</h3>
              {skill ? (
                <button type="button" onClick={() => setSkill(null)} className="text-xs text-slate-600 hover:underline">
                  Show all
                </button>
              ) : null}
            </div>
            <ul>
              {shown.map((r) => (
                <li key={r.id} className="border-b border-slate-100 last:border-0">
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="w-12 shrink-0">{r.status === "scored" ? <ScoreChip score={r.score} /> : <span className="text-xs text-slate-500">{r.status}</span>}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {r.case_id}
                        {r.rep ? <span className="text-slate-500"> · rep {r.rep + 1}</span> : null}
                        <span className="ml-2 text-xs font-normal text-slate-500">{SKILL_LABELS[r.skill] ?? r.skill}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-600">
                        {r.hard_fails.length ? <span className="text-rose-700">Failed {r.hard_fails.join(", ").replace(/_/g, " ")}. </span> : null}
                        {r.judge?.top_fix || r.error || (r.skill === "reply.triage" ? `Expected ${String(r.metrics.expected)}, got ${String(r.metrics.predicted)}` : "")}
                      </span>
                    </span>
                  </button>
                  {open === r.id ? <ResultDetail r={r} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : runId ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading results…
          </p>
        ) : null}

        {runs?.length ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">All runs</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-3 text-slate-700">
                  <span className="w-28 text-slate-500">{shortDate(r.started_at)}</span>
                  <span className="w-24">{r.kind === "suite" ? "Ava evals" : r.kind === "coach_audit" ? "Coach audit" : "Calibration"}</span>
                  <span className="flex-1">{r.label || "–"}</span>
                  <span className="tabular-nums text-slate-500">{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(2)}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
