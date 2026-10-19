"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { ChecksList, JudgeBreakdown, ScoreCell, ScoreChip, VerdictButtons, pct, shortDate, type Verdict } from "@/components/admin/evals/ScoreBits";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { ARTIFACT_LABELS, type ArtifactKind, type CheckResult, type JudgeResult } from "@/lib/evals/types";

type Pillars = { profile: number | null; messaging: number | null; activity: number | null; results: number | null };

type CoachRow = {
  coach_id: string;
  name: string;
  slug: string;
  sales_robot: boolean;
  profile_as_of: string | null;
  pillars: Pillars;
  overall: number | null;
  percentile: Record<string, number | null>;
  artifacts: Partial<Record<ArtifactKind, { score: number | null; note: string | null; fix: string | null }>>;
  top_fixes: { artifact: ArtifactKind; label: string; score: number | null; fix: string }[];
  health: {
    level: string;
    stuck_at: string;
    invites_7d: number;
    invites_30d: number;
    accept_rate: number | null;
    replies_30d: number;
    interested_30d: number;
    calls_30d: number;
    median_reply_hours: number | null;
    linkedin: string;
  } | null;
};

type AuditSummary = {
  as_of: string;
  coaches: CoachRow[];
  benchmarks: Record<string, number | null>;
  artifacts: Partial<Record<ArtifactKind, { scored: number; missing: number; median: number | null; gates: Record<string, number> }>>;
  library: { artifact: ArtifactKind; source: string | null; score: number | null; fix: string; gates: string[]; text: string | null }[];
};

type Rates = { accept: number | null; reply_per_invite: number | null; interest_per_invite: number | null; invited: number; coaches: number };
type CalibrationSummary = {
  as_of: string;
  totals: { campaigns_with_invites: number; distinct_notes: number; distinct_sequences: number; invited: number };
  blank_vs_note: {
    blank: Rates | null;
    note: Rates;
    within_coach: {
      coaches: number;
      accept_note_minus_blank_median: number | null;
      accept_note_better: number;
      reply_per_invite_note_minus_blank_median: number | null;
      reply_note_better: number;
      interest_per_invite_note_minus_blank_median: number | null;
      interest_note_better: number;
    };
  };
  features: { feature: string; with: Rates; without: Rates }[];
  notes?: Calibrated;
  followups?: Calibrated;
};
type Calibrated = {
  n: number;
  spearman: number | null;
  spearman_interest: number | null;
  halves: { top: number | null; bottom: number | null; topN: number };
  halves_interest: { top: number | null; bottom: number | null; topN: number };
  per_criterion: Record<string, { rate: number | null; interest: number | null }>;
};

type Piece = {
  id: string;
  artifact: ArtifactKind;
  source_ref: string | null;
  source_at: string | null;
  text_scored: string | null;
  score: number | null;
  hard_fails: string[];
  checks: CheckResult[];
  judge: (JudgeResult & { note?: string | null }) | { note: string } | null;
  top_fix: string | null;
  admin_verdict: Verdict | null;
};

const ARTIFACT_COLUMNS: ArtifactKind[] = [
  "linkedin.basics",
  "linkedin.headline",
  "linkedin.about",
  "linkedin.experience",
  "campaign.connection",
  "campaign.followups",
  "campaign.nurture",
];

const FEATURE_LABELS: Record<string, string> = {
  question: "Asks a question",
  i_ask_because: '"I ask because" (the classroom shape)',
  number: "Has a number",
  link: "Has a link",
  company_token: "Uses {{company}}",
  says_coach: 'Says "coach"',
  interest_cta: '"Is this of interest?" style ask',
};

async function api<T>(query = ""): Promise<T> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) throw new Error("Sign in again.");
  delete headers["x-impersonate-coach-id"];
  const res = await fetch(`/api/admin/coach-quality${query}`, { headers });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Could not load the audit.");
  return body;
}

function Tile({ label, value, hint }: { label: string; value: number | null | undefined; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value == null ? "–" : Math.round(value)}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function CoachDetail({ row }: { row: CoachRow }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [previous, setPrevious] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ pieces: Piece[]; previous: Record<string, number | null> }>(`?coach=${row.coach_id}`)
      .then((b) => {
        if (cancelled) return;
        setPieces(b.pieces);
        setPrevious(b.previous);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load."));
    return () => {
      cancelled = true;
    };
  }, [row.coach_id]);
  const h = row.health;
  return (
    <div className="space-y-4 bg-slate-50 px-4 py-4">
      {row.top_fixes.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fix first</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {row.top_fixes.map((f) => (
              <li key={f.artifact}>
                <span className="font-medium">{f.label}</span>
                {f.score != null ? ` (${Math.round(f.score)})` : ""}: {f.fix}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {h ? (
        <p className="text-sm text-slate-700">
          Last 30 days: {h.invites_30d} invites ({h.invites_7d} this week), {pct(h.accept_rate)} accepted, {h.replies_30d} replies, {h.interested_30d} interested, {h.calls_30d} calls
          {h.median_reply_hours != null ? `, replies in about ${Math.max(1, Math.round(h.median_reply_hours))}h` : ""}. Health: {h.stuck_at}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {!pieces && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {(pieces ?? [])
          .slice()
          .sort((a, b) => ARTIFACT_COLUMNS.indexOf(a.artifact) - ARTIFACT_COLUMNS.indexOf(b.artifact))
          .map((p) => {
            const judge = p.judge && "criteria" in p.judge ? (p.judge as JudgeResult) : null;
            const note = p.judge && "note" in p.judge ? p.judge.note : null;
            const before = previous[p.artifact];
            const [, campaignName, status, people] = (p.source_ref ?? "").split("|");
            return (
              <details key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                  <span>
                    <span className="text-sm font-semibold text-slate-900">{ARTIFACT_LABELS[p.artifact]}</span>
                    {campaignName ? <span className="ml-2 text-xs text-slate-500">{campaignName} · {status} · {people}</span> : null}
                    <span className="block text-xs text-slate-600">{p.top_fix || note || ""}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {before != null && p.score != null && Math.round(p.score - before) !== 0 ? (
                      <span className={`text-xs ${p.score > before ? "text-emerald-700" : "text-rose-700"}`}>{p.score > before ? "▲" : "▼"}</span>
                    ) : null}
                    <ScoreChip score={p.score} />
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  {judge ? <VerdictButtons id={p.id} initial={p.admin_verdict} endpoint="/api/admin/coach-quality" /> : null}
                  {p.text_scored ? <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans text-xs text-slate-700">{p.text_scored}</pre> : null}
                  <ChecksList checks={p.checks ?? []} />
                  <JudgeBreakdown judge={judge} />
                  {p.source_at ? <p className="text-xs text-slate-500">Text as of {shortDate(p.source_at)}.</p> : null}
                </div>
              </details>
            );
          })}
      </div>
    </div>
  );
}

function CalibrationPanel({ c }: { c: CalibrationSummary }) {
  const b = c.blank_vs_note;
  const wc = b.within_coach;
  const pp = (x: number | null) => (x == null ? "–" : `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} pts`);
  const rho = (x: number | null | undefined) => (x == null ? "–" : x.toFixed(2));
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Does the bar predict results?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Every connection note and follow-up sequence coaches have sent ({c.totals.invited.toLocaleString("en-GB")} invites across {c.totals.campaigns_with_invites} campaigns,
          Get Clients and Sales Robot history), against what happened. Acceptance is only the first step; interest per invite is what turns into calls. Pooled across
          coaches, so audience and timing still play a part. Checked {shortDate(c.as_of)}.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Invites</th>
              <th className="py-1.5 pr-3 font-medium">Sent</th>
              <th className="py-1.5 pr-3 font-medium">Accepted</th>
              <th className="py-1.5 pr-3 font-medium">Replied / invite</th>
              <th className="py-1.5 pr-3 font-medium">Interested / invite</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Blank (no note)", b.blank],
              ["With a note", b.note],
            ].map(([label, r]) => (
              <tr key={label as string} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-800">{label as string}</td>
                <td className="py-1.5 pr-3">{(r as Rates | null)?.invited.toLocaleString("en-GB") ?? "–"}</td>
                <td className="py-1.5 pr-3">{pct((r as Rates | null)?.accept, 1)}</td>
                <td className="py-1.5 pr-3">{pct((r as Rates | null)?.reply_per_invite, 1)}</td>
                <td className="py-1.5 pr-3">{pct((r as Rates | null)?.interest_per_invite, 2)}</td>
              </tr>
            ))}
            {c.features
              .filter((f) => f.with.invited >= 1000)
              .map((f) => (
                <tr key={f.feature} className="border-b border-slate-100 text-slate-600">
                  <td className="py-1.5 pr-3 pl-3">Note: {FEATURE_LABELS[f.feature] ?? f.feature}</td>
                  <td className="py-1.5 pr-3">{f.with.invited.toLocaleString("en-GB")}</td>
                  <td className="py-1.5 pr-3">{pct(f.with.accept, 1)}</td>
                  <td className="py-1.5 pr-3">{pct(f.with.reply_per_invite, 1)}</td>
                  <td className="py-1.5 pr-3">
                    {pct(f.with.interest_per_invite, 2)}
                    <span className="text-xs text-slate-400"> vs {pct(f.without.interest_per_invite, 2)} without</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {wc.coaches ? (
        <p className="text-sm text-slate-700">
          Same coach, note vs blank ({wc.coaches} coaches who sent both): acceptance {pp(wc.accept_note_minus_blank_median)} (note better for {wc.accept_note_better}), replies per invite{" "}
          {pp(wc.reply_per_invite_note_minus_blank_median)} ({wc.reply_note_better} better), interest per invite {pp(wc.interest_per_invite_note_minus_blank_median)} ({wc.interest_note_better}{" "}
          better). Medians.
        </p>
      ) : null}
      {c.notes || c.followups ? (
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["Connection notes", c.notes, "accepted", "interested per invite"],
              ["Follow-up sequences", c.followups, "replied (of accepted)", "interested (of accepted)"],
            ] as const
          ).map(([label, cal, first, second]) =>
            cal ? (
              <div key={label} className="rounded border border-slate-200 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {label} scored by the rubric ({cal.n})
                </p>
                <p className="mt-1">
                  Rank correlation with {first}: <b>{rho(cal.spearman)}</b>; with {second}: <b>{rho(cal.spearman_interest)}</b>.
                </p>
                <p className="text-xs text-slate-600">
                  Top-scoring half: {pct(cal.halves.top, 1)} {first}, {pct(cal.halves_interest.top, 2)} {second}. Bottom half: {pct(cal.halves.bottom, 1)}, {pct(cal.halves_interest.bottom, 2)}.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  By criterion ({second}):{" "}
                  {Object.entries(cal.per_criterion)
                    .map(([k, v]) => `${k.replace(/_/g, " ")} ${rho(v.interest)}`)
                    .join(", ")}
                </p>
              </div>
            ) : null
          )}
        </div>
      ) : null}
    </section>
  );
}

type SortKey = "overall" | keyof Pillars | "name";

export function CoachQualityBoard() {
  const [audit, setAudit] = useState<{ id: string; summary: AuditSummary; cost_usd: number | null; started_at: string } | null>(null);
  const [calibration, setCalibration] = useState<{ summary: CalibrationSummary } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("overall");

  useEffect(() => {
    let cancelled = false;
    void api<{ audit: typeof audit; calibration: typeof calibration }>()
      .then((b) => {
        if (cancelled) return;
        setAudit(b.audit);
        setCalibration(b.calibration);
        setLoaded(true);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the audit."));
    return () => {
      cancelled = true;
    };
  }, []);

  const s = audit?.summary;
  const rows = useMemo(() => {
    const list = [...(s?.coaches ?? [])];
    const val = (r: CoachRow) => (sort === "overall" ? r.overall : sort === "name" ? null : r.pillars[sort]);
    return sort === "name" ? list.sort((a, b) => a.name.localeCompare(b.name)) : list.sort((a, b) => (val(b) ?? -1) - (val(a) ?? -1));
  }, [s, sort]);
  const weakest = useMemo(
    () =>
      Object.entries(s?.artifacts ?? {})
        .filter(([, a]) => a && a.median != null)
        .sort((a, b) => (a[1]!.median ?? 0) - (b[1]!.median ?? 0)),
    [s]
  );

  const sortButton = (key: SortKey, label: string) => (
    <button type="button" onClick={() => setSort(key)} className={`font-medium ${sort === key ? "text-slate-900 underline underline-offset-4" : "hover:text-slate-700"}`}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {!loaded && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading Ava&apos;s audit…
        </p>
      ) : null}
      {loaded && !s ? (
        <p className="text-sm text-slate-600">
          No audit yet. Run <code className="rounded bg-slate-100 px-1">npx tsx scripts/ava-coach-audit.ts</code>.
        </p>
      ) : null}

      {s ? (
        <>
          <p className="text-sm text-slate-600">
            Scored {shortDate(s.as_of)} with the same rubrics Ava is held to (
            <Link href="/admin/ava/evals" className="underline-offset-2 hover:underline">
              Ava&apos;s own scores
            </Link>
            ). Profile = LinkedIn basics, headline, About and current role. Messaging = the campaign that reached the most people, plus nurture. Activity and results come from the Get clients
            board (last 30 days); coaches on Sales Robot show a dash because BCA can&apos;t see their sending.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile label="BCA overall" value={s.benchmarks.overall} hint="Median coach" />
            <Tile label="Profile" value={s.benchmarks.profile} hint="Median, out of 100" />
            <Tile label="Messaging" value={s.benchmarks.messaging} hint="Median, out of 100" />
            <Tile label="Activity" value={s.benchmarks.activity} hint="100 = 100+ invites a week" />
            <Tile label="Results" value={s.benchmarks.results} hint="Against BCA targets" />
          </div>
          {weakest.length ? (
            <p className="text-sm text-slate-700">
              Weakest across BCA:{" "}
              {weakest
                .slice(0, 4)
                .map(([k, a]) => `${ARTIFACT_LABELS[k as ArtifactKind]} (median ${Math.round(a!.median!)}, ${a!.missing} missing)`)
                .join(", ")}
              .
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">{sortButton("name", "Coach")}</th>
                  <th className="px-3 py-2">{sortButton("overall", "Overall")}</th>
                  <th className="px-3 py-2">{sortButton("profile", "Profile")}</th>
                  <th className="px-3 py-2">{sortButton("messaging", "Messaging")}</th>
                  <th className="px-3 py-2">{sortButton("activity", "Activity")}</th>
                  <th className="px-3 py-2">{sortButton("results", "Results")}</th>
                  {ARTIFACT_COLUMNS.map((k) => (
                    <th key={k} className="px-1 py-2 text-center font-medium normal-case tracking-normal">
                      {ARTIFACT_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.coach_id}>
                    <tr className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${open === r.coach_id ? "bg-slate-50" : ""}`} onClick={() => setOpen(open === r.coach_id ? null : r.coach_id)}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{r.name}</div>
                        <div className="max-w-xs truncate text-xs text-slate-500">{r.top_fixes[0]?.fix ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip score={r.overall} />
                        {r.percentile.overall != null ? <div className="text-[11px] text-slate-500">top {Math.max(1, 100 - r.percentile.overall)}%</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip score={r.pillars.profile} />
                      </td>
                      <td className="px-3 py-2">
                        <ScoreChip score={r.pillars.messaging} />
                      </td>
                      <td className="px-3 py-2">{r.sales_robot && r.pillars.activity == null ? <span className="text-xs text-slate-500">Sales Robot</span> : <ScoreChip score={r.pillars.activity} />}</td>
                      <td className="px-3 py-2">
                        <ScoreChip score={r.pillars.results} />
                      </td>
                      {ARTIFACT_COLUMNS.map((k) => (
                        <td key={k} className="px-1 py-2 text-center">
                          <ScoreCell score={r.artifacts[k]?.score} title={r.artifacts[k]?.note ?? r.artifacts[k]?.fix ?? ""} />
                        </td>
                      ))}
                    </tr>
                    {open === r.coach_id ? (
                      <tr>
                        <td colSpan={6 + ARTIFACT_COLUMNS.length} className="p-0">
                          <CoachDetail row={r} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {s.library.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">BCA&apos;s library templates</h2>
              <p className="mt-1 text-sm text-slate-600">Every coach starts from these, so a weak template shows up in every coach&apos;s campaigns.</p>
              <ul className="mt-3 space-y-2">
                {s.library.map((l, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <ScoreChip score={l.score} />
                    <span>
                      <span className="font-medium text-slate-900">
                        {l.source?.split("|")[2] ?? "Template"} · {ARTIFACT_LABELS[l.artifact]}
                      </span>
                      {l.gates.length ? <span className="text-rose-700"> Failed {l.gates.join(", ").replace(/_/g, " ")}.</span> : null}
                      <span className="block text-slate-600">{l.fix}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {calibration?.summary ? <CalibrationPanel c={calibration.summary} /> : null}
    </div>
  );
}
