/**
 * Ava's audit of every active coach: LinkedIn profile (basics, headline,
 * About, current role) and the campaign they actually sent (connection note,
 * follow-ups, nurture), scored with the same rubrics as Ava's own evals, then
 * combined with the coach health numbers (volume, acceptance, replies, calls).
 * Also scores BCA's published library templates once. Read-only on coach data.
 * Results: Admin → Coaches → Quality.
 *
 *   npx tsx scripts/ava-coach-audit.ts                 # every active coach
 *   npx tsx scripts/ava-coach-audit.ts --coach <id>    # one coach (repeat or comma-separate)
 *   npx tsx scripts/ava-coach-audit.ts --all           # include inactive coaches with a profile
 *   npx tsx scripts/ava-coach-audit.ts --no-library
 *   npx tsx scripts/ava-coach-audit.ts --resummarize <run id>   # recompute pillars from saved scores, no judge calls
 *
 * About 3 judge calls per coach on claude-opus-5-5, roughly $0.10 a coach.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

async function main() {
  const { refreshAgentContextOverrides } = await import("../src/lib/agent/agentOverrides");
  const { loadCoachHealth } = await import("../src/lib/coachHealth");
  const audit = await import("../src/lib/evals/coachAudit");
  const { createRun } = await import("../src/lib/evals/runStore");
  const { judgeModel } = await import("../src/lib/evals/judge");

  await refreshAgentContextOverrides();
  const resummarize = arg("--resummarize");
  if (resummarize) return summarizeAgain(resummarize);
  const coachIds = arg("--coach")?.split(",").map((s) => s.trim()).filter(Boolean);
  const targets = await audit.loadAuditTargets({ coachIds, includeInactive: process.argv.includes("--all") });
  console.log(`${targets.length} coaches. Loading health numbers…`);
  const health = new Map((await loadCoachHealth()).map((h) => [h.coach_id, h]));

  const config = { judge_model: judgeModel(), coaches: targets.length, include_inactive: process.argv.includes("--all"), targets: audit.RESULT_TARGETS };
  const runId = await createRun("coach_audit", arg("--label"), ["linkedin", "campaigns"], config);
  console.log(`Run ${runId}`);

  const results: AuditResults = [];
  let cost = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < targets.length) {
        const target = targets[next++]!;
        try {
          const pieces = await audit.auditCoach(target);
          await audit.savePieces(runId, pieces);
          cost += pieces.reduce((a, p) => a + p.cost_usd, 0);
          results.push({ target, pieces });
          const scored = pieces.filter((p) => p.scored).map((p) => `${p.artifact.split(".")[1]} ${Math.round(p.scored!.score)}`);
          console.log(`  ${target.name}: ${scored.join(", ") || "nothing to score"}`);
        } catch (err) {
          console.error(`  ${target.name}: failed (${err instanceof Error ? err.message : err})`);
        }
      }
    })
  );

  const library = process.argv.includes("--no-library") ? [] : await audit.auditLibrary();
  cost += library.reduce((a, p) => a + p.cost_usd, 0);
  const librarySummary = library.map((p) => ({ artifact: p.artifact, source: p.source_ref, score: p.scored?.score ?? null, band: p.scored?.band ?? null, fix: p.top_fix, gates: p.scored?.hardFails ?? [], text: p.text_scored }));
  await saveSummary(runId, results, health, librarySummary, cost);
}

type Audit = typeof import("../src/lib/evals/coachAudit");
type AuditResults = { target: Awaited<ReturnType<Audit["loadAuditTargets"]>>[number]; pieces: Awaited<ReturnType<Audit["auditCoach"]>> }[];
type Health = Map<string, Awaited<ReturnType<typeof import("../src/lib/coachHealth")["loadCoachHealth"]>>[number]>;

/** Recompute the pillars and benchmarks of an earlier audit from its saved scores, after a weighting change. */
async function summarizeAgain(runId: string) {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { loadCoachHealth } = await import("../src/lib/coachHealth");
  const audit = await import("../src/lib/evals/coachAudit");
  const { data: run } = await supabaseAdmin.from("ava_eval_runs").select("id, kind, summary, cost_usd").eq("id", runId).single();
  if (!run || run.kind !== "coach_audit") throw new Error("That is not a coach audit run.");
  const { data: rows } = await supabaseAdmin.from("coach_quality_scores").select("*").eq("run_id", runId);
  const ids = [...new Set((rows ?? []).map((r) => r.coach_id as string))];
  const targets = await audit.loadAuditTargets({ coachIds: ids });
  const health = new Map((await loadCoachHealth()).map((h) => [h.coach_id, h]));
  const results: AuditResults = targets.map((target) => ({
    target,
    pieces: (rows ?? []).filter((r) => r.coach_id === target.coach_id).map((r) => audit.pieceFromRow(r)),
  }));
  const library = ((run.summary as { library?: unknown[] })?.library ?? []) as Parameters<typeof saveSummary>[3];
  await saveSummary(runId, results, health, library, Number(run.cost_usd ?? 0));
}

async function saveSummary(
  runId: string,
  results: AuditResults,
  health: Health,
  library: { artifact: string; source: string | null; score: number | null; band: string | null; fix: string; gates: string[]; text: string | null }[],
  cost: number
) {
  const audit = await import("../src/lib/evals/coachAudit");
  const { finishRun } = await import("../src/lib/evals/runStore");
  const coaches = results.map(({ target, pieces }) => {
    const h = health.get(target.coach_id);
    const pillars = audit.pillarsFor(pieces, h);
    return {
      coach_id: target.coach_id,
      name: target.name,
      slug: target.slug,
      sales_robot: target.sales_robot,
      profile_as_of: target.scraped_at,
      pillars,
      overall: audit.overall(pillars),
      artifacts: Object.fromEntries(pieces.map((p) => [p.artifact, { score: p.scored?.score ?? null, band: p.scored?.band ?? null, note: p.note ?? null, fix: p.top_fix || null }])),
      top_fixes: audit.topFixes(pieces),
      health: h
        ? {
            level: h.level,
            stuck_at: h.stuck_at,
            next_step: h.next_step,
            invites_7d: h.invites_7d,
            invites_30d: h.invites_30d,
            accept_rate: h.accept_rate,
            replies_30d: h.replies_30d,
            interested_30d: h.interested_30d,
            calls_30d: h.calls_30d,
            median_reply_hours: h.median_reply_hours,
            last_active_days: h.last_active_days,
            linkedin: h.linkedin,
            blueprint: h.blueprint,
            ssi: h.ssi,
          }
        : null,
    };
  });

  // Where each coach sits against the others, per pillar.
  const pillarKeys = ["profile", "messaging", "activity", "results"] as const;
  const withRank = coaches.map((c) => {
    const percentile: Record<string, number | null> = {};
    for (const k of [...pillarKeys, "overall"] as const) {
      const mine = k === "overall" ? c.overall : c.pillars[k];
      const others = coaches.map((o) => (k === "overall" ? o.overall : o.pillars[k])).filter((x): x is number => x != null);
      percentile[k] = mine == null || others.length < 3 ? null : Math.round((others.filter((x) => x < mine).length / (others.length - 1 || 1)) * 100);
    }
    return { ...c, percentile };
  });
  const medianOf = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)]! : null;
  };
  const artifactKinds = [...new Set(results.flatMap((r) => r.pieces.map((p) => p.artifact)))];
  const summary = {
    as_of: new Date().toISOString(),
    coaches: withRank.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1)),
    benchmarks: Object.fromEntries([...pillarKeys.map((k) => [k, medianOf(coaches.map((c) => c.pillars[k]))]), ["overall", medianOf(coaches.map((c) => c.overall))]]),
    artifacts: Object.fromEntries(
      artifactKinds.map((k) => {
        const scored = results.flatMap((r) => r.pieces.filter((p) => p.artifact === k && p.scored));
        const gates: Record<string, number> = {};
        for (const p of scored) for (const g of p.scored!.hardFails) gates[g] = (gates[g] ?? 0) + 1;
        return [k, { scored: scored.length, missing: results.length - scored.length, median: medianOf(scored.map((p) => p.scored!.score)), gates }];
      })
    ),
    library,
  };
  await finishRun(runId, summary, cost);

  console.log("\nCoach                        overall profile messaging activity results");
  for (const c of summary.coaches) {
    const f = (x: number | null) => (x == null ? "-" : String(Math.round(x))).padEnd(9);
    console.log(`${c.name.padEnd(29)}${f(c.overall)}${f(c.pillars.profile)}${f(c.pillars.messaging)}${f(c.pillars.activity)}${f(c.pillars.results)}`);
  }
  console.log(`\nMedians: ${JSON.stringify(summary.benchmarks)}`);
  for (const l of summary.library) console.log(`Library ${l.source?.split("|")[2]} (${l.artifact}): ${l.score ?? "-"} ${l.gates.length ? `gates: ${l.gates.join(", ")}` : ""}`);
  console.log(`\nTotal $${cost.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
