import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import type { CoachHealthRow } from "@/lib/coachHealth";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgePayload } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { runChecks, type ArtifactInput } from "./checks";
import { numbered, stepTimings } from "./extract";
import { judge } from "./judge";
import { loadRubric } from "./rubrics";
import { combine, topFix } from "./score";
import { ARTIFACT_LABELS, bandFor, type ArtifactKind, type CheckResult, type JudgeResult, type ScoredArtifact } from "./types";

/**
 * Ava's audit of every active coach: their live LinkedIn profile and the
 * campaign messages they actually sent, scored with the same rubrics Ava is
 * held to. Read-only on coach data; writes scores to coach_quality_scores.
 */

export type AuditTarget = {
  coach_id: string;
  name: string;
  slug: string;
  sales_robot: boolean;
  discreet: boolean;
  who_they_help: string;
  snapshot: LinkedInProfileSnapshot | null;
  scraped_at: string | null;
};

export type AuditPiece = {
  coach_id: string | null;
  artifact: ArtifactKind;
  source_ref: string | null;
  source_at: string | null;
  text_scored: string | null;
  scored: ScoredArtifact | null;
  top_fix: string;
  /** Why there is no score (nothing to score, judge error). */
  note?: string;
  cost_usd: number;
};

const NOT_CONNECTION = /nurtur|reactivat|positive|interested|repl(y|ies)|re-?engage|follow.?up only/i;

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadAuditTargets(opts: { coachIds?: string[]; includeInactive?: boolean } = {}): Promise<AuditTarget[]> {
  const coaches = await all<{ id: string; slug: string; membership_status: string | null; record_kind: string | null; has_sales_robot_account: boolean | null }>((f, t) =>
    supabaseAdmin.from("coaches").select("id, slug, membership_status, record_kind, has_sales_robot_account").range(f, t)
  );
  const wanted = coaches.filter((c) =>
    opts.coachIds?.length
      ? opts.coachIds.includes(c.id)
      : opts.includeInactive || (["active", "past_due", "trialing"].includes(c.membership_status ?? "") && c.record_kind !== "historical")
  );
  const ids = wanted.map((c) => c.id);
  if (!ids.length) return [];
  const [profiles, linkedin, knowledge] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
    supabaseAdmin.from("coach_linkedin_profiles").select("coach_id, snapshot, scraped_at").in("coach_id", ids),
    supabaseAdmin.from("coach_practice_knowledge").select("coach_id, payload").in("coach_id", ids),
  ]);
  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const lpOf = new Map((linkedin.data ?? []).map((r) => [r.coach_id as string, r]));
  const kOf = new Map((knowledge.data ?? []).map((r) => [r.coach_id as string, r.payload as PracticeKnowledgePayload]));
  return wanted.map((c) => {
    const payload = kOf.get(c.id);
    const lp = lpOf.get(c.id);
    return {
      coach_id: c.id,
      name: nameOf.get(c.id) || c.slug,
      slug: c.slug,
      sales_robot: Boolean(c.has_sales_robot_account),
      discreet: textValue(payload?.identity?.linkedin_visibility ?? null) === "discreet",
      who_they_help: payload ? listValue(payload.market?.industries_credibility ?? null).join(", ") : "",
      snapshot: (lp?.snapshot as LinkedInProfileSnapshot | null) ?? null,
      scraped_at: (lp?.scraped_at as string | null) ?? null,
    };
  });
}

type Step = { campaign_id: string; position: number; step_type: string; body: string | null; wait_hours: number | null; updated_at: string };
type Campaign = { id: string; name: string; status: string; updated_at: string; leads: number };

export type CoachCampaigns = { connection: Campaign | null; connectionSteps: Step[]; nurture: Campaign | null; nurtureSteps: Step[]; sentAny: boolean };

/** The campaign that reached the most people (not a draft), and a nurture campaign if they run one. */
export async function loadCoachCampaigns(coachId: string): Promise<CoachCampaigns> {
  const { data: camps } = await supabaseAdmin.from("linkedin_campaigns").select("id, name, status, updated_at").eq("coach_id", coachId).neq("status", "draft");
  const list = (camps ?? []) as Omit<Campaign, "leads">[];
  if (!list.length) return { connection: null, connectionSteps: [], nurture: null, nurtureSteps: [], sentAny: false };
  const { data: stepRows } = await supabaseAdmin
    .from("linkedin_campaign_steps")
    .select("campaign_id, position, step_type, body, wait_hours, updated_at")
    .in(
      "campaign_id",
      list.map((c) => c.id)
    );
  const steps = (stepRows ?? []) as Step[];
  const withLeads: Campaign[] = await Promise.all(
    list.map(async (c) => {
      const { count } = await supabaseAdmin.from("linkedin_campaign_leads").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
      return { ...c, leads: count ?? 0 };
    })
  );
  const stepsOf = (id: string) => steps.filter((s) => s.campaign_id === id).sort((a, b) => a.position - b.position);
  const hasCopy = (id: string) => stepsOf(id).some((s) => (s.body ?? "").trim() && (s.step_type === "invite" || s.step_type === "message"));
  const ranked = withLeads.filter((c) => c.leads > 0 && hasCopy(c.id)).sort((a, b) => b.leads - a.leads);
  const connection = ranked.find((c) => !NOT_CONNECTION.test(c.name) && stepsOf(c.id).some((s) => s.step_type === "invite")) ?? null;
  const nurture = ranked.find((c) => /nurtur/i.test(c.name)) ?? null;
  return {
    connection,
    connectionSteps: connection ? stepsOf(connection.id) : [],
    nurture,
    nurtureSteps: nurture ? stepsOf(nurture.id) : [],
    sentAny: withLeads.some((c) => c.leads > 0),
  };
}

function currentRole(s: LinkedInProfileSnapshot) {
  return s.experiences.find((e) => !e.end || /present/i.test(e.end)) ?? s.experiences[0] ?? null;
}

async function scoreLive(opts: {
  target: AuditTarget | null;
  artifact: Exclude<ArtifactKind, "linkedin.basics">;
  input: ArtifactInput;
  context: string;
  source_ref: string | null;
  source_at: string | null;
}): Promise<AuditPiece> {
  const rubric = loadRubric(opts.artifact);
  const checks = runChecks(opts.artifact, opts.input, { authorship: "coach", discreet: opts.target?.discreet });
  try {
    const verdict = await judge({ rubric, piece: opts.input.text, context: opts.context });
    const scored = combine({ kind: opts.artifact, rubric, checks, judge: verdict });
    return {
      coach_id: opts.target?.coach_id ?? null,
      artifact: opts.artifact,
      source_ref: opts.source_ref,
      source_at: opts.source_at,
      text_scored: opts.input.text,
      scored,
      top_fix: topFix(scored),
      cost_usd: verdict.usage?.cost_usd ?? 0,
    };
  } catch (err) {
    return {
      coach_id: opts.target?.coach_id ?? null,
      artifact: opts.artifact,
      source_ref: opts.source_ref,
      source_at: opts.source_at,
      text_scored: opts.input.text,
      scored: null,
      top_fix: "",
      note: `Not scored: ${err instanceof Error ? err.message : "judge failed"}`,
      cost_usd: 0,
    };
  }
}

const gap = (target: AuditTarget, artifact: ArtifactKind, note: string, fix: string): AuditPiece => ({
  coach_id: target.coach_id,
  artifact,
  source_ref: null,
  source_at: null,
  text_scored: null,
  scored: null,
  top_fix: fix,
  note,
  cost_usd: 0,
});

function contextFor(target: AuditTarget, what: string): string {
  return [
    `This is ${target.name}'s own ${what}, live today. Score it against the rubric as written; do not assume a Blueprint exists.`,
    target.who_they_help ? `Who they say they help (from their Blueprint): ${target.who_they_help}.` : "",
    target.discreet ? "They are discreet (still employed), so the profile must not call them a coach." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function auditCoach(target: AuditTarget): Promise<AuditPiece[]> {
  const pieces: AuditPiece[] = [];
  const s = target.snapshot;
  if (!s) {
    pieces.push(gap(target, "linkedin.basics", "No LinkedIn profile imported.", "Import their LinkedIn profile (Settings → LinkedIn)."));
  } else {
    const basics = combine({ kind: "linkedin.basics", rubric: null, checks: runChecks("linkedin.basics", { text: "", snapshot: s }, { authorship: "coach" }), judge: null });
    pieces.push({
      coach_id: target.coach_id,
      artifact: "linkedin.basics",
      source_ref: s.publicIdentifier,
      source_at: target.scraped_at,
      text_scored: null,
      scored: basics,
      top_fix: topFix(basics),
      cost_usd: 0,
    });
    const jobs: Promise<AuditPiece>[] = [];
    const headline = (s.headline ?? "").trim();
    if (headline) jobs.push(scoreLive({ target, artifact: "linkedin.headline", input: { text: headline }, context: contextFor(target, "LinkedIn headline"), source_ref: s.publicIdentifier, source_at: target.scraped_at }));
    else pieces.push(gap(target, "linkedin.headline", "No headline.", "Write a headline: who they help and the result."));
    const about = (s.about ?? "").trim();
    if (about) jobs.push(scoreLive({ target, artifact: "linkedin.about", input: { text: about }, context: contextFor(target, "LinkedIn About"), source_ref: s.publicIdentifier, source_at: target.scraped_at }));
    else pieces.push(gap(target, "linkedin.about", "No About section.", "Write an About: the owner's problem, who it's for, how they help, proof, and a next step."));
    const role = currentRole(s);
    if (role) {
      const text = [role.title, role.description].filter((x) => (x ?? "").trim()).join("\n\n");
      jobs.push(scoreLive({ target, artifact: "linkedin.experience", input: { text }, context: contextFor(target, `current LinkedIn role at ${role.company ?? "their company"}`), source_ref: s.publicIdentifier, source_at: target.scraped_at }));
    } else pieces.push(gap(target, "linkedin.experience", "No current role.", "Add their coaching practice as the current role."));
    pieces.push(...(await Promise.all(jobs)));
  }

  const campaigns = await loadCoachCampaigns(target.coach_id);
  if (!campaigns.connection) {
    const note = campaigns.sentAny ? "No connection campaign with copy found." : "No campaign has sent through Get Clients.";
    const fix = target.sales_robot ? "Their campaigns run in Sales Robot, so BCA can't see the messages. Move their best campaign into Get Clients." : "Build and turn on their first connection campaign.";
    pieces.push(gap(target, "campaign.connection", note, fix), gap(target, "campaign.followups", note, fix));
  } else {
    const c = campaigns.connection;
    const ref = `${c.id}|${c.name}|${c.status}|${c.leads} people`;
    const invite = campaigns.connectionSteps.find((st) => st.step_type === "invite");
    const note = (invite?.body ?? "").trim();
    const jobs: Promise<AuditPiece>[] = [];
    if (note) jobs.push(scoreLive({ target, artifact: "campaign.connection", input: { text: note }, context: contextFor(target, `connection note from the campaign "${c.name}"`), source_ref: ref, source_at: invite?.updated_at ?? null }));
    else pieces.push(gap(target, "campaign.connection", `Invites in "${c.name}" go out blank (no note).`, "Test a proof-led note against blank invites with a BCA group test."));
    const messages = campaigns.connectionSteps.filter((st) => st.step_type === "message" && (st.body ?? "").trim()).map((st) => st.body!.trim());
    if (messages.length)
      jobs.push(
        scoreLive({
          target,
          artifact: "campaign.followups",
          input: { text: numbered(messages, stepTimings(campaigns.connectionSteps)), messages },
          context: contextFor(target, `follow-up messages from the campaign "${c.name}"`),
          source_ref: ref,
          source_at: campaigns.connectionSteps[campaigns.connectionSteps.length - 1]?.updated_at ?? null,
        })
      );
    else pieces.push(gap(target, "campaign.followups", `"${c.name}" has no follow-up messages.`, "Add three or four follow-ups that each give something."));
    pieces.push(...(await Promise.all(jobs)));
  }
  if (campaigns.nurture) {
    const c = campaigns.nurture;
    const messages = campaigns.nurtureSteps.filter((st) => st.step_type === "message" && (st.body ?? "").trim()).map((st) => st.body!.trim());
    if (messages.length)
      pieces.push(
        await scoreLive({
          target,
          artifact: "campaign.nurture",
          input: { text: numbered(messages, stepTimings(campaigns.nurtureSteps)), messages },
          context: contextFor(target, `nurture campaign "${c.name}"`),
          source_ref: `${c.id}|${c.name}|${c.status}|${c.leads} people`,
          source_at: null,
        })
      );
  } else pieces.push(gap(target, "campaign.nurture", "No nurture campaign running.", "Start the Ongoing nurture campaign for connections who said not now."));
  return pieces;
}

/** BCA's published library templates, scored once: every coach starts from these. */
export async function auditLibrary(): Promise<AuditPiece[]> {
  const { data: items } = await supabaseAdmin.from("campaign_library_items").select("id, name, kind, status").eq("status", "published");
  const { data: steps } = await supabaseAdmin
    .from("campaign_library_steps")
    .select("item_id, position, step_type, body, updated_at")
    .in(
      "item_id",
      (items ?? []).map((i) => i.id)
    );
  const pieces: AuditPiece[] = [];
  for (const item of items ?? []) {
    const own = (steps ?? []).filter((st) => st.item_id === item.id).sort((a, b) => a.position - b.position);
    const messages = own.filter((st) => st.step_type === "message" && (st.body ?? "").trim()).map((st) => String(st.body).trim());
    const invite = own.find((st) => st.step_type === "invite" && (st.body ?? "").trim());
    const ref = `library|${item.id}|${item.name}`;
    const context = `This is a template in BCA's campaign library ("${item.name}"). Coaches copy it and fill in their own details, so {{tokens}} are fine; judge whether the template sets them up to meet the rubric.`;
    if (invite) pieces.push(await scoreLive({ target: null, artifact: "campaign.connection", input: { text: String(invite.body).trim() }, context, source_ref: ref, source_at: invite.updated_at as string }));
    if (messages.length) {
      const artifact: Exclude<ArtifactKind, "linkedin.basics"> = item.kind === "nurture" ? "campaign.nurture" : item.kind === "positive_reply" ? "reply.draft" : "campaign.followups";
      const text = artifact === "reply.draft" ? messages[0]! : numbered(messages);
      pieces.push(
        await scoreLive({
          target: null,
          artifact,
          input: { text, messages },
          context: artifact === "reply.draft" ? `${context}\nSituation: the prospect showed interest. Next step BCA expects: send the BOSS Scorecard or offer a short call.` : context,
          source_ref: ref,
          source_at: null,
        })
      );
    }
  }
  return pieces;
}

// ------------------------------------------------------------ the coach's whole picture

export type Pillars = { profile: number | null; messaging: number | null; activity: number | null; results: number | null };

const PROFILE_WEIGHTS: Partial<Record<ArtifactKind, number>> = { "linkedin.basics": 0.3, "linkedin.headline": 0.15, "linkedin.about": 0.35, "linkedin.experience": 0.2 };
const MESSAGING_WEIGHTS: Partial<Record<ArtifactKind, number>> = { "campaign.connection": 0.4, "campaign.followups": 0.4, "campaign.nurture": 0.2 };

/** Missing profile pieces count as 0 (a prospect sees the gap); missing campaign pieces are left out (we may just not see them). */
function weighted(pieces: AuditPiece[], weights: Partial<Record<ArtifactKind, number>>, missingCountsAsZero: boolean): number | null {
  let total = 0;
  let w = 0;
  for (const [kind, weight] of Object.entries(weights) as [ArtifactKind, number][]) {
    const p = pieces.find((x) => x.artifact === kind);
    if (p?.scored) {
      total += p.scored.score * weight;
      w += weight;
    } else if (missingCountsAsZero && p && !p.note?.startsWith("Not scored")) {
      w += weight;
    }
  }
  return w ? Math.round((total / w) * 10) / 10 : null;
}

/**
 * Targets (from the 110k-invite review and the classroom): 100+ invites a
 * week, 30% acceptance, 10% of invites replying, 3% interested, a call a week.
 */
export const RESULT_TARGETS = { invitesPerMonth: 430, accept: 0.3, reply: 0.1, interested: 0.03, callsPerMonth: 4 };

export function activityScore(h: CoachHealthRow | undefined): number | null {
  if (!h) return null;
  if (h.sales_robot && h.invites_30d === 0) return null;
  return Math.round(Math.min(1, h.invites_30d / RESULT_TARGETS.invitesPerMonth) * 1000) / 10;
}

export function resultsScore(h: CoachHealthRow | undefined): number | null {
  if (!h || h.invites_30d < 50) return null;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const parts = [
    clamp((h.accept_rate ?? 0) / RESULT_TARGETS.accept),
    clamp(h.replies_30d / h.invites_30d / RESULT_TARGETS.reply),
    clamp(h.interested_30d / h.invites_30d / RESULT_TARGETS.interested),
    clamp(h.calls_30d / RESULT_TARGETS.callsPerMonth),
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 1000) / 10;
}

export function pillarsFor(pieces: AuditPiece[], health: CoachHealthRow | undefined): Pillars {
  // No imported profile means we don't know, not that it scores zero.
  const noProfile = pieces.some((p) => p.artifact === "linkedin.basics" && !p.scored);
  return {
    profile: noProfile ? null : weighted(pieces, PROFILE_WEIGHTS, true),
    messaging: weighted(pieces, MESSAGING_WEIGHTS, false),
    activity: activityScore(health),
    results: resultsScore(health),
  };
}

export function overall(p: Pillars): number | null {
  const xs = [p.profile, p.messaging, p.activity, p.results].filter((x): x is number => x != null);
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

/** The three fixes worth most: biggest gap on the heaviest piece first. */
export function topFixes(pieces: AuditPiece[]): { artifact: ArtifactKind; label: string; score: number | null; fix: string }[] {
  const weight = (k: ArtifactKind) => (PROFILE_WEIGHTS[k] ?? 0) + (MESSAGING_WEIGHTS[k] ?? 0);
  return pieces
    .filter((p) => p.top_fix && (!p.scored || p.scored.score < 85))
    .map((p) => ({ p, impact: weight(p.artifact) * (100 - (p.scored?.score ?? 0)) }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(({ p }) => ({ artifact: p.artifact, label: ARTIFACT_LABELS[p.artifact], score: p.scored?.score ?? null, fix: p.top_fix }));
}

/** A saved coach_quality_scores row back as a piece, for recomputing a summary without re-judging. */
export function pieceFromRow(r: Record<string, unknown>): AuditPiece {
  const judgeRaw = (r.judge ?? null) as (JudgeResult & { judge_score?: number | null; note?: string | null }) | { note?: string } | null;
  const judge = judgeRaw && "criteria" in judgeRaw ? (judgeRaw as JudgeResult) : null;
  const score = r.score == null ? null : Number(r.score);
  const hardFails = (r.hard_fails as string[] | null) ?? [];
  return {
    coach_id: r.coach_id as string,
    artifact: r.artifact as ArtifactKind,
    source_ref: (r.source_ref as string | null) ?? null,
    source_at: (r.source_at as string | null) ?? null,
    text_scored: (r.text_scored as string | null) ?? null,
    scored:
      score == null
        ? null
        : {
            kind: r.artifact as ArtifactKind,
            score,
            band: bandFor(score),
            passed: !hardFails.length && score >= 70,
            hardFails,
            checks: (r.checks as CheckResult[] | null) ?? [],
            judge,
            judgeScore: (judgeRaw as { judge_score?: number | null } | null)?.judge_score ?? null,
          },
    top_fix: (r.top_fix as string | null) ?? "",
    note: judgeRaw?.note ?? undefined,
    cost_usd: 0,
  };
}

export async function savePieces(runId: string, pieces: AuditPiece[]): Promise<void> {
  const rows = pieces
    .filter((p) => p.coach_id)
    .map((p) => ({
      run_id: runId,
      coach_id: p.coach_id,
      artifact: p.artifact,
      source_ref: p.source_ref,
      source_at: p.source_at,
      text_scored: p.text_scored,
      score: p.scored?.score ?? null,
      hard_fails: p.scored?.hardFails ?? [],
      checks: p.scored?.checks ?? [],
      judge: p.scored?.judge ? { ...p.scored.judge, judge_score: p.scored.judgeScore, note: p.note ?? null } : p.note ? { note: p.note } : null,
      top_fix: p.top_fix || null,
    }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabaseAdmin.from("coach_quality_scores").insert(rows.slice(i, i + 50));
    if (error) throw new Error(`Could not save audit scores: ${error.message}`);
  }
}
