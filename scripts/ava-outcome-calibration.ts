/**
 * Check the rubrics against reality. Every connection note and follow-up
 * sequence BCA coaches have sent (Get Clients and imported Sales Robot
 * history) is scored with the same rubric, then compared with what happened:
 * acceptance for notes, replies and interest for follow-ups. If a higher score
 * does not go with better results, the rubric is wrong, not the coaches.
 *
 *   npx tsx scripts/ava-outcome-calibration.ts              # score up to 60 notes and 60 sequences
 *   npx tsx scripts/ava-outcome-calibration.ts --max 20
 *   npx tsx scripts/ava-outcome-calibration.ts --features-only   # no judge calls, free
 *
 * Read-only on coach data. Saves a 'calibration' run for Admin → Ava → Evals.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

const ACCEPTED = new Set(["connected", "in_sequence", "replied", "interested", "assessment_sent", "assessment_done", "call_offered", "completed"]);
const REPLIED = new Set(["replied", "interested", "assessment_sent", "assessment_done", "call_offered"]);
const INTERESTED = new Set(["interested", "assessment_sent", "assessment_done", "call_offered"]);

type Stats = { invited: number; accepted: number; replied: number; interested: number };
type Group = { key: string; text: string; messages: string[]; campaigns: Set<string>; coaches: Set<string>; stats: Stats };

const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { refreshAgentContextOverrides } = await import("../src/lib/agent/agentOverrides");
  const { runChecks } = await import("../src/lib/evals/checks");
  const { judge, judgeModel } = await import("../src/lib/evals/judge");
  const { loadRubric } = await import("../src/lib/evals/rubrics");
  const { combine } = await import("../src/lib/evals/score");
  const { numbered } = await import("../src/lib/evals/extract");
  const { noteFeatures, spearman, splitHalves } = await import("../src/lib/evals/calibration");
  const { createRun, finishRun } = await import("../src/lib/evals/runStore");
  await refreshAgentContextOverrides();

  const max = Math.max(1, Number(arg("--max") || 60));
  const featuresOnly = process.argv.includes("--features-only");

  console.log("Loading campaigns and steps…");
  const { data: camps } = await supabaseAdmin.from("linkedin_campaigns").select("id, coach_id, name, status");
  const steps: { campaign_id: string; position: number; step_type: string; body: string | null }[] = [];
  const ids = (camps ?? []).map((c) => c.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from("linkedin_campaign_steps").select("campaign_id, position, step_type, body").in("campaign_id", ids.slice(i, i + 200));
    steps.push(...((data ?? []) as typeof steps));
  }

  console.log("Loading lead outcomes…");
  const stats = new Map<string, Stats>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from("linkedin_campaign_leads").select("campaign_id, status, interest_outcome").order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const l of data ?? []) {
      if (l.status === "queued" || l.status === "failed") continue;
      const s = stats.get(l.campaign_id as string) ?? { invited: 0, accepted: 0, replied: 0, interested: 0 };
      s.invited += 1;
      if (ACCEPTED.has(String(l.status))) s.accepted += 1;
      if (REPLIED.has(String(l.status))) s.replied += 1;
      if (INTERESTED.has(String(l.status)) || l.interest_outcome === "positive") s.interested += 1;
      stats.set(l.campaign_id as string, s);
    }
    if (!data || data.length < 1000) break;
  }

  // Group campaigns that sent the same note (library copies often did).
  const notes = new Map<string, Group>();
  const sequences = new Map<string, Group>();
  const add = (map: Map<string, Group>, key: string, text: string, messages: string[], c: { id: string; coach_id: string }, s: Stats) => {
    const g = map.get(key) ?? { key, text, messages, campaigns: new Set(), coaches: new Set(), stats: { invited: 0, accepted: 0, replied: 0, interested: 0 } };
    g.campaigns.add(c.id);
    g.coaches.add(c.coach_id);
    for (const k of Object.keys(s) as (keyof Stats)[]) g.stats[k] += s[k];
    map.set(key, g);
  };
  for (const c of camps ?? []) {
    const s = stats.get(c.id as string);
    if (!s || s.invited < 20) continue;
    const own = steps.filter((st) => st.campaign_id === c.id).sort((a, b) => a.position - b.position);
    const invite = own.find((st) => st.step_type === "invite");
    if (!invite) continue;
    const note = (invite.body ?? "").trim();
    add(notes, note ? norm(note) : "(blank)", note, [], { id: c.id as string, coach_id: c.coach_id as string }, s);
    const messages = own.filter((st) => st.step_type === "message" && (st.body ?? "").trim()).map((st) => st.body!.trim());
    if (messages.length) add(sequences, norm(messages.join("\n")), numbered(messages), messages, { id: c.id as string, coach_id: c.coach_id as string }, s);
  }

  const blank = notes.get("(blank)");
  const withNote = [...notes.values()].filter((g) => g.key !== "(blank)");
  const pooled = (gs: Group[], k: keyof Stats, of: keyof Stats) => rate(gs.reduce((s, g) => s + g.stats[k], 0), gs.reduce((s, g) => s + g.stats[of], 0));

  // Free view: plain features of the note against acceptance.
  // Acceptance is only the first step; replies and interest per invite are what turn into calls.
  const rates = (gs: Group[]) => ({
    accept: pooled(gs, "accepted", "invited"),
    reply_per_invite: pooled(gs, "replied", "invited"),
    interest_per_invite: pooled(gs, "interested", "invited"),
    invited: gs.reduce((s, g) => s + g.stats.invited, 0),
    coaches: new Set(gs.flatMap((g) => [...g.coaches])).size,
  });
  const featureRows: { feature: string; with: ReturnType<typeof rates>; without: ReturnType<typeof rates> }[] = [];
  const featureNames = ["question", "i_ask_because", "number", "link", "company_token", "says_coach", "interest_cta"];
  for (const f of featureNames) {
    const yes = withNote.filter((g) => noteFeatures(g.text)[f] === true);
    const no = withNote.filter((g) => noteFeatures(g.text)[f] !== true);
    featureRows.push({ feature: f, with: rates(yes), without: rates(no) });
  }

  // Same coach, blank invites vs a note: takes each coach's own audience out of the comparison.
  const byCoach = new Map<string, { blank: Stats; note: Stats }>();
  for (const g of notes.values()) {
    for (const cid of g.campaigns) {
      const camp = (camps ?? []).find((c) => c.id === cid);
      const s = stats.get(cid);
      if (!camp || !s) continue;
      const row = byCoach.get(camp.coach_id as string) ?? { blank: { invited: 0, accepted: 0, replied: 0, interested: 0 }, note: { invited: 0, accepted: 0, replied: 0, interested: 0 } };
      const side = g.key === "(blank)" ? row.blank : row.note;
      for (const k of Object.keys(s) as (keyof Stats)[]) side[k] += s[k];
      byCoach.set(camp.coach_id as string, row);
    }
  }
  const paired = [...byCoach.values()].filter((r) => r.blank.invited >= 100 && r.note.invited >= 100);
  const diffs = (k: keyof Stats) =>
    paired.map((r) => r.note[k] / r.note.invited - r.blank[k] / r.blank.invited).sort((a, b) => a - b);
  const medianDiff = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length / 2)]! : null);
  const withinCoach = {
    coaches: paired.length,
    accept_note_minus_blank_median: medianDiff(diffs("accepted")),
    accept_note_better: diffs("accepted").filter((d) => d > 0).length,
    reply_per_invite_note_minus_blank_median: medianDiff(diffs("replied")),
    reply_note_better: diffs("replied").filter((d) => d > 0).length,
    interest_per_invite_note_minus_blank_median: medianDiff(diffs("interested")),
    interest_note_better: diffs("interested").filter((d) => d > 0).length,
  };
  const summary: Record<string, unknown> = {
    as_of: new Date().toISOString(),
    totals: {
      campaigns_with_invites: [...notes.values()].reduce((s, g) => s + g.campaigns.size, 0),
      distinct_notes: withNote.length,
      distinct_sequences: sequences.size,
      invited: [...notes.values()].reduce((s, g) => s + g.stats.invited, 0),
    },
    blank_vs_note: { blank: blank ? rates([blank]) : null, note: rates(withNote), within_coach: withinCoach },
    features: featureRows,
  };

  const runId = await createRun("calibration", arg("--label"), ["campaign.connection", "campaign.followups"], { judge_model: judgeModel(), max, features_only: featuresOnly });
  let cost = 0;

  if (!featuresOnly) {
    const scoreGroups = async (kind: "campaign.connection" | "campaign.followups", groups: Group[], minN: number, outcome: (g: Group) => { hits: number; n: number }) => {
      const rubric = loadRubric(kind);
      const eligible = groups.filter((g) => outcome(g).n >= minN).sort((a, b) => outcome(b).n - outcome(a).n).slice(0, max);
      console.log(`Scoring ${eligible.length} ${kind} pieces…`);
      const points: { score: number; hits: number; n: number; rate: number; coaches: number; campaigns: number; text: string; criteria: Record<string, number>; interested?: number }[] = [];
      let next = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (next < eligible.length) {
            const g = eligible[next++]!;
            const input = kind === "campaign.followups" ? { text: g.text, messages: g.messages } : { text: g.text };
            try {
              const verdict = await judge({ rubric, piece: g.text, context: "A message a BCA coach sent on LinkedIn. Score it against the rubric as written." });
              cost += verdict.usage?.cost_usd ?? 0;
              const scored = combine({ kind, rubric, checks: runChecks(kind, input, { authorship: "coach" }), judge: verdict });
              const o = outcome(g);
              points.push({
                score: scored.score,
                hits: o.hits,
                n: o.n,
                rate: o.hits / o.n,
                coaches: g.coaches.size,
                campaigns: g.campaigns.size,
                text: g.text.slice(0, 600),
                criteria: Object.fromEntries(verdict.criteria.map((c) => [c.id, c.score])),
                interested: g.stats.interested,
              });
            } catch (err) {
              console.error(`  skipped one: ${err instanceof Error ? err.message : err}`);
            }
          }
        })
      );
      // Interest is what turns into calls, so it sits beside the first-step rate.
      const interestRate = (p: (typeof points)[number]) => (p.interested ?? 0) / Math.max(1, p.n);
      const perCriterion = Object.fromEntries(
        rubric.criteria.map((c) => [
          c.id,
          {
            rate: spearman(points.map((p) => p.criteria[c.id] ?? 0), points.map((p) => p.rate)),
            interest: spearman(points.map((p) => p.criteria[c.id] ?? 0), points.map(interestRate)),
          },
        ])
      );
      return {
        n: points.length,
        spearman: spearman(points.map((p) => p.score), points.map((p) => p.rate)),
        spearman_interest: spearman(points.map((p) => p.score), points.map(interestRate)),
        halves: splitHalves(points),
        halves_interest: splitHalves(points.map((p) => ({ score: p.score, hits: p.interested ?? 0, n: p.n }))),
        per_criterion: perCriterion,
        points,
      };
    };
    // Notes: acceptance and interest per invite. Follow-ups: replies and interest per accepted connection.
    summary.notes = await scoreGroups("campaign.connection", withNote, 100, (g) => ({ hits: g.stats.accepted, n: g.stats.invited }));
    summary.followups = await scoreGroups("campaign.followups", [...sequences.values()], 50, (g) => ({ hits: g.stats.replied, n: g.stats.accepted }));
  }

  await finishRun(runId, summary, cost);
  console.log(JSON.stringify({ ...summary, notes: summary.notes ? { ...(summary.notes as object), points: undefined } : undefined, followups: summary.followups ? { ...(summary.followups as object), points: undefined } : undefined }, null, 1));
  console.log(`\nRun ${runId}. Total $${cost.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
