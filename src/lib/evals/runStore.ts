import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { EvalRow } from "./suite";

/**
 * Saving runs: a row per run in ava_eval_runs, a row per (case, rep) in
 * ava_eval_results, and the full trajectories on disk under reports/ (git
 * ignored) so a surprising score can be traced without re-running.
 */

export type RunKind = "suite" | "coach_audit" | "calibration";

export function gitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

export async function createRun(kind: RunKind, label: string | null, skills: string[], config: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ava_eval_runs")
    .insert({ kind, label, skills, git_sha: gitSha(), config })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create the run: ${error?.message ?? "no row"}`);
  return data.id as string;
}

export async function finishRun(id: string, summary: Record<string, unknown>, cost: number, status: "done" | "failed" = "done"): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ava_eval_runs")
    .update({ summary, cost_usd: Number(cost.toFixed(4)), status, finished_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not finish the run: ${error.message}`);
}

export async function saveResults(runId: string, rows: EvalRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40).map((r) => ({
      run_id: runId,
      skill: r.skill,
      case_id: r.case_id,
      rep: r.rep,
      status: r.status,
      score: r.score,
      passed: r.passed,
      hard_fails: r.hard_fails,
      checks: r.checks,
      judge: r.judge,
      metrics: r.metrics,
      output: r.output,
      trajectory: r.trajectory,
      usage: r.usage,
      cost_usd: Number(r.cost_usd.toFixed(5)),
      error: r.error ?? null,
    }));
    const { error } = await supabaseAdmin.from("ava_eval_results").insert(chunk);
    if (error) throw new Error(`Could not save results: ${error.message}`);
  }
}

// ------------------------------------------------------------ summary

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Half-width of a 95% interval on the mean. */
function ci95(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  return (1.96 * sd) / Math.sqrt(xs.length);
}

const round = (x: number | null, dp = 1) => (x == null ? null : Math.round(x * 10 ** dp) / 10 ** dp);

export type SkillSummary = {
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
  extra?: Record<string, unknown>;
};

function triageExtra(rows: EvalRow[]): Record<string, unknown> {
  const scored = rows.filter((r) => r.status === "scored");
  const m = (r: EvalRow) => r.metrics as { expected: string; predicted: string; lenient: boolean; confidence: number; disposition_expected: string; disposition_predicted: string };
  const classes = [...new Set(scored.flatMap((r) => [m(r).expected, m(r).predicted]))].sort();
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of scored) {
    const { expected, predicted } = m(r);
    confusion[expected] ??= {};
    confusion[expected]![predicted] = (confusion[expected]![predicted] ?? 0) + 1;
  }
  const perClass: Record<string, { n: number; precision: number | null; recall: number | null }> = {};
  for (const c of classes) {
    const tp = scored.filter((r) => m(r).expected === c && m(r).predicted === c).length;
    const predicted = scored.filter((r) => m(r).predicted === c).length;
    const actual = scored.filter((r) => m(r).expected === c).length;
    perClass[c] = { n: actual, precision: predicted ? round(tp / predicted, 3) : null, recall: actual ? round(tp / actual, 3) : null };
  }
  const counts = Object.values(confusion).map((row) => Object.values(row).reduce((a, b) => a + b, 0));
  const highConf = scored.filter((r) => m(r).confidence >= 0.85);
  return {
    accuracy: round(scored.filter((r) => r.passed).length / Math.max(1, scored.length), 3),
    lenient_accuracy: round(scored.filter((r) => m(r).lenient).length / Math.max(1, scored.length), 3),
    majority_baseline: round(Math.max(0, ...counts) / Math.max(1, scored.length), 3),
    disposition_accuracy: round(scored.filter((r) => m(r).disposition_expected === m(r).disposition_predicted).length / Math.max(1, scored.length), 3),
    // Autopilot only acts on calendar at 85%+ confidence, so this is the number that matters for it.
    calendar_precision: perClass.calendar?.precision ?? null,
    calendar_at_85: (() => {
      const acted = scored.filter((r) => m(r).predicted === "calendar" && m(r).confidence >= 0.85);
      return { acted: acted.length, wrong: acted.filter((r) => m(r).expected !== "calendar").map((r) => r.case_id) };
    })(),
    high_confidence: { n: highConf.length, accuracy: highConf.length ? round(highConf.filter((r) => r.passed).length / highConf.length, 3) : null },
    per_class: perClass,
    confusion,
    misses: scored.filter((r) => !r.passed).map((r) => `${r.case_id}: expected ${m(r).expected}, got ${m(r).predicted} (${Math.round(m(r).confidence * 100)}%)`),
  };
}

export function summarize(rows: EvalRow[]): Record<string, SkillSummary> {
  const bySkill = new Map<string, EvalRow[]>();
  for (const r of rows) bySkill.set(r.skill, [...(bySkill.get(r.skill) ?? []), r]);
  const out: Record<string, SkillSummary> = {};
  for (const [skill, list] of bySkill) {
    const scored = list.filter((r) => r.status === "scored" && r.score != null);
    const scores = scored.map((r) => r.score!);
    const gates: Record<string, number> = {};
    const penalties: Record<string, number> = {};
    const crit: Record<string, number[]> = {};
    for (const r of scored) {
      for (const g of r.hard_fails) gates[g] = (gates[g] ?? 0) + 1;
      for (const c of r.checks) if (c.level === "penalty" && !c.passed) penalties[c.id] = (penalties[c.id] ?? 0) + 1;
      for (const c of r.judge?.criteria ?? []) (crit[c.id] ??= []).push(c.score);
    }
    out[skill] = {
      skill,
      n: list.length,
      scored: scored.length,
      errors: list.filter((r) => r.status === "error").length,
      truncated: list.filter((r) => r.status === "truncated").length,
      mean: round(mean(scores)),
      ci95: round(ci95(scores)),
      pass_rate: scored.length ? round(scored.filter((r) => r.passed).length / scored.length, 3) : null,
      gates,
      penalties,
      criteria: Object.fromEntries(Object.entries(crit).map(([k, v]) => [k, round(mean(v), 2)!])),
      cost_usd: Number(list.reduce((a, r) => a + r.cost_usd, 0).toFixed(4)),
      extra: skill === "reply.triage" ? triageExtra(list) : undefined,
    };
  }
  return out;
}

// ------------------------------------------------------------ report on disk

function summaryMarkdown(runId: string, summary: Record<string, SkillSummary>, config: Record<string, unknown>): string {
  const lines = [`# Ava eval run ${runId}`, "", "```", JSON.stringify(config, null, 1), "```", ""];
  lines.push("| Skill | Scored | Errors | Mean | ±95% | Pass | Cost |", "|---|---|---|---|---|---|---|");
  for (const s of Object.values(summary)) {
    lines.push(`| ${s.skill} | ${s.scored}/${s.n} | ${s.errors + s.truncated} | ${s.mean ?? "-"} | ${s.ci95 ?? "-"} | ${s.pass_rate == null ? "-" : `${Math.round(s.pass_rate * 100)}%`} | $${s.cost_usd.toFixed(3)} |`);
  }
  for (const s of Object.values(summary)) {
    lines.push("", `## ${s.skill}`);
    if (Object.keys(s.gates).length) lines.push(`Gates failed: ${Object.entries(s.gates).map(([k, v]) => `${k} x${v}`).join(", ")}`);
    if (Object.keys(s.penalties).length) lines.push(`Penalties: ${Object.entries(s.penalties).map(([k, v]) => `${k} x${v}`).join(", ")}`);
    if (Object.keys(s.criteria).length) lines.push(`Criteria (1 to 5): ${Object.entries(s.criteria).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (s.extra) lines.push("```", JSON.stringify(s.extra, null, 1), "```");
  }
  return lines.join("\n");
}

export function writeReport(runId: string, rows: EvalRow[], summary: Record<string, SkillSummary>, config: Record<string, unknown>): string {
  const dir = path.join(process.cwd(), "reports", "ava-evals", runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "results.jsonl"), rows.filter((r) => r.status !== "error").map((r) => JSON.stringify(r)).join("\n"));
  fs.writeFileSync(path.join(dir, "errors.jsonl"), rows.filter((r) => r.status === "error").map((r) => JSON.stringify(r)).join("\n"));
  fs.writeFileSync(path.join(dir, "summary.md"), summaryMarkdown(runId, summary, config));
  return dir;
}
