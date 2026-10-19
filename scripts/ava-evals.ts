/**
 * Run Ava's eval suite: her real prompts on fictional coaches and labelled
 * prospect replies, scored by code checks and a judge model. Nothing is sent
 * and nothing is saved to a coach. Results go to Admin → Ava → Evals.
 *
 *   npx tsx scripts/ava-evals.ts                         # everything, once
 *   npx tsx scripts/ava-evals.ts --skills linkedin,campaigns --reps 3
 *   npx tsx scripts/ava-evals.ts --skills judge-check    # check the judge first
 *   npx tsx scripts/ava-evals.ts --writer-model claude-sonnet-5-5 --label "Sonnet 5.5 bake-off"
 *   npx tsx scripts/ava-evals.ts --override practice-skills/campaigns.md=./draft-campaigns.md
 *   npx tsx scripts/ava-evals.ts --dry-run               # list cases, no API calls
 *
 * Skills: linkedin, campaigns, reply-triage, reply-draft, research, judge-check.
 * A full run costs about $5 to $10 (judge on claude-opus-5-5); the summary prints the exact cost.
 */
import { readFileSync } from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

function args(flag: string): string[] {
  const argv = process.argv.slice(2);
  return argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]!] : []));
}

async function main() {
  const writerModel = arg("--writer-model");
  if (writerModel) process.env.ANTHROPIC_MODEL = writerModel;
  const judgeModelArg = arg("--judge-model");
  if (judgeModelArg) process.env.EVAL_JUDGE_MODEL = judgeModelArg;

  const { SUITE_SKILLS, runSuiteSkill } = await import("../src/lib/evals/suite");
  const { refreshAgentContextOverrides, setAgentOverrideForEval } = await import("../src/lib/agent/agentOverrides");
  const { createRun, finishRun, saveResults, summarize, writeReport } = await import("../src/lib/evals/runStore");
  const { judgeModel } = await import("../src/lib/evals/judge");
  const { resolveAnthropicModel } = await import("../src/lib/anthropicModel");
  const { EVAL_COACHES } = await import("../src/lib/evals/fixtures/coaches");
  const { REPLY_CASES } = await import("../src/lib/evals/fixtures/replies");
  const { RESEARCH_CASES } = await import("../src/lib/evals/fixtures/research");

  const skills = (arg("--skills")?.split(",").map((s) => s.trim()) ?? [...SUITE_SKILLS]) as (typeof SUITE_SKILLS)[number][];
  const unknown = skills.filter((s) => !(SUITE_SKILLS as readonly string[]).includes(s));
  if (unknown.length) throw new Error(`Unknown skill(s): ${unknown.join(", ")}. Use ${SUITE_SKILLS.join(", ")}.`);
  const reps = Math.max(1, Number(arg("--reps") || 1));
  const concurrency = Math.max(1, Number(arg("--concurrency") || 4));
  const coaches = arg("--coach")?.split(",").map((s) => s.trim()) as ("hvac" | "discreet" | "us_msp")[] | undefined;

  // Live admin edits first (the same files Ava uses today), then any local file being tried out.
  await refreshAgentContextOverrides();
  const overrides: Record<string, string> = {};
  for (const spec of args("--override")) {
    const [rel, file] = spec.split("=");
    if (!rel || !file) throw new Error(`--override wants path=file, got ${spec}`);
    setAgentOverrideForEval(rel, readFileSync(file, "utf8"));
    overrides[rel] = file;
  }

  const config = {
    skills,
    reps,
    coaches: coaches ?? EVAL_COACHES.map((c) => c.id),
    writer_model: resolveAnthropicModel(),
    judge_model: judgeModel(),
    triage_model: "claude-haiku-5-5",
    overrides,
  };

  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(config, null, 1));
    console.log(`Coaches: ${EVAL_COACHES.map((c) => `${c.id} (${c.tests.join("; ")})`).join("\n  ")}`);
    console.log(`Reply cases: ${REPLY_CASES.length} (${REPLY_CASES.filter((c) => c.draft !== false).length} drafted)`);
    console.log(`Research cases: ${RESEARCH_CASES.map((c) => c.id).join(", ")}`);
    return;
  }

  const save = !process.argv.includes("--no-save");
  const runId = save ? await createRun("suite", arg("--label"), skills, config) : `local-${Date.now()}`;
  console.log(`Run ${runId}`);
  const rows = [];
  try {
    for (const skill of skills) {
      const started = Date.now();
      console.log(`${skill}…`);
      const result = await runSuiteSkill(skill, { reps, concurrency, coaches, log: (l) => console.log(l) });
      rows.push(...result);
      if (save) await saveResults(runId, result);
      console.log(`${skill}: ${result.length} rows in ${Math.round((Date.now() - started) / 1000)}s`);
    }
  } catch (err) {
    if (save) await finishRun(runId, summarize(rows) as Record<string, unknown>, rows.reduce((a, r) => a + r.cost_usd, 0), "failed");
    throw err;
  }
  const summary = summarize(rows);
  const cost = rows.reduce((a, r) => a + r.cost_usd, 0);
  if (save) await finishRun(runId, summary as Record<string, unknown>, cost);
  const dir = writeReport(runId, rows, summary, config);

  console.log("\nSkill                 scored  mean   ±95%   pass   cost");
  for (const s of Object.values(summary)) {
    console.log(
      `${s.skill.padEnd(22)}${`${s.scored}/${s.n}`.padEnd(8)}${String(s.mean ?? "-").padEnd(7)}${String(s.ci95 ?? "-").padEnd(7)}${(s.pass_rate == null ? "-" : `${Math.round(s.pass_rate * 100)}%`).padEnd(7)}$${s.cost_usd.toFixed(3)}`
    );
    if (Object.keys(s.gates).length) console.log(`    gates: ${Object.entries(s.gates).map(([k, v]) => `${k} x${v}`).join(", ")}`);
    if (s.extra) console.log(`    ${JSON.stringify({ accuracy: s.extra.accuracy, lenient: s.extra.lenient_accuracy, baseline: s.extra.majority_baseline, calendar_precision: s.extra.calendar_precision })}`);
  }
  console.log(`\nTotal $${cost.toFixed(3)}. Trajectories in ${dir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
