import * as fs from "node:fs";
import * as path from "node:path";

import { formatThread, NEXT_STEP_LABELS, steerForNextStep, triageReply, type NextStep } from "@/lib/ava/replyTriage";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { buildLibraryContextText, buildVocabularyText, findLibraryMatch } from "@/lib/firstCampaign/loadCoachContext";
import { summarizeLinkedInSnapshot } from "@/lib/firstCampaign/linkedinSummary";
import { extractPainQuotes } from "@/lib/firstCampaign/researchMarketPains";
import { loadRewriteSystemPrompt } from "@/lib/linkedinProfileOptimizer/loadRewriteSystem";
import { buildRewriteUser } from "@/lib/linkedinProfileOptimizer/prompts";
import type { ProfileSectionId } from "@/lib/linkedinProfileOptimizer/types";
import { selectCopilotThreadWindow, type CopilotThreadMessage } from "@/lib/messaging/replyCopilot";
import { draftReplyFromParts } from "@/lib/messaging/replyDraft";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { blueprintContextFromRow } from "@/lib/practiceKnowledge/blueprintContext";
import { writeSectionBlocks } from "@/lib/practiceKnowledge/buildSection";
import { summarizeKnowledgeForPrompt } from "@/lib/practiceKnowledge/prompts";
import { SECTION_SKILLS, skillSystemPrompt, skillUserPrompt } from "@/lib/practiceKnowledge/skills";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import type { BuiltSection, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { runChecks, type ArtifactInput, type CheckContext } from "./checks";
import { connectionPieces, labelledReplies, numbered, sequenceMessages } from "./extract";
import { EVAL_COACHES, evalCoach, type EvalCoach } from "./fixtures/coaches";
import { REPLY_CASES, type ReplyCase } from "./fixtures/replies";
import { RESEARCH_CASES } from "./fixtures/research";
import { judge, JudgeError } from "./judge";
import { loadRubric } from "./rubrics";
import { combine, judgeScore } from "./score";
import { totalCost, withCapture, type CapturedCall } from "./usage";
import type { ArtifactKind, CheckResult, JudgeResult, ModelUsage } from "./types";

/**
 * Ava's eval suite. Each skill runs the production prompt builders on the
 * fictional coaches and labelled threads in ./fixtures, then scores what comes
 * back: code checks first, then the judge. Nothing is saved to a coach and
 * nothing is sent.
 */

export const SUITE_SKILLS = ["linkedin", "campaigns", "reply-triage", "reply-draft", "research", "judge-check"] as const;
export type SuiteSkill = (typeof SUITE_SKILLS)[number];

export type EvalRow = {
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
  trajectory: Record<string, unknown>;
  usage: ModelUsage[];
  cost_usd: number;
  error?: string;
};

export type SuiteOptions = {
  reps: number;
  concurrency: number;
  coaches?: EvalCoach["id"][];
  log: (line: string) => void;
};

// ------------------------------------------------------------ shared context

const CANON_FILES = [
  "content/practice-skills/_shared.md",
  "content/practice-skills/campaigns.md",
  "content/practice-skills/nurture.md",
  "content/practice-skills/replies.md",
  "content/practice-skills/linkedin-profile.md",
  "content/practice-skills/pain-points.md",
  "content/ai-knowledge/reply-copilot/shared-rules.md",
  "content/ai-knowledge/reply-copilot/booking-times.md",
  "content/agent/references/profit-system-pitch.md",
];

/** BCA's own method: any number in here (3-minute scorecard, 10% margin) is not an invention. */
export function canonText(): string {
  const situations = path.join(process.cwd(), "content/ai-knowledge/reply-copilot/situations");
  const files = [...CANON_FILES.map((f) => path.join(process.cwd(), f)), ...fs.readdirSync(situations).map((f) => path.join(situations, f))];
  return files
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n\n");
}

function linkedinSummary(c: EvalCoach): string {
  return summarizeLinkedInSnapshot(c.snapshot, { fullName: c.coachName, businessName: null });
}

/** What the writer knew about the coach: their answers, their LinkedIn, the older coach brain. */
export function coachFacts(c: EvalCoach): string {
  const brain = [
    c.brain.superpowers && `Superpowers: ${c.brain.superpowers}`,
    c.brain.ideal_client && `Ideal client: ${c.brain.ideal_client}`,
    ...(c.brain.client_results ?? []).map((r) => `Client result: ${r.title}: ${r.story}`),
  ].filter(Boolean);
  return [summarizeKnowledgeForPrompt(c.row.payload), linkedinSummary(c), brain.join("\n")].filter(Boolean).join("\n\n");
}

/** Facts for the judge's claims check: the coach's own facts plus what BCA already wrote for them. */
function judgeFacts(c: EvalCoach, row = c.row): string {
  return `${coachFacts(c)}\n\nEarlier sections BCA wrote for this coach (their target client, pains, voice, offer):\n${upstreamText(row).slice(0, 15000)}`;
}

function upstreamText(row: PracticeKnowledgeRow): string {
  return Object.entries(row.built_sections)
    .map(([key, s]) => `## ${key}\n${blocksToMarkdown(s.blocks, 3)}`)
    .join("\n\n");
}

/** A few lines on the coach for the judge, so "right for this coach" can be judged. */
function judgeContextFor(c: EvalCoach, extra?: string): string {
  const p = c.row.payload;
  const hobbies = [...listValue(p.practice.voice_hobbies), textValue(p.practice.voice_favourite_book), textValue(p.practice.voice_favourite_film)].filter(Boolean);
  return [
    `Coach: ${c.coachName}.`,
    c.discreet ? "Discreet: still employed, so LinkedIn copy must not call them a coach. Position them as an operator and adviser." : "Public: may say they are a business coach.",
    `Works in ${textValue(p.practice.min_fee).includes("$") ? "US dollars" : "pounds"}.`,
    `Who they help: ${listValue(p.market.industries_credibility).join(", ") || "(not set)"}.`,
    `Kind of coach: ${textValue(p.practice.voice_coaching_style) || "(not set)"}.`,
    `Books, films and hobbies they named: ${hobbies.join("; ") || "none (so none may appear)"}.`,
    extra ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

function checkContextFor(c: EvalCoach, canon: string, row = c.row): CheckContext {
  return { authorship: "ava", discreet: c.discreet, facts: coachFacts(c), upstream: upstreamText(row), canon };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

const usageOf = (calls: CapturedCall[]): ModelUsage[] =>
  calls.map(({ model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd, stop_reason, ms }) => ({
    model,
    input_tokens,
    output_tokens,
    cache_read_input_tokens,
    cache_creation_input_tokens,
    cost_usd,
    stop_reason,
    ms,
  }));

function errorRow(skill: string, caseId: string, rep: number, err: unknown, usage: ModelUsage[] = [], trajectory: Record<string, unknown> = {}): EvalRow {
  const truncated = err instanceof JudgeError && err.kind === "truncated";
  return {
    skill,
    case_id: caseId,
    rep,
    status: truncated ? "truncated" : "error",
    score: null,
    passed: null,
    hard_fails: [],
    checks: [],
    judge: null,
    metrics: {},
    output: null,
    trajectory,
    usage,
    cost_usd: totalCost(usage),
    error: err instanceof Error ? err.message : String(err),
  };
}

/** Code checks, then the judge, combined into one row. */
async function scorePiece(opts: {
  skill: ArtifactKind;
  caseId: string;
  rep: number;
  input: ArtifactInput;
  checkCtx: CheckContext;
  judgeContext: string;
  facts?: string;
  generation: CapturedCall[];
  trajectory?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}): Promise<EvalRow> {
  const rubric = loadRubric(opts.skill as Exclude<ArtifactKind, "linkedin.basics">);
  const checks = runChecks(opts.skill, opts.input, opts.checkCtx);
  const genUsage = usageOf(opts.generation);
  const trajectory = {
    ...opts.trajectory,
    generation: opts.generation.map((c) => ({ model: c.model, system_chars: c.system.length, user: c.user, output: c.output, stop_reason: c.stop_reason })),
  };
  try {
    const verdict = await judge({ rubric, piece: opts.input.text, context: opts.judgeContext, facts: opts.facts });
    const scored = combine({ kind: opts.skill, rubric, checks, judge: verdict, claimsGate: opts.facts !== undefined });
    const usage = [...genUsage, ...(verdict.usage ? [verdict.usage] : [])];
    return {
      skill: opts.skill,
      case_id: opts.caseId,
      rep: opts.rep,
      status: "scored",
      score: scored.score,
      passed: scored.passed,
      hard_fails: scored.hardFails,
      checks: scored.checks,
      judge: { criteria: verdict.criteria, claims: verdict.claims, summary: verdict.summary, top_fix: verdict.top_fix, model: verdict.model, usage: verdict.usage },
      metrics: { judge_score: scored.judgeScore, ...opts.metrics },
      output: opts.input.text,
      trajectory: { ...trajectory, judge: { user: verdict.user, raw: verdict.raw } },
      usage,
      cost_usd: totalCost(usage),
    };
  } catch (err) {
    return errorRow(opts.skill, opts.caseId, opts.rep, err, genUsage, trajectory);
  }
}

function reps(n: number): number[] {
  return Array.from({ length: Math.max(1, n) }, (_, i) => i);
}

// ------------------------------------------------------------ LinkedIn profile

const PROFILE_SECTIONS: { section: ProfileSectionId; kind: ArtifactKind }[] = [
  { section: "headline", kind: "linkedin.headline" },
  { section: "about", kind: "linkedin.about" },
  { section: "experience", kind: "linkedin.experience" },
];

type Variant = { label: string; text: string };

function pickRecommended(data: unknown): { recommended: Variant | null; all: Variant[] } {
  const rec = (data ?? {}) as { recommendedIndex?: number; variants?: unknown[] };
  const all = (Array.isArray(rec.variants) ? rec.variants : [])
    .map((v) => v as { label?: unknown; text?: unknown })
    .filter((v) => typeof v.text === "string" && v.text.trim())
    .map((v) => ({ label: String(v.label ?? ""), text: String(v.text).trim() }));
  const i = typeof rec.recommendedIndex === "number" && all[rec.recommendedIndex] ? rec.recommendedIndex : 0;
  return { recommended: all[i] ?? null, all };
}

async function runLinkedIn(opts: SuiteOptions, canon: string, coaches: EvalCoach[]): Promise<EvalRow[]> {
  const system = await loadRewriteSystemPrompt();
  const jobs = coaches.flatMap((c) => PROFILE_SECTIONS.flatMap((s) => reps(opts.reps).map((rep) => ({ c, s, rep }))));
  return mapPool(jobs, opts.concurrency, async ({ c, s, rep }) => {
    const caseId = `${c.id}/${s.section}`;
    const user = buildRewriteUser({
      section: s.section,
      snapshot: c.snapshot,
      draft: {},
      brain: c.brain,
      linkedInSummary: linkedinSummary(c),
      instruction: null,
      experienceIndex: 0,
      blueprint: blueprintContextFromRow(c.row),
    });
    const { result, calls } = await withCapture(() => generateCampaignJson({ system, user, maxTokens: s.section === "about" ? 3072 : 1536 }));
    const { recommended, all } = pickRecommended(result.data);
    if (!recommended) return errorRow(s.kind, caseId, rep, new Error(result.error || "No variants came back."), usageOf(calls));
    const ctx = checkContextFor(c, canon);
    // Every variant the coach can pick from must clear the gates, not just the recommended one.
    const variantGates = all.map((v) => runChecks(s.kind, { text: v.text }, ctx).filter((x) => x.level === "gate" && !x.passed).map((x) => x.id));
    opts.log(`  linkedin ${caseId} #${rep}`);
    return scorePiece({
      skill: s.kind,
      caseId,
      rep,
      input: { text: recommended.text },
      checkCtx: ctx,
      judgeContext: judgeContextFor(c, `This is the recommended ${s.section} option of ${all.length} Ava offered.`),
      facts: judgeFacts(c),
      generation: calls,
      metrics: { variants: all.length, variants_failing_gates: variantGates.filter((g) => g.length).length },
      trajectory: { variants: all },
    });
  });
}

// ------------------------------------------------------------ Blueprint campaigns

async function libraryFor(c: EvalCoach): Promise<string> {
  const industry = listValue(c.row.payload.market.industries_credibility)[0] ?? "";
  const row = industry ? await findLibraryMatch(industry).catch(() => null) : null;
  return [buildLibraryContextText(row), buildVocabularyText(row)].filter(Boolean).join("\n\n");
}

async function writeSection(c: EvalCoach, key: string, row: PracticeKnowledgeRow, library: string) {
  const system = skillSystemPrompt(key);
  if (!system) throw new Error(`No writer for ${key}`);
  const user = skillUserPrompt({ key, row, coachName: c.coachName, linkedinSummary: linkedinSummary(c), turns: [], decision: "", library });
  const { result, calls } = await withCapture(() => writeSectionBlocks(key, { system, user, maxTokens: SECTION_SKILLS[key]?.maxTokens ?? 4096 }));
  const { blocks } = result;
  const section: BuiltSection = { blocks, generated_at: new Date().toISOString(), model: calls[0]?.model ?? "", edited_at: null };
  return { section, calls, error: blocks.length ? null : result.error || "The section came back empty." };
}

async function runCampaigns(opts: SuiteOptions, canon: string, coaches: EvalCoach[]): Promise<EvalRow[]> {
  const jobs = coaches.flatMap((c) => reps(opts.reps).map((rep) => ({ c, rep })));
  const nested = await mapPool(jobs, Math.max(1, Math.floor(opts.concurrency / 2)), async ({ c, rep }) => {
    const rows: EvalRow[] = [];
    const library = await libraryFor(c);
    const ctx = checkContextFor(c, canon);
    const facts = judgeFacts(c);

    const messaging = await writeSection(c, "campaigns:messaging", c.row, library);
    if (messaging.error) {
      rows.push(errorRow("campaign.connection", `${c.id}/connection`, rep, new Error(messaging.error), usageOf(messaging.calls)));
    } else {
      const { note, followups } = connectionPieces(messaging.section);
      const markdown = blocksToMarkdown(messaging.section.blocks, 3);
      if (note) {
        rows.push(
          await scorePiece({
            skill: "campaign.connection",
            caseId: `${c.id}/connection`,
            rep,
            input: { text: note },
            checkCtx: ctx,
            judgeContext: judgeContextFor(c),
            facts,
            generation: messaging.calls,
            trajectory: { section: markdown },
          })
        );
      } else rows.push(errorRow("campaign.connection", `${c.id}/connection`, rep, new Error("No connection note under the sequence heading."), usageOf(messaging.calls)));
      if (followups.length) {
        rows.push(
          await scorePiece({
            skill: "campaign.followups",
            caseId: `${c.id}/followups`,
            rep,
            input: { text: numbered(followups), messages: followups },
            checkCtx: ctx,
            judgeContext: judgeContextFor(c, `The connection note these follow: ${note ?? "(none)"}`),
            facts,
            generation: [],
            metrics: { messages: followups.length },
          })
        );
      }
    }

    const nurture = await writeSection(c, "campaigns:nurture", c.row, library);
    if (nurture.error) rows.push(errorRow("campaign.nurture", `${c.id}/nurture`, rep, new Error(nurture.error), usageOf(nurture.calls)));
    else {
      const messages = sequenceMessages("campaigns:nurture", nurture.section);
      rows.push(
        await scorePiece({
          skill: "campaign.nurture",
          caseId: `${c.id}/nurture`,
          rep,
          input: { text: numbered(messages), messages },
          checkCtx: ctx,
          judgeContext: judgeContextFor(c),
          facts,
          generation: nurture.calls,
          metrics: { messages: messages.length },
          trajectory: { section: blocksToMarkdown(nurture.section.blocks, 3) },
        })
      );
    }

    // The replies section builds on the connection campaign it just wrote.
    const withMessaging: PracticeKnowledgeRow = messaging.error
      ? c.row
      : { ...c.row, built_sections: { ...c.row.built_sections, "campaigns:messaging": messaging.section } };
    const replies = await writeSection(c, "conversations:followup", withMessaging, library);
    if (replies.error) rows.push(errorRow("reply.draft", `${c.id}/replies`, rep, new Error(replies.error), usageOf(replies.calls)));
    else {
      const items = labelledReplies(replies.section.blocks);
      const replyFacts = `${judgeFacts(c, withMessaging)}\n\nMinimum fee: ${textValue(c.row.payload.practice.min_fee)}`;
      const replyCtx = { ...checkContextFor(c, canon, withMessaging), facts: `${coachFacts(c)}\n\nMinimum fee: ${textValue(c.row.payload.practice.min_fee)}` };
      const scored = await mapPool(items, 3, (item) =>
        scorePiece({
          skill: "reply.draft",
          caseId: `${c.id}/replies/${item.prospectSays.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`,
          rep,
          input: { text: item.body },
          checkCtx: replyCtx,
          judgeContext: judgeContextFor(
            c,
            `This is a saved reply in the coach's Blueprint for when a prospect says: "${item.prospectSays}". It must move to one next step and never quote below the minimum fee (${textValue(c.row.payload.practice.min_fee)}).`
          ),
          facts: replyFacts,
          generation: [],
        })
      );
      // Generation cost belongs to the section, so charge it once.
      if (scored[0]) {
        scored[0].usage = [...usageOf(replies.calls), ...scored[0].usage];
        scored[0].cost_usd = totalCost(scored[0].usage);
      }
      rows.push(...scored);
    }
    opts.log(`  campaigns ${c.id} #${rep}`);
    return rows;
  });
  return nested.flat();
}

// ------------------------------------------------------------ Replies (live)

function triageCorrect(c: ReplyCase, step: NextStep): { strict: boolean; lenient: boolean } {
  return { strict: step === c.step, lenient: step === c.step || (c.acceptable ?? []).includes(step) };
}

async function runTriage(opts: SuiteOptions): Promise<EvalRow[]> {
  const jobs = REPLY_CASES.flatMap((c) => reps(opts.reps).map((rep) => ({ c, rep })));
  return mapPool(jobs, opts.concurrency * 2, async ({ c, rep }) => {
    const { result, calls } = await withCapture(() => triageReply(c.thread));
    const usage = usageOf(calls);
    if (!result) return errorRow("reply.triage", c.id, rep, new Error("Triage returned nothing (API error or unparseable)."), usage);
    const { strict, lenient } = triageCorrect(c, result.nextStep);
    return {
      skill: "reply.triage",
      case_id: c.id,
      rep,
      status: "scored",
      score: strict ? 100 : 0,
      passed: strict,
      hard_fails: [],
      checks: [],
      judge: null,
      metrics: {
        group: c.group,
        expected: c.step,
        acceptable: c.acceptable ?? [],
        predicted: result.nextStep,
        lenient,
        disposition_expected: c.disposition,
        disposition_predicted: result.disposition,
        confidence: result.confidence,
        situation: result.situation,
        reason: result.reason,
      },
      output: JSON.stringify(result),
      trajectory: { thread: formatThread(c.thread), raw: calls[0]?.output ?? "" },
      usage,
      cost_usd: totalCost(usage),
    };
  });
}

async function runDrafts(opts: SuiteOptions, canon: string): Promise<EvalRow[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const [{ data: settings }, overrides] = await Promise.all([
    supabaseAdmin.from("reply_copilot_settings").select("system_prompt, model").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    loadBrandKnowledgeOverrides(),
  ]);
  const cases = REPLY_CASES.filter((c) => c.draft !== false);
  const jobs = cases.flatMap((c) => reps(opts.reps).map((rep) => ({ c, rep })));
  return mapPool(jobs, opts.concurrency, async ({ c, rep }) => {
    const coach = evalCoach(c.coach);
    const start = Date.now() - c.thread.length * 3_600_000;
    const thread: CopilotThreadMessage[] = c.thread.map((m, i) => ({
      id: String(i),
      channel: "linkedin",
      direction: m.direction,
      body_text: m.text,
      created_at: new Date(start + i * 3_600_000).toISOString(),
    }));
    const prospect = { name: c.prospect.name, company: c.prospect.company, title: c.prospect.title, bossScore: c.prospect.bossScore ?? null, replyDisposition: null };
    const { result, calls } = await withCapture(() =>
      draftReplyFromParts({
        apiKey,
        channel: "linkedin",
        coachName: coach.coachName,
        coachNotes: "",
        messages: selectCopilotThreadWindow(thread, "linkedin"),
        prospect,
        storedPrompt: typeof settings?.system_prompt === "string" ? settings.system_prompt : "",
        storedModel: typeof settings?.model === "string" ? settings.model : null,
        overrides,
        steer: steerForNextStep(c.step),
      })
    );
    if (!result.ok) return errorRow("reply.draft", `live/${c.id}`, rep, new Error(result.error), usageOf(calls));
    const threadText = formatThread(c.thread);
    const facts = `${threadText}\n\nProspect: ${prospect.name}, ${prospect.title}, ${prospect.company}${prospect.bossScore != null ? `, BOSS score ${prospect.bossScore}` : ""}\nCoach: ${coach.coachName}. No fee, results or notes were given to the copilot.`;
    opts.log(`  reply-draft ${c.id} #${rep}`);
    return scorePiece({
      skill: "reply.draft",
      caseId: `live/${c.id}`,
      rep,
      input: { text: result.suggestion },
      checkCtx: { authorship: "ava", expectedStep: c.step, forbidden: c.forbidden, facts, canon },
      judgeContext: `Situation: ${c.situation}.\nNext step BCA expects: ${NEXT_STEP_LABELS[c.step]}.\nThe copilot knew only the thread and the prospect's name, title and company. It had no fee, no results and no notes from the coach.\n\nTHREAD:\n${threadText}`,
      facts,
      generation: calls,
      metrics: { group: c.group, expected_step: c.step },
    });
  });
}

// ------------------------------------------------------------ Research

async function runResearch(opts: SuiteOptions): Promise<EvalRow[]> {
  const jobs = RESEARCH_CASES.flatMap((c) => reps(opts.reps).map((rep) => ({ c, rep })));
  return mapPool(jobs, opts.concurrency, async ({ c, rep }) => {
    const { result: quotes, calls } = await withCapture(() => extractPainQuotes(c.market, c.snippets));
    const text = quotes.map((q, i) => `${i + 1}. "${q.text}" (${q.sourceLabel}${q.url ? `, ${q.url}` : ""})`).join("\n");
    opts.log(`  research ${c.id} #${rep}`);
    return scorePiece({
      skill: "research.pains",
      caseId: c.id,
      rep,
      input: { text: text || "(no quotes)", quotes, snippets: c.snippets },
      checkCtx: { authorship: "ava" },
      judgeContext: `Target market: ${c.market.industry} (${c.market.roleTitles.join(", ")}), ${c.market.geography}.\n\nSNIPPETS AVA WAS GIVEN:\n${c.snippets.map((s, i) => `[${i}] ${s.source}: ${s.title}. ${s.body}`).join("\n")}`,
      generation: calls,
      metrics: { quotes: quotes.length, thin: Boolean(c.thin) },
    });
  });
}

// ------------------------------------------------------------ Judge check

const NULLS: { kind: Exclude<ArtifactKind, "linkedin.basics">; label: string; piece: string }[] = [
  { kind: "linkedin.headline", label: "empty", piece: "" },
  { kind: "linkedin.about", label: "dont-know", piece: "I don't know." },
  { kind: "campaign.connection", label: "off-topic", piece: "Preheat the oven to 180C. Mix the flour and sugar, then add two eggs and bake for 25 minutes." },
];

/**
 * Before trusting the judge: each rubric's strong example must score high and
 * its weak example low, and empty or off-topic pieces must fail.
 */
async function runJudgeCheck(opts: SuiteOptions): Promise<EvalRow[]> {
  const kinds = ["linkedin.headline", "linkedin.about", "linkedin.experience", "campaign.connection", "campaign.followups", "campaign.nurture", "reply.draft"] as const;
  const jobs: { kind: Exclude<ArtifactKind, "linkedin.basics">; label: string; piece: string; context?: string; expect: "high" | "low" }[] = [];
  for (const kind of kinds) {
    const rubric = loadRubric(kind);
    for (const [label, example] of [
      ["strong", rubric.examples.strong],
      ["weak", rubric.examples.weak],
    ] as const) {
      if (!example) continue;
      const situation = example.match(/^Situation:.*$/m)?.[0];
      jobs.push({ kind, label, piece: situation ? example.replace(situation, "").trim() : example, context: situation, expect: label === "strong" ? "high" : "low" });
    }
  }
  for (const n of NULLS) jobs.push({ ...n, expect: "low" });
  const all = jobs.flatMap((j) => reps(opts.reps).map((rep) => ({ ...j, rep })));
  return mapPool(all, opts.concurrency, async (j) => {
    const rubric = loadRubric(j.kind);
    try {
      const verdict = await judge({ rubric, piece: j.piece, context: j.context });
      const s = Math.round(judgeScore(rubric, verdict) * 10) / 10;
      const ok = j.expect === "high" ? s >= 70 : s <= 40;
      opts.log(`  judge-check ${j.kind}/${j.label} ${s} ${ok ? "ok" : "MISS"}`);
      const usage = verdict.usage ? [verdict.usage] : [];
      return {
        skill: "judge.check",
        case_id: `${j.kind}/${j.label}`,
        rep: j.rep,
        status: "scored",
        score: s,
        passed: ok,
        hard_fails: [],
        checks: [],
        judge: { criteria: verdict.criteria, claims: [], summary: verdict.summary, top_fix: verdict.top_fix, model: verdict.model, usage: verdict.usage },
        metrics: { expect: j.expect },
        output: j.piece,
        trajectory: { judge: { user: verdict.user, raw: verdict.raw } },
        usage,
        cost_usd: totalCost(usage),
      } satisfies EvalRow;
    } catch (err) {
      return errorRow("judge.check", `${j.kind}/${j.label}`, j.rep, err);
    }
  });
}

// ------------------------------------------------------------ entry

export async function runSuiteSkill(skill: SuiteSkill, opts: SuiteOptions): Promise<EvalRow[]> {
  const canon = canonText();
  const coaches = opts.coaches?.length ? EVAL_COACHES.filter((c) => opts.coaches!.includes(c.id)) : EVAL_COACHES;
  switch (skill) {
    case "linkedin":
      return runLinkedIn(opts, canon, coaches);
    case "campaigns":
      return runCampaigns(opts, canon, coaches);
    case "reply-triage":
      return runTriage(opts);
    case "reply-draft":
      return runDrafts(opts, canon);
    case "research":
      return runResearch(opts);
    case "judge-check":
      return runJudgeCheck(opts);
  }
}
