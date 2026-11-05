import { resolveAnthropicModel } from "@/lib/anthropicModel";
import { resolveReference } from "@/lib/agent/context";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { changesText, sectionPrompt, writeSectionBlocks } from "@/lib/practiceKnowledge/buildSection";
import { ensureCoachLinkedIn } from "@/lib/practiceKnowledge/coachLinkedIn";
import { commentPage, pageChatKey } from "@/lib/practiceKnowledge/pageChat";
import { addSectionComment } from "@/lib/practiceKnowledge/sectionComments";
import { SECTION_SKILLS, writerContract } from "@/lib/practiceKnowledge/skills";
import { sourced } from "@/lib/practiceKnowledge/sourced";
import { ensurePracticeKnowledge, patchPracticeKnowledge, saveBuiltSection } from "@/lib/practiceKnowledge/store";
import type { BlueprintBlock, PracticeKnowledgePayload, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import {
  processDueSupportReplyEmails,
  queueSupportReplyEmailNotify,
} from "@/lib/support/notifyCoachOfReply";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { avaSectionsFor, avaWorkFor, fillableAnswer, missingLabel, scopeLabel, scopePage, type AvaMissing } from "./avaWork";
import { launchThread } from "./threads";

/**
 * Ava's Activity (job 172): Ava working for BCA on one Blueprint page
 * ("page:market") or launch job. Everything here is BCA-only until someone
 * presses Save or Send. Ava's drafts go into the coach's Blueprint on Save;
 * her messages go into the page's chat (or the job's) on Send, signed as Ava.
 * The job_key column holds the scope.
 */

export type ActivityKind = "note" | "ava" | "draft" | "message" | "answers" | "event";
export type ActivityStatus = "open" | "saved" | "sent" | "dismissed" | "replaced";

export type DraftSection = { key: string; title: string; blocks: BlueprintBlock[]; drafted_at: string };
export type AnswerFill = { path: string; label: string; value: string };

export type ActivityItem = {
  id: string;
  coach_id: string;
  job_key: string;
  kind: ActivityKind;
  body: string;
  payload: {
    sections?: DraftSection[];
    version?: number;
    /** What BCA asked Ava to change, for a redraft. */
    changes?: string;
    /** Sections that failed, by title. */
    failed?: string[];
    answers?: AnswerFill[];
    /** Missing answers a message asks for (paths). */
    asks?: string[];
  };
  status: ActivityStatus | null;
  edited: boolean;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

const SELECT = "id, coach_id, job_key, kind, body, payload, status, edited, created_by, created_at, resolved_at";

export async function listActivity(coachId: string, jobKey: string): Promise<ActivityItem[]> {
  const { data, error } = await supabaseAdmin
    .from("launch_job_activity")
    .select(SELECT)
    .eq("coach_id", coachId)
    .eq("job_key", jobKey)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityItem[];
}

async function add(item: {
  coachId: string;
  jobKey: string;
  kind: ActivityKind;
  body?: string;
  payload?: ActivityItem["payload"];
  status?: ActivityStatus | null;
  edited?: boolean;
  createdBy?: string | null;
}): Promise<ActivityItem> {
  const { data, error } = await supabaseAdmin
    .from("launch_job_activity")
    .insert({
      coach_id: item.coachId,
      job_key: item.jobKey,
      kind: item.kind,
      body: item.body ?? "",
      payload: item.payload ?? {},
      status: item.status ?? null,
      edited: item.edited ?? false,
      created_by: item.createdBy ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save to the activity.");
  return data as ActivityItem;
}

async function getItem(id: string): Promise<ActivityItem> {
  const { data, error } = await supabaseAdmin.from("launch_job_activity").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That item has gone.");
  return data as ActivityItem;
}

async function resolve(id: string, status: ActivityStatus, userId: string | null, patch: Partial<ActivityItem> = {}) {
  const { error } = await supabaseAdmin
    .from("launch_job_activity")
    .update({ ...patch, status, resolved_at: new Date().toISOString(), resolved_by: userId })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}

/** Close whatever of this kind is still open on the job: a newer one takes its place. */
async function replaceOpen(coachId: string, jobKey: string, kind: ActivityKind) {
  await supabaseAdmin
    .from("launch_job_activity")
    .update({ status: "replaced", resolved_at: new Date().toISOString() })
    .eq("coach_id", coachId)
    .eq("job_key", jobKey)
    .eq("kind", kind)
    .eq("status", "open");
}

async function openOf(coachId: string, jobKey: string, kind: ActivityKind): Promise<ActivityItem | null> {
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select(SELECT)
    .eq("coach_id", coachId)
    .eq("job_key", jobKey)
    .eq("kind", kind)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ActivityItem | null) ?? null;
}

async function coachFirstName(coachId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("profiles").select("first_name, full_name").eq("id", coachId).maybeSingle();
  return data?.first_name?.trim() || data?.full_name?.trim().split(/\s+/)[0] || "the coach";
}

function jobLabel(jobKey: string): string {
  return scopeLabel(jobKey);
}

// ---------------------------------------------------------------- drafting

/**
 * Draft these sections without saving, in waves: a section whose earlier
 * section is drafted in the same run reads that draft. Each wave runs side
 * by side.
 */
async function draftSections(
  coachId: string,
  keys: string[],
  opts: { changes?: string | null; base?: DraftSection[] } = {}
): Promise<{ sections: DraftSection[]; failed: string[] }> {
  if (keys.some((key) => writerContract(key).sources.has("linkedin"))) {
    await ensureCoachLinkedIn(coachId).catch(() => null);
  }
  let row: PracticeKnowledgeRow = await ensurePracticeKnowledge(coachId);
  const left = new Set(keys);
  const sections: DraftSection[] = [];
  const failed: string[] = [];
  const baseByKey = new Map((opts.base ?? []).map((s) => [s.key, s]));

  while (left.size) {
    const wave = [...left].filter((key) => !(sectionByKey(key)?.section.needs ?? []).some((need) => left.has(need)));
    if (!wave.length) break;
    const results = await Promise.all(
      wave.map(async (key) => {
        try {
          const { system, user, maxTokens } = await sectionPrompt(coachId, key, row);
          const base = baseByKey.get(key)?.blocks ?? null;
          const { blocks, error } = await writeSectionBlocks(key, {
            system,
            user: opts.changes?.trim() ? `${user}\n\n${changesText(opts.changes, base)}` : user,
            maxTokens,
          });
          if (!blocks.length) throw new Error(error || "came back empty");
          return { key, blocks };
        } catch {
          return { key, blocks: null };
        }
      })
    );
    const built = { ...row.built_sections };
    for (const result of results) {
      left.delete(result.key);
      const title = sectionByKey(result.key)?.section.title ?? result.key;
      if (!result.blocks) {
        failed.push(title);
        continue;
      }
      const drafted_at = new Date().toISOString();
      sections.push({ key: result.key, title, blocks: result.blocks, drafted_at });
      built[result.key] = { blocks: result.blocks, generated_at: drafted_at, model: resolveAnthropicModel(), edited_at: null };
    }
    row = { ...row, built_sections: built };
  }
  return { sections, failed };
}

/** "Run Ava": draft every section still to write in this job, as one draft to check. */
export async function runAva(coachId: string, jobKey: string, userId: string | null): Promise<ActivityItem> {
  const row = await ensurePracticeKnowledge(coachId);
  const work = avaWorkFor(jobKey, row);
  if (!work.toWrite.length) throw new Error("Nothing in this job for Ava to write.");
  const { sections, failed } = await draftSections(coachId, work.toWrite);
  if (!sections.length) throw new Error("Ava couldn't write this. Try again.");
  await replaceOpen(coachId, jobKey, "draft");
  return add({
    coachId,
    jobKey,
    kind: "draft",
    body: work.missing.length ? `Written with ${work.missing.length} thing${work.missing.length === 1 ? "" : "s"} missing.` : "",
    payload: { sections, version: 1, failed: failed.length ? failed : undefined },
    status: "open",
    createdBy: userId,
  });
}

/** A new version of the open draft with BCA's changes, only for the sections they're about. */
async function redraft(draft: ActivityItem, changes: string, keys: string[], userId: string | null): Promise<ActivityItem> {
  const current = draft.payload.sections ?? [];
  const { sections: fresh, failed } = await draftSections(draft.coach_id, keys, { changes, base: current });
  if (!fresh.length) throw new Error("Ava couldn't make that change. Try again.");
  const byKey = new Map(fresh.map((s) => [s.key, s]));
  await resolve(draft.id, "replaced", userId);
  return add({
    coachId: draft.coach_id,
    jobKey: draft.job_key,
    kind: "draft",
    body: draft.body,
    payload: {
      sections: current.map((s) => byKey.get(s.key) ?? s),
      version: (draft.payload.version ?? 1) + 1,
      changes,
      failed: failed.length ? failed : undefined,
    },
    status: "open",
    // Changed by BCA's notes, so it doesn't count as "saved as Ava wrote it".
    edited: true,
    createdBy: userId,
  });
}

// ---------------------------------------------------------------- saving

export async function saveDraft(id: string, userId: string | null): Promise<ActivityItem> {
  const draft = await getItem(id);
  if (draft.kind !== "draft" || draft.status !== "open") throw new Error("This draft isn't waiting any more.");
  const sections = draft.payload.sections ?? [];
  for (const section of sections) {
    await saveBuiltSection({
      coachId: draft.coach_id,
      key: section.key,
      section: { blocks: section.blocks, generated_at: new Date().toISOString(), model: resolveAnthropicModel(), edited_at: null },
    });
  }
  await resolve(id, "saved", userId);
  return add({
    coachId: draft.coach_id,
    jobKey: draft.job_key,
    kind: "event",
    body: `Saved ${sections.map((s) => s.title).join(", ")} to the Blueprint${draft.edited ? ", after changes" : ", as Ava wrote it"}. It's now with the coach to check.`,
    createdBy: userId,
  });
}

export async function dismiss(id: string, userId: string | null): Promise<void> {
  const item = await getItem(id);
  if (item.status !== "open") return;
  await resolve(id, "dismissed", userId);
}

// ---------------------------------------------------------------- talking to Ava

function rules(): string {
  const writing = resolveReference("ai-knowledge/writing-rules.md")?.text ?? "";
  const voice = resolveReference("agent/VOICE.md")?.text ?? "";
  return [voice && `# Your voice\n\n${voice}`, writing && `# Writing rules\n\n${writing}`].filter(Boolean).join("\n\n");
}

function draftText(draft: ActivityItem | null): string {
  if (!draft) return "(No draft open.)";
  return (draft.payload.sections ?? [])
    .map((s) => `### ${s.title} [${s.key}]\n\n${blocksToMarkdown(s.blocks).slice(0, 6_000)}`)
    .join("\n\n");
}

/**
 * BCA writes to Ava in the Activity tab. She answers, changes the open draft,
 * or drafts a message to the coach, whichever the note asks for.
 */
export async function talkToAva(coachId: string, jobKey: string, userId: string | null, text: string): Promise<void> {
  const note = text.trim().slice(0, 4_000);
  if (!note) throw new Error("Write something first.");
  await add({ coachId, jobKey, kind: "note", body: note, createdBy: userId });

  const [row, history, draft, name] = await Promise.all([
    ensurePracticeKnowledge(coachId),
    listActivity(coachId, jobKey),
    openOf(coachId, jobKey, "draft"),
    coachFirstName(coachId),
  ]);
  const work = avaWorkFor(jobKey, row);
  const talk = history
    .filter((i) => i.kind === "note" || i.kind === "ava")
    .slice(-12)
    .map((i) => `${i.kind === "note" ? "BCA" : "Ava"}: ${i.body}`)
    .join("\n");
  const sectionKeys = (draft?.payload.sections ?? []).map((s) => s.key);

  const system = `You are Ava, BCA's assistant, working on one part of a Profit Coach's Blueprint. Only BCA staff read this chat; the coach never sees it.

Reply with one JSON object:
{"action": "answer" | "redraft" | "message", "reply": "...", "sections": ["page:id"], "message": "..."}

- "redraft": BCA wants the open draft changed. List the section keys the change is about in "sections" (only keys from the open draft). "reply" says in one line what you're changing.
- "message": BCA wants you to message the coach. Put the message in "message", written to ${name}, under 80 words, one clear ask, no greeting fluff, no dashes as punctuation. "reply" says it's ready to check.
- "answer": anything else. Answer in "reply", under 100 words.

${rules()}`;

  const user = `Working on: ${jobLabel(jobKey)}
Sections Ava writes here and still to do: ${work.toWrite.map((k) => sectionByKey(k)?.section.title ?? k).join(", ") || "none"}
Missing before Ava can write: ${work.missing.map((m) => missingLabel(m, jobKey)).join(", ") || "nothing"}

## Open draft
${draftText(draft)}

## This chat so far
${talk}

Reply to BCA's last message now. JSON only.`;

  const { data } = await generateCampaignJson<{ action?: string; reply?: string; sections?: string[]; message?: string }>({
    system,
    user,
    maxTokens: 1200,
  });
  const reply = data?.reply?.trim() || "Sorry, I didn't catch that. Try again?";

  if (data?.action === "redraft" && draft) {
    const keys = (data.sections ?? []).filter((k) => sectionKeys.includes(k));
    await add({ coachId, jobKey, kind: "ava", body: reply, createdBy: null });
    await redraft(draft, note, keys.length ? keys : sectionKeys, userId);
    return;
  }
  if (data?.action === "message" && data.message?.trim()) {
    await add({ coachId, jobKey, kind: "ava", body: reply, createdBy: null });
    await replaceOpen(coachId, jobKey, "message");
    await add({ coachId, jobKey, kind: "message", body: data.message.trim(), status: "open", createdBy: null });
    return;
  }
  await add({ coachId, jobKey, kind: "ava", body: reply, createdBy: null });
}

// ---------------------------------------------------------------- the full Ava, working for BCA

/**
 * What the full Ava is told about a page's work when BCA talks to her there
 * (4 Nov: one Ava, the Ava tab and Activity in one): the sections BCA writes
 * and the skill for each, what's missing, and what's waiting for BCA.
 */
export async function activityBrief(coachId: string, jobKey: string): Promise<string[]> {
  const [row, items] = await Promise.all([ensurePracticeKnowledge(coachId), listActivity(coachId, jobKey)]);
  const work = avaWorkFor(jobKey, row);
  const toWrite = new Set(work.toWrite);
  const sections = avaSectionsFor(jobKey).map((key) => {
    const skill = SECTION_SKILLS[key];
    return `${sectionByKey(key)?.section.title ?? key} [${key}] ${toWrite.has(key) ? "to write" : "written"}${skill ? `, skill ${skillName(skill.file)}` : ""}`;
  });
  const lines: string[] = [];
  if (sections.length) lines.push(`Sections BCA writes on this page: ${sections.join("; ")}`);
  if (work.missing.length) lines.push(`Missing before they can be written: ${work.missing.map((m) => missingLabel(m, jobKey)).join(", ")}`);
  const waiting = items
    .filter((i) => i.status === "open")
    .map((i) =>
      i.kind === "draft"
        ? `Ava's draft (version ${i.payload.version ?? 1}) of ${(i.payload.sections ?? []).map((s) => `${s.title} [${s.key}]`).join(", ")}`
        : i.kind === "message"
          ? "a message to the coach, not sent yet"
          : i.kind === "answers"
            ? "answers from the coach's chat reply, to check"
            : null
    )
    .filter(Boolean);
  lines.push(`Waiting for BCA in the strip at the top of your panel: ${waiting.length ? waiting.join("; ") : "nothing"}`);
  return lines;
}

/** The open draft and message on a page, for the full Ava to read. */
export async function openWork(coachId: string, jobKey: string): Promise<{ draft: string | null; message: string | null }> {
  const [draft, message] = await Promise.all([openOf(coachId, jobKey, "draft"), openOf(coachId, jobKey, "message")]);
  return { draft: draft ? draftText(draft) : null, message: message?.body ?? null };
}

/** BCA asked the full Ava to change the waiting draft: a new version of the sections named (all, if none). */
export async function changeOpenDraft(
  coachId: string,
  jobKey: string,
  changes: string,
  keys: string[],
  userId: string | null
): Promise<ActivityItem> {
  const draft = await openOf(coachId, jobKey, "draft");
  if (!draft) throw new Error("No draft is waiting on this page.");
  const all = (draft.payload.sections ?? []).map((s) => s.key);
  const picked = keys.filter((k) => all.includes(k));
  return redraft(draft, changes.trim().slice(0, 4_000), picked.length ? picked : all, userId);
}

/** A message from Ava to the coach, waiting in the strip at the top of Ava's panel until BCA presses Send. */
export async function queueCoachMessage(coachId: string, jobKey: string, text: string): Promise<ActivityItem> {
  const body = text.trim().slice(0, 2_000);
  if (!body) throw new Error("The message is empty.");
  await replaceOpen(coachId, jobKey, "message");
  return add({ coachId, jobKey, kind: "message", body, status: "open", createdBy: null });
}

/**
 * BCA saved a draft Ava wrote in her chat (write_blueprint_section). Kept as a
 * saved draft on the section's page, so it counts in "saved as she wrote it"
 * like a draft from the Write button. Edited when BCA asked for changes first.
 */
export async function recordChatDraft(opts: {
  coachId: string;
  key: string;
  title: string;
  blocks: BlueprintBlock[];
  edited: boolean;
  userId: string | null;
}): Promise<void> {
  const page = opts.key === "linkedin:rewrite" ? "linkedin" : sectionByKey(opts.key)?.page.slug;
  if (!page) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("launch_job_activity").insert({
    coach_id: opts.coachId,
    job_key: `page:${page}`,
    kind: "draft",
    body: "Written in Ava's chat.",
    payload: { sections: [{ key: opts.key, title: opts.title, blocks: opts.blocks, drafted_at: now }], version: 1 },
    status: "saved",
    edited: opts.edited,
    created_by: opts.userId,
    resolved_at: now,
    resolved_by: opts.userId,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- the coach's chat

/** The job's chat thread for this coach, made when it's first needed. */
async function jobThreadId(coachId: string, jobKey: string): Promise<string> {
  const { data: found } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id")
    .eq("created_by", coachId)
    .eq("topic", jobKey)
    .maybeSingle();
  if (found?.id) return found.id as string;
  const thread = launchThread(jobKey);
  const { data, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .insert({
      created_by: coachId,
      source: "direct",
      type: thread?.type ?? "question",
      title: thread?.label ?? jobKey,
      details: thread?.hint ?? "",
      status: "open",
      topic: jobKey,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not open the job's chat.");
  return data.id as string;
}

type ChatLine = { body: string; created_at: string; created_by: string; as_ava: boolean };

async function chatLines(coachId: string, jobKey: string): Promise<{ threadId: string | null; lines: ChatLine[] }> {
  const slug = scopePage(jobKey);
  if (slug) {
    // A page's chat: every comment on the page, old section ones too.
    const { data } = await supabaseAdmin
      .from("practice_section_comments")
      .select("section_key, body, created_at, author_id, author_side")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true })
      .limit(1_000);
    const lines = (data ?? [])
      .filter((c) => commentPage(c.section_key as string) === slug)
      .map((c) => ({
        body: c.body as string,
        created_at: c.created_at as string,
        created_by: c.author_side === "coach" ? coachId : ((c.author_id as string | null) ?? "ava"),
        as_ava: c.author_side === "ava",
      }));
    return { threadId: null, lines };
  }
  const { data: thread } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id")
    .eq("created_by", coachId)
    .eq("topic", jobKey)
    .maybeSingle();
  if (!thread?.id) return { threadId: null, lines: [] };
  const { data } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("body, created_at, created_by, as_ava")
    .eq("report_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(200);
  return { threadId: thread.id as string, lines: (data ?? []) as ChatLine[] };
}

/**
 * How Ava's chasing stands on this job: chases sent since the coach last
 * wrote, whether she wrote to this coach today (any job), and the coach's
 * words since Ava last asked.
 */
export async function chaseState(coachId: string, jobKey: string) {
  const { lines } = await chatLines(coachId, jobKey);
  let chases = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].created_by === coachId) break;
    if (lines[i].as_ava) chases += 1;
  }
  const lastAva = [...lines].reverse().find((l) => l.as_ava) ?? null;
  const replies = lastAva ? lines.filter((l) => l.created_by === coachId && l.created_at > lastAva.created_at) : [];

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: threads } = await supabaseAdmin.from("community_feedback_reports").select("id").eq("created_by", coachId);
  const ids = (threads ?? []).map((t) => t.id as string);
  const [{ count }, { count: onPages }] = await Promise.all([
    ids.length
      ? supabaseAdmin
          .from("community_feedback_replies")
          .select("id", { count: "exact", head: true })
          .in("report_id", ids)
          .eq("as_ava", true)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
    supabaseAdmin
      .from("practice_section_comments")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .eq("author_side", "ava")
      .gte("created_at", since),
  ]);
  return { chases, sentToday: (count ?? 0) + (onPages ?? 0) > 0, replies: replies.map((r) => r.body) };
}

/** Ava drafts a message asking the coach for what's missing. BCA checks it before it goes. */
export async function askCoach(coachId: string, jobKey: string, userId: string | null): Promise<ActivityItem> {
  const [row, name] = await Promise.all([ensurePracticeKnowledge(coachId), coachFirstName(coachId)]);
  const work = avaWorkFor(jobKey, row);
  // Only what the coach fills in. BCA's own gaps are BCA's to fill.
  const asks: AvaMissing[] = work.missing.filter((m) => m.coach);
  if (!asks.length) throw new Error(`Nothing missing here is ${name}'s to fill in.`);
  const { data } = await generateCampaignJson<{ message?: string }>({
    system: `You are Ava, on the BCA team, writing to a new Profit Coach in the chat on their Blueprint. You are openly an AI assistant and BCA checks your messages.

Write one short message (under 80 words) that asks for exactly the things listed and nothing more, in everyday words a 12-year-old understands. Where a question is given, ask that question, not a broader one. Say why in half a line: we need it to write their ${jobLabel(jobKey)}. Make it easy: they can just reply here, in their own words. No greeting fluff, no sign-off (the chat shows your name). No dashes as punctuation.

Return JSON: {"message": "..."}

${rules()}`,
    user: `Coach's first name: ${name}
Working on: ${jobLabel(jobKey)}
What we still need from them:
${asks.map((m) => `- ${missingLabel(m, jobKey)}${m.ask ? `. Question: ${m.ask}` : ""}`).join("\n")}

JSON only.`,
    maxTokens: 600,
  });
  const message = data?.message?.trim();
  if (!message) throw new Error("Ava couldn't write the message. Try again.");
  await replaceOpen(coachId, jobKey, "message");
  return add({
    coachId,
    jobKey,
    kind: "message",
    body: message,
    payload: { asks: asks.map((m) => m.path ?? m.id) },
    status: "open",
    createdBy: userId,
  });
}

/** BCA approved Ava's message: it goes into the job's chat as Ava, and to the coach's email like any reply. */
export async function sendMessage(id: string, userId: string, body: string): Promise<ActivityItem> {
  const item = await getItem(id);
  if (item.kind !== "message" || item.status !== "open") throw new Error("This message isn't waiting any more.");
  const text = body.trim();
  if (!text) throw new Error("The message is empty.");
  const slug = scopePage(item.job_key);
  if (slug) {
    // Into the page's chat as Ava. Blueprint chats don't email yet: the coach sees it in their Blueprint.
    await addSectionComment({ coachId: item.coach_id, sectionKey: pageChatKey(slug), authorId: userId, side: "ava", body: text });
    await resolve(id, "sent", userId, { body: text, edited: item.edited || text !== item.body.trim() });
    return add({
      coachId: item.coach_id,
      jobKey: item.job_key,
      kind: "event",
      body: `Ava's message went into the ${jobLabel(item.job_key)} chat.`,
      createdBy: userId,
    });
  }
  const threadId = await jobThreadId(item.coach_id, item.job_key);
  const { error } = await supabaseAdmin
    .from("community_feedback_replies")
    .insert({ report_id: threadId, created_by: userId, body: text, as_ava: true });
  if (error) throw new Error(error.message);
  await resolve(id, "sent", userId, { body: text, edited: item.edited || text !== item.body.trim() });

  // Email, like any BCA reply, when the thread is set to notify.
  const { data: report } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("member_notify_email")
    .eq("id", threadId)
    .maybeSingle();
  let emailed = false;
  if (report?.member_notify_email !== false) {
    const queued = await queueSupportReplyEmailNotify(threadId).catch(() => null);
    if (queued?.ok) {
      const result = await processDueSupportReplyEmails(5, undefined, threadId).catch(() => null);
      emailed = Boolean(result?.sent);
    }
  }
  return add({
    coachId: item.coach_id,
    jobKey: item.job_key,
    kind: "event",
    body: `Ava's message went into the ${jobLabel(item.job_key)} chat${emailed ? " and by email" : ""}.`,
    createdBy: userId,
  });
}

/** The coach replied in the chat: Ava picks out the answers she asked for, for BCA to check. */
export async function fillFromReplies(coachId: string, jobKey: string, userId: string | null): Promise<ActivityItem> {
  const [row, state] = await Promise.all([ensurePracticeKnowledge(coachId), chaseState(coachId, jobKey)]);
  if (!state.replies.length) throw new Error("The coach hasn't replied since Ava asked.");
  const work = avaWorkFor(jobKey, row);
  const fields = work.missing
    .filter((m) => m.kind === "answer" && m.path && fillableAnswer(m.path))
    .map((m) => ({ path: m.path!, label: m.label }));
  if (!fields.length) throw new Error("None of the missing answers can be filled from a chat reply. Fill them in on the Blueprint.");
  const { data } = await generateCampaignJson<{ answers?: { path?: string; value?: string }[] }>({
    system: `You pick a coach's answers out of their chat messages. Use their own words; tidy only spelling and line breaks. Never add a fact they didn't say. Leave out any answer they didn't give.

Return JSON: {"answers": [{"path": "...", "value": "..."}]}`,
    user: `Answers we need:\n${fields.map((f) => `- ${f.path}: ${f.label}`).join("\n")}\n\nTheir messages:\n${state.replies.map((r) => `"""${r.slice(0, 4_000)}"""`).join("\n\n")}\n\nJSON only.`,
    maxTokens: 1500,
  });
  const byPath = new Map(fields.map((f) => [f.path, f.label]));
  const answers: AnswerFill[] = (data?.answers ?? [])
    .filter((a) => a.path && byPath.has(a.path) && a.value?.trim())
    .map((a) => ({ path: a.path!, label: byPath.get(a.path!)!, value: a.value!.trim() }));
  if (!answers.length) throw new Error("Ava couldn't find any of the missing answers in their reply.");
  await replaceOpen(coachId, jobKey, "answers");
  return add({ coachId, jobKey, kind: "answers", payload: { answers }, status: "open", createdBy: userId });
}

/** Put the checked answers into the coach's Blueprint, as theirs. */
export async function saveAnswers(id: string, userId: string | null, edits?: AnswerFill[]): Promise<ActivityItem> {
  const item = await getItem(id);
  if (item.kind !== "answers" || item.status !== "open") throw new Error("These answers aren't waiting any more.");
  const answers = (edits ?? item.payload.answers ?? []).filter((a) => a.value.trim() && fillableAnswer(a.path));
  if (!answers.length) throw new Error("No answers to save.");
  const patch: Record<string, Record<string, unknown>> = {};
  for (const a of answers) {
    const field = fillableAnswer(a.path)!;
    const [group, key] = a.path.split(".");
    const value =
      field.kind === "list"
        ? a.value
            .split("\n")
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter(Boolean)
        : a.value.trim();
    // "interview": the coach said it, so it counts as their own answer.
    (patch[group] ??= {})[key] = sourced(value, "interview");
  }
  await patchPracticeKnowledge({ coachId: item.coach_id, payloadPatch: patch as Partial<PracticeKnowledgePayload> });
  const changed = JSON.stringify(answers) !== JSON.stringify(item.payload.answers ?? []);
  await resolve(id, "saved", userId, { edited: changed, payload: { answers } });
  return add({
    coachId: item.coach_id,
    jobKey: item.job_key,
    kind: "event",
    body: `Put the coach's answers into the Blueprint: ${answers.map((a) => a.label).join(", ")}.`,
    createdBy: userId,
  });
}

// ---------------------------------------------------------------- across coaches

/** Saved as Ava wrote it, out of all saved drafts, per job, across every coach. */
export async function draftScores(): Promise<Record<string, { saved: number; asWritten: number }>> {
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select("job_key, edited")
    .eq("kind", "draft")
    .eq("status", "saved")
    .limit(5_000);
  const out: Record<string, { saved: number; asWritten: number }> = {};
  for (const row of data ?? []) {
    const score = (out[row.job_key as string] ??= { saved: 0, asWritten: 0 });
    score.saved += 1;
    if (!row.edited) score.asWritten += 1;
  }
  return out;
}

/** What's waiting for BCA, per coach and job: Ava's drafts, messages and answers still open. */
export async function openForCoaches(coachIds?: string[]): Promise<Record<string, Record<string, number>>> {
  let query = supabaseAdmin.from("launch_job_activity").select("coach_id, job_key").eq("status", "open").limit(5_000);
  if (coachIds) query = query.in("coach_id", coachIds);
  const { data } = await query;
  const out: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    const byJob = (out[row.coach_id as string] ??= {});
    byJob[row.job_key as string] = (byJob[row.job_key as string] ?? 0) + 1;
  }
  return out;
}

/** "connection-campaign/follow-ups.md" → "Connection campaign: follow ups". */
function skillName(file: string): string {
  const words = file
    .replace(/\.md$/, "")
    .split("/")
    .map((part) => part.replace(/-/g, " ").replace(/\blinkedin\b/gi, "LinkedIn"))
    .join(": ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A skill file Ava follows on this job, and the sections she writes with it. */
export type JobSkill = { id: string; name: string; sections: string[] };

/**
 * The skills Ava uses for this job's sections: each writer's method file and
 * its parts, as Admin → Ava lists them (practice-skills/...).
 */
export function jobSkills(jobKey: string): JobSkill[] {
  const out = new Map<string, JobSkill>();
  for (const key of avaSectionsFor(jobKey)) {
    const skill = SECTION_SKILLS[key];
    if (!skill) continue;
    const title = sectionByKey(key)?.section.title ?? key;
    for (const file of [skill.file, ...(skill.parts ?? [])]) {
      const id = `practice-skills/${file}`;
      const entry = out.get(id) ?? {
        id,
        name: skillName(file),
        sections: [],
      };
      if (!entry.sections.includes(title)) entry.sections.push(title);
      out.set(id, entry);
    }
  }
  return [...out.values()];
}
