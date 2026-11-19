import { resolveReference } from "@/lib/agent/context";
import { loadOptimizerRow, PART_TITLES, saveLinkedIn } from "@/lib/agent/tools/blueprint";
import { buildSalesNavSearch } from "@/lib/agent/tools/prospects";
import { emptyDraft } from "@/lib/linkedinProfileOptimizer/draft";
import { loadProfileWriterInputs, rewriteProfilePart, WRITE_EVERY_PART } from "@/lib/linkedinProfileOptimizer/rewritePart";
import type { ProfileSectionId } from "@/lib/linkedinProfileOptimizer/types";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { ensureCoachPool } from "@/lib/leadLists/audienceLists";
import { BLUEPRINT_SECTIONS, fieldFilled, sectionByKey, type FieldSpec, type SectionRef } from "@/lib/practiceKnowledge/blueprint";
import { blueprintContextFromRow } from "@/lib/practiceKnowledge/blueprintContext";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { listOnboardingTranscripts, onboardingTranscriptText } from "@/lib/practiceKnowledge/ingestOnboarding";
import { summarizeKnowledgeForPrompt } from "@/lib/practiceKnowledge/prompts";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { PROSPECT_SEARCH_PLAYBOOK } from "@/lib/salesNavigator/prospectSearch/playbook";
import { resolveSalesNavRegion } from "@/lib/salesNavigator/regions";
import { startSalesNavImport } from "@/lib/salesNavigator/startImport";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { linkedInSearch } from "@/lib/unipile/client";
import { requireLiveLinkedInUnipileAccount } from "@/lib/unipile/linkedinSearchAccount";
import { salesNavUrlForUnipile } from "@/lib/unipile/linkedinSearchCursor";

import { avaWorkFor, fillableAnswer, missingFor, pageScope } from "./avaWork";
import { inputPrint, withOpenDrafts } from "./drafts";
import { whatNextMessage } from "./whatNext";
import {
  add,
  coachFirstName,
  getItem,
  openOf,
  queueCoachMessage,
  replaceOpen,
  resolve,
  runAva,
  saveDraft,
  type ActivityItem,
  type AnswerFill,
  type ProspectSearchDraft,
} from "./jobActivity";

/**
 * Ava works ahead by herself (16 Nov). As soon as what a piece needs is in,
 * she drafts it, BCA-only: the boxes BCA fills in (Your Ideal Client, Your
 * Offer), every written section, and the prospect lists. Nothing reaches the
 * coach until BCA releases it. Each release starts the next run.
 */

/** Where the prospect list is worked on: its own launch job. */
export const LIST_SCOPE = "lead-list";

/** People on a coach's list: aim for 1,000 to 2,500, and 800 at least where the market is thin. */
export const LIST_TARGET = { floor: 800, aim: 1_000, most: 2_500 };

/** The writing rules ban dashes as punctuation; the model still slips them in. */
function plain(text: string): string {
  return text
    .replace(/(\d)\s*–\s*(£?\d)/g, "$1 to $2")
    .replace(/\s+[—–-]\s+/g, ", ")
    .replace(/—/g, ", ")
    .trim();
}

function rules(): string {
  return resolveReference("ai-knowledge/writing-rules.md")?.text ?? "";
}

// ---------------------------------------------------------------- answers BCA fills in

/** The answer boxes BCA fills in on a page: From you sections outside About You, shown on the page. */
export function bcaAnswerFields(slug: string): { field: FieldSpec; ref: SectionRef }[] {
  return BLUEPRINT_SECTIONS.filter(
    (ref) =>
      ref.page.slug === slug &&
      !ref.group.yours &&
      ref.section.source === "from_you" &&
      ref.section.face !== "stored" &&
      !ref.section.retired
  ).flatMap((ref) =>
    (ref.section.fields ?? [])
      .filter((field) => !field.hidden && !field.showIf && fillableAnswer(field.path)?.path === field.path)
      .map((field) => ({ field, ref }))
  );
}

function emptyBoxes(slug: string, row: PracticeKnowledgeRow) {
  return bcaAnswerFields(slug).filter(({ field }) => !fieldFilled(row.payload, field));
}

/** Everything Ava knows about the coach, for filling boxes and planning lists. */
async function coachSources(coachId: string, row: PracticeKnowledgeRow): Promise<string> {
  const [linkedin, transcripts] = await Promise.all([
    loadCoachLinkedInSummary(coachId).catch(() => ({ summary: "" })),
    listOnboardingTranscripts(coachId).catch(() => []),
  ]);
  const options = row.built_sections["market:options"]?.blocks;
  return [
    `## What the coach told us, and what BCA has filled in\n\n${summarizeKnowledgeForPrompt(row.payload)}`,
    options?.length ? `## BCA's market options\n\n${blocksToMarkdown(options).slice(0, 4_000)}` : "",
    `## Their LinkedIn\n\n${linkedin.summary.slice(0, 6_000) || "(not imported)"}`,
    transcripts.length ? `## Calls and call notes\n\n${onboardingTranscriptText(transcripts)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Ava fills in the boxes BCA owns on one page (Your Ideal Client, Your Offer)
 * from Pam's call notes, the coach's answers and LinkedIn. A draft for BCA:
 * on release the answers go in as BCA's, for the coach to check.
 */
export async function draftPageAnswers(coachId: string, slug: string, userId: string | null): Promise<ActivityItem> {
  const row = await ensurePracticeKnowledge(coachId);
  const boxes = emptyBoxes(slug, row);
  if (!boxes.length) throw new Error("Every box BCA fills in on this page has an answer.");
  const [sources, name] = await Promise.all([coachSources(coachId, row), coachFirstName(coachId)]);

  const boxList = boxes
    .map(
      ({ field, ref }) =>
        `- path "${field.path}" | ${ref.section.title}: ${field.label} | ${field.kind === "list" ? "list, one item per line" : field.kind === "longtext" ? "a short paragraph" : "one line"}\n  What it is: ${field.help ?? ref.section.about ?? ""}\n  Shape only (never copy its content): ${field.example?.replace(/\n/g, " / ") ?? ""}${ref.section.tip ? `\n  BCA's standard: ${ref.section.tip}` : ""}`
    )
    .join("\n");

  const system = `You are Ava, BCA's assistant. You fill in boxes on a Profit Coach's Blueprint for the BCA team. BCA checks every answer before the coach sees it, then the coach checks it too.

Where to look, in this order:
1. Pam's notes from the Blueprint Call. They were agreed with the coach. Where a doc holds several versions, the last one wins. Where two docs disagree (for example the coach changed market), use the newest and say so in "thinking".
   Two strong cases for different markets (different industries, both well backed): pick the stronger one, with the most proof and the closest match to the coach's own career, and fill every box for that one market. Start "thinking" with "Two strong markets:", name both and say why you picked one, so BCA can overturn it.
2. The coach's own answers.
3. Their LinkedIn.
4. Call transcripts.

How to write each box:
- Follow what the box is for. Match the shape of its example, never its content.
- Lists: one item per line, strongest first, 3 to 7 lines, each under 15 words.
- "What they say and think" and "Objections": the owner's own words, first person, as they would say them out loud. Turn notes written about the owner into what the owner would say.
- "Less of" and "More of": plain words, from the owner's side.
- "Why you": second person ("You have..."), the coach's real proof only.
- "Who goes on your list": sectors as owners name their own business (words that work in a LinkedIn company search), size as "£1m to £10m, 11 to 50 staff", where as a country or region, job titles only beyond owner, founder, CEO and MD. "Leave out" is kinds of business only (franchises, big chains, competitors), never attitudes or how ready they are: those belong in the other boxes.
- Never invent a fact, number, price, client or result. Where a box has "BCA's standard" and no source gives the coach's own answer (price, guarantee, how they deliver), draft it from BCA's standard in the coach's words and set "from" to "BCA's standard, for the coach to change". Otherwise, if no source answers a box, leave it out and put it in "missing" with a one-line question for the coach.
- A guarantee never promises income or results the coach doesn't control.
- Never claim a result the coach's own answers or LinkedIn don't back up.
- Never leave anyone out for health, disability, age, gender or anything like it.

${rules()}

Reply with JSON only:
{"thinking": "2 or 3 short sentences for BCA, under 60 words, everyday words: what you used, anything that disagreed, anything to check before release",
 "answers": [{"path": "...", "value": "...", "from": "short source, e.g. Pam's avatar doc"}],
 "missing": [{"path": "...", "ask": "..."}]}`;

  const user = `Coach: ${name}

## Boxes to fill
${boxList}

${sources}

Fill the boxes now. JSON only.`;

  const { data } = await generateCampaignJson<{
    thinking?: string;
    answers?: { path?: string; value?: string; from?: string }[];
    missing?: { path?: string; ask?: string }[];
  }>({ system, user, maxTokens: 6_000 });

  const byPath = new Map(boxes.map((b) => [b.field.path, b.field]));
  const answers: AnswerFill[] = (data?.answers ?? [])
    .filter((a) => a.path && byPath.has(a.path as FieldSpec["path"]) && a.value?.trim())
    .map((a) => ({
      path: a.path!,
      label: byPath.get(a.path as FieldSpec["path"])!.label,
      value: plain(a.value!),
      from: a.from?.trim() || undefined,
    }));
  if (!answers.length) throw new Error("Ava couldn't fill these boxes from what we have.");
  const missing = (data?.missing ?? [])
    .filter((m) => m.path && byPath.has(m.path as FieldSpec["path"]) && !answers.some((a) => a.path === m.path))
    .map((m) => ({ path: m.path!, label: byPath.get(m.path as FieldSpec["path"])!.label, ask: m.ask?.trim() || "" }));

  const jobKey = pageScope(slug);
  await replaceOpen(coachId, jobKey, "answers");
  return add({
    coachId,
    jobKey,
    kind: "answers",
    payload: { answers, by: "ava", thinking: data?.thinking?.trim() || undefined, missing: missing.length ? missing : undefined },
    status: "open",
    createdBy: userId,
  });
}

// ---------------------------------------------------------------- prospect lists

/** People already in the coach's Pool. */
async function poolSize(coachId: string): Promise<number> {
  const pool = await ensureCoachPool(coachId).catch(() => null);
  if (!pool) return 0;
  const { count } = await supabaseAdmin.from("coach_lead_list_items").select("id", { count: "exact", head: true }).eq("list_id", pool.id);
  return count ?? 0;
}

/** How many people LinkedIn says a search finds, through the coach's own account. Null when we can't ask. */
async function searchSize(accountId: string | null, url: string): Promise<number | null> {
  if (!accountId) return null;
  const res = await linkedInSearch({ account_id: accountId, url: salesNavUrlForUnipile(url), limit: 1, timeoutMs: 20_000 }).catch(() => null);
  const n = res?.ok ? (res.data?.paging?.total_count ?? null) : null;
  return typeof n === "number" ? n : null;
}

/** What the lists read: the list box and the job titles. */
function listPrint(row: PracticeKnowledgeRow): string {
  const paths = (sectionByKey("market:list")?.section.fields ?? []).map((f) => f.path as string);
  return inputPrint(row, { paths: [...paths, "market.buyer_roles"] });
}

/** The list box is filled in: Ava has something to search for. */
export function listBoxReady(row: PracticeKnowledgeRow): boolean {
  return listValue(row.payload.market.list_sectors).length > 0;
}

/**
 * Ava plans the prospect lists (16 Nov): her thinking, then separate Sales
 * Navigator searches by sub-sector and size band (Paul Hamnett's way), with
 * what LinkedIn says each one finds. BCA ticks, changes, then "Import it".
 */
export async function draftProspectSearches(coachId: string, userId: string | null, changes?: string): Promise<ActivityItem> {
  const row = await withOpenDrafts(coachId, await ensurePracticeKnowledge(coachId));
  if (!listBoxReady(row)) throw new Error("Fill in Who goes on your list first (Your Ideal Client).");
  const [sources, inPool, previous, { data: profile }] = await Promise.all([
    coachSources(coachId, row),
    poolSize(coachId),
    openOf(coachId, LIST_SCOPE, "searches"),
    supabaseAdmin.from("profiles").select("location").eq("id", coachId).maybeSingle(),
  ]);
  const where = textValue(row.payload.market.list_where) || (profile?.location as string | null) || "United Kingdom";
  const region = resolveSalesNavRegion(where)?.text ?? "United Kingdom";
  const accountId = await requireLiveLinkedInUnipileAccount(coachId).catch(() => null);

  const system = `You are Ava, BCA's assistant. You plan a Profit Coach's prospect lists for LinkedIn Sales Navigator, for the BCA team to check before anything is imported.

The base search is added for you on every list: 2nd and 3rd degree connections, ${region}, owner job titles (owner, founder, co-founder, CEO, managing director, managing partner), and coaches, consultants and recruiters left out.

What a good plan looks like:
- 2 to 5 separate lists. Split by sub-sector and by size band, so each list is clean and the coach can see what's in it. Example (Paul Hamnett, gyms): "Gyms, 11 to 200 staff", "Gyms, 1 to 10 staff", "Padel, tennis and squash clubs".
- Aim for ${LIST_TARGET.aim.toLocaleString("en-GB")} to ${LIST_TARGET.most.toLocaleString("en-GB")} people in total. ${LIST_TARGET.floor} is the least for a thin market. LinkedIn shows at most 2,500 a search, so split a bigger one.
- Many owners never link their staff to the company page, so a 30-person firm often shows as 1 to 10. Add a 1 to 10 list when the market is thin, as its own list.
- Team sizes allowed: "1-10", "11-50", "51-200", "201-500".
- Company-name words first (how owners name their own business). Keywords only when owners don't name their business that way. Never both in one list. At most 8 words a list, quotes round phrases, no loose words many firms use (solutions, services, group, systems).
- Leave out what the coach's list box says to leave out, as company words to exclude.
- Extra job titles only when the list box names them.

Method:
${PROSPECT_SEARCH_PLAYBOOK}

${rules()}

Reply with JSON only:
{"thinking": "3 to 5 short sentences for BCA in everyday words: who you're going after and why, how the lists add up to the target, and what you're leaving out",
 "lists": [{"label": "under 6 words", "why": "one sentence, under 20 words", "companyIncludes": [], "keywords": null, "companyExcludesExtra": [], "titleIncludesExtra": [], "teamSizes": ["11-50"]}]}`;

  const user = `${sources}

People already in their Pool: ${inPool.toLocaleString("en-GB")}.
${previous?.payload.searches?.length ? `\nYour last plan:\n${previous.payload.searches.map((s) => `- ${s.label}: ${s.size ?? "?"} people`).join("\n")}\n` : ""}${changes?.trim() ? `\nBCA asked for this change: ${changes.trim()}\n` : ""}
Plan the lists now. JSON only.`;

  const { data } = await generateCampaignJson<{
    thinking?: string;
    lists?: {
      label?: string;
      why?: string;
      companyIncludes?: string[];
      keywords?: string | null;
      companyExcludesExtra?: string[];
      titleIncludesExtra?: string[];
      teamSizes?: string[];
    }[];
  }>({ system, user, maxTokens: 4_000 });

  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) : []);
  const built: Omit<ProspectSearchDraft, "size">[] = [];
  for (const [i, list] of (data?.lists ?? []).slice(0, 5).entries()) {
    const keywords = list.keywords?.trim() || "";
    const companyIncludes = keywords ? [] : strings(list.companyIncludes);
    if (!keywords && !companyIncludes.length) continue;
    const search = buildSalesNavSearch({
      location: region,
      companyIncludes,
      companyExcludesExtra: strings(list.companyExcludesExtra),
      keywords,
      titleIncludesExtra: strings(list.titleIncludesExtra),
      teamSizes: strings(list.teamSizes).filter((s) => ["1-10", "11-50", "51-200", "201-500"].includes(s)),
      degrees: ["2", "3"],
    });
    if ("error" in search) continue;
    built.push({ id: `list-${i + 1}`, label: list.label?.trim() || `List ${i + 1}`, why: list.why?.trim() || "", url: search.url, on: true });
  }
  if (!built.length) throw new Error("Ava couldn't plan a search from this. Try again.");
  const sized = await Promise.all(built.map(async (s) => ({ ...s, size: await searchSize(accountId, s.url) })));
  // Ava plans before she knows the sizes: tick lists in her order until the next would take the total past 2,500.
  let total = 0;
  const searches: ProspectSearchDraft[] = sized.map((s) => {
    if (s.size === null) return s;
    const people = Math.min(s.size, 2_500);
    const on = total === 0 || total + people <= LIST_TARGET.most;
    if (on) total += people;
    return { ...s, on };
  });

  await replaceOpen(coachId, LIST_SCOPE, "searches");
  return add({
    coachId,
    jobKey: LIST_SCOPE,
    kind: "searches",
    body: accountId ? "" : "Their LinkedIn isn't connected, so sizes are unknown and nothing can import yet.",
    payload: {
      searches,
      thinking: data?.thinking?.trim() || undefined,
      changes: changes?.trim() || undefined,
      version: (previous?.payload.version ?? 0) + 1,
      inputs: listPrint(row),
    },
    status: "open",
    edited: Boolean(changes?.trim()),
    createdBy: userId,
  });
}

/**
 * "Import it": the ticked lists go into the coach's Pool through their own
 * LinkedIn. One import runs at a time per coach (a new one replaces a running
 * one), so the first starts now and the rest wait for continueListImports.
 */
export async function importSearches(id: string, userId: string | null, picks?: { id: string; on: boolean }[]): Promise<ActivityItem> {
  const item = await getItem(id);
  if (item.kind !== "searches" || item.status !== "open") throw new Error("These searches aren't waiting any more.");
  const chosen = new Map((picks ?? []).map((p) => [p.id, p.on]));
  const searches = (item.payload.searches ?? []).map((s) => ({ ...s, on: chosen.get(s.id) ?? s.on }));
  const toImport = searches.filter((s) => s.on);
  if (!toImport.length) throw new Error("Tick at least one list to import.");
  const first = toImport[0];
  const started = await startSalesNavImport(item.coach_id, { salesNavUrl: first.url, name: first.label, saveListName: first.label });
  const edited = searches.some((s, i) => s.on !== (item.payload.searches ?? [])[i]?.on);
  await resolve(id, "saved", userId, {
    edited: item.edited || edited,
    payload: { ...item.payload, searches, imported: [{ label: first.label, list: started.saveList.id as string }] },
  });
  return add({
    coachId: item.coach_id,
    jobKey: item.job_key,
    kind: "event",
    body: `Importing ${toImport.map((s) => s.label).join(", ")} into their Pool, one list at a time. The coach checks the list once it's in.`,
    createdBy: userId,
  });
}

/** Every minute (the import tick): start the next ticked list for coaches whose last import has finished. */
export async function continueListImports(): Promise<number> {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select("id, coach_id, payload")
    .eq("kind", "searches")
    .eq("status", "saved")
    .gte("resolved_at", since)
    .limit(50);
  let started = 0;
  for (const row of (data ?? []) as Pick<ActivityItem, "id" | "coach_id" | "payload">[]) {
    const imported = row.payload.imported ?? [];
    const next = (row.payload.searches ?? []).filter((s) => s.on)[imported.length];
    if (!next) continue;
    const { count } = await supabaseAdmin
      .from("sales_nav_import_runs")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", row.coach_id)
      .in("status", ["pending", "running"]);
    if (count) continue;
    try {
      const run = await startSalesNavImport(row.coach_id, { salesNavUrl: next.url, name: next.label, saveListName: next.label });
      await supabaseAdmin
        .from("launch_job_activity")
        .update({ payload: { ...row.payload, imported: [...imported, { label: next.label, list: run.saveList.id as string }] } })
        .eq("id", row.id);
      started += 1;
    } catch (err) {
      console.error("continue list import:", err instanceof Error ? err.message : "failed");
    }
  }
  return started;
}

// ---------------------------------------------------------------- LinkedIn profile

const LINKEDIN_SCOPE = "page:linkedin";

/** The profile can be written once the Ideal Client is in and the voice guide is written. */
function linkedInReady(row: PracticeKnowledgeRow): boolean {
  const idealClient = bcaAnswerFields("market").filter(({ field }) => field.required);
  return Boolean(row.built_sections["voice:sound"]) && idealClient.every(({ field }) => fieldFilled(row.payload, field));
}

/** What the profile reads from the Blueprint: the voice guide and the Ideal Client boxes. */
function linkedInPrint(row: PracticeKnowledgeRow): string {
  return inputPrint(row, { built: ["voice:sound"], paths: bcaAnswerFields("market").map(({ field }) => field.path as string) });
}

/**
 * Ava writes the whole LinkedIn profile (every part, the same writer as the
 * LinkedIn page's "Write every part"), as a draft for BCA. Release puts it in
 * the coach's LinkedIn editor, where they copy it across.
 */
export async function draftLinkedInProfile(coachId: string, userId: string | null): Promise<ActivityItem> {
  const [loaded, row] = await Promise.all([
    loadProfileWriterInputs(coachId, {}),
    ensurePracticeKnowledge(coachId).then((raw) => withOpenDrafts(coachId, raw)),
  ]);
  // The writer reads the Blueprint with Ava's open drafts in, so it can follow the voice guide and Ideal Client before they're released.
  const inputs = { ...loaded, blueprint: blueprintContextFromRow(row) };
  if (!inputs.snapshot) throw new Error("Their LinkedIn isn't imported yet, so there's nothing to rewrite.");
  const snapshot = inputs.snapshot;
  const written = await Promise.all(
    WRITE_EVERY_PART.map(async (part) => {
      const variants = await rewriteProfilePart({ ...inputs, snapshot }, { section: part, draft: inputs.draft }).catch(() => []);
      return [part, (variants.find((v) => v.recommended) ?? variants[0])?.text?.trim() ?? ""] as const;
    })
  );
  const parts: Record<string, string> = {};
  for (const [part, text] of written) if (text) parts[part] = text;
  if (!Object.keys(parts).length) throw new Error("The profile writer came back empty. Try again.");
  const blocks = Object.entries(parts).flatMap(([part, text]) => [
    { type: "heading" as const, text: PART_TITLES[part as ProfileSectionId] ?? part },
    { type: "paragraph" as const, text },
  ]);
  const missed = WRITE_EVERY_PART.filter((part) => !parts[part]).map((part) => PART_TITLES[part]);
  await replaceOpen(coachId, LINKEDIN_SCOPE, "draft");
  return add({
    coachId,
    jobKey: LINKEDIN_SCOPE,
    kind: "draft",
    body: missed.length ? `Not written: ${missed.join(", ")}.` : "",
    payload: {
      sections: [{ key: "linkedin:rewrite", title: "Your LinkedIn profile", blocks, drafted_at: new Date().toISOString() }],
      linkedinParts: parts,
      version: 1,
      inputs: linkedInPrint(row),
    },
    status: "open",
    createdBy: userId,
  });
}

/** Release: a LinkedIn profile goes into the LinkedIn editor, everything else into the Blueprint. */
export async function releaseDraft(id: string, userId: string | null): Promise<ActivityItem> {
  const draft = await getItem(id);
  return draft.payload.linkedinParts ? releaseLinkedInDraft(id, userId) : saveDraft(id, userId);
}

/** Release of a LinkedIn draft: into the coach's LinkedIn editor, then the what-next message. */
export async function releaseLinkedInDraft(id: string, userId: string | null): Promise<ActivityItem> {
  const draft = await getItem(id);
  if (draft.kind !== "draft" || draft.status !== "open" || !draft.payload.linkedinParts) throw new Error("This draft isn't waiting any more.");
  await saveLinkedIn(draft.coach_id, draft.payload.linkedinParts as Partial<Record<ProfileSectionId, string>>);
  await resolve(id, "saved", userId);
  const event = await add({
    coachId: draft.coach_id,
    jobKey: draft.job_key,
    kind: "event",
    body: `Released the LinkedIn profile to their LinkedIn page${draft.edited ? ", after changes" : ", as Ava wrote it"}.`,
    createdBy: userId,
  });
  const text = whatNextMessage("linkedin", await coachFirstName(draft.coach_id));
  if (text) await queueCoachMessage(draft.coach_id, draft.job_key, text).catch(() => null);
  return event;
}

// ---------------------------------------------------------------- one run for a coach

/**
 * Ava writes when she has what she needs, or when the only gaps are the
 * coach's own answers (16 Nov: a missing About You box never blocks; her
 * draft says what was missing). A section still to be written elsewhere
 * does block: campaigns can't be written without the pain points.
 */
function writable(scope: string, row: PracticeKnowledgeRow): string[] {
  let keys = avaWorkFor(scope, row).toWrite;
  // Drop each section that's blocked, then anything that needed it, until nothing changes.
  for (let changed = true; changed; ) {
    const writing = new Set(keys);
    const next = keys.filter((key) => missingFor([key], row, writing).every((m) => m.kind === "answer" && m.coach));
    changed = next.length !== keys.length;
    keys = next;
  }
  return keys;
}

// ---------------------------------------------------------------- the launch chain

/**
 * The launch chain (18 Nov): what a coach needs to launch, in order. Each
 * step starts once what it reads is drafted, not released, so one run fills
 * the chain for BCA to check top to bottom. Offer, Content, Reactivation and
 * the pitch are off until they're dialled in.
 */
export type ChainStep = { id: string; label: string; scope: string; kind: ActivityItem["kind"]; sections?: string[] };

export const LAUNCH_CHAIN: ChainStep[] = [
  { id: "ideal-client", label: "Ideal Client boxes", scope: pageScope("market"), kind: "answers" },
  { id: "voice", label: "Voice guide", scope: pageScope("about"), kind: "draft", sections: ["voice:sound"] },
  {
    id: "market",
    label: "Market options, walkthrough and pain points",
    scope: pageScope("market"),
    kind: "draft",
    sections: ["market:options", "market:avatar", "market:pains"],
  },
  { id: "linkedin", label: "LinkedIn profile", scope: LINKEDIN_SCOPE, kind: "draft" },
  { id: "lists", label: "Lead lists", scope: LIST_SCOPE, kind: "searches" },
  {
    id: "campaigns",
    label: "Connection campaigns",
    scope: pageScope("campaigns"),
    kind: "draft",
    sections: ["campaigns:messaging", "campaigns:conversation"],
  },
];

type ChainItem = Pick<ActivityItem, "id" | "job_key" | "kind" | "status" | "edited" | "payload">;

/** BCA changed something this draft read since Ava wrote it. BCA's own changes to a draft are never thrown away. */
function outOfDate(item: ChainItem | null, print: string): boolean {
  return Boolean(item && !item.edited && item.payload.inputs && item.payload.inputs !== print);
}

/** One pass down the chain: every step that can start now, side by side. */
async function advanceOnce(coachId: string, userId: string | null): Promise<string[]> {
  const raw = await ensurePracticeKnowledge(coachId);
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select("id, job_key, kind, status, edited, payload")
    .eq("coach_id", coachId)
    .in("kind", ["draft", "answers", "searches"])
    .in("status", ["open", "saved", "dismissed"]);
  const items = (data ?? []) as ChainItem[];
  const openOfKind = (step: ChainStep) => items.find((i) => i.status === "open" && i.job_key === step.scope && i.kind === step.kind) ?? null;
  // Released or turned down: Ava doesn't start that step again by herself.
  const finished = (step: ChainStep) => items.some((i) => i.status !== "open" && i.job_key === step.scope && i.kind === step.kind);
  const row = await withOpenDrafts(coachId, raw);
  const step = (id: string) => LAUNCH_CHAIN.find((s) => s.id === id)!;
  const runs: { label: string; run: () => Promise<unknown> }[] = [];

  // 1. The Ideal Client boxes, from Pam's notes. Once: what she couldn't fill waits for the coach.
  const idealClient = step("ideal-client");
  const triedBoxes = items.some((i) => i.status !== "open" && i.job_key === idealClient.scope && i.kind === "answers" && i.payload.by === "ava");
  if (!openOfKind(idealClient) && !triedBoxes && emptyBoxes("market", raw).length) {
    runs.push({ label: idealClient.label, run: () => draftPageAnswers(coachId, "market", userId) });
  }

  // 2, 3 and 6. Written sections: the voice guide, the market, the campaigns.
  for (const s of LAUNCH_CHAIN.filter((c) => c.sections)) {
    const existing = openOfKind(s);
    if (existing) {
      const keys = (existing.payload.sections ?? []).map((x) => x.key).filter((key) => s.sections!.includes(key));
      const base = await withOpenDrafts(coachId, raw, [s.scope]);
      if (keys.length && outOfDate(existing, inputPrint(base, { sections: keys }))) {
        runs.push({ label: `${s.label} (rewritten)`, run: () => runAva(coachId, s.scope, userId, keys) });
      }
      continue;
    }
    const keys = writable(s.scope, row).filter((key) => s.sections!.includes(key));
    if (keys.length) runs.push({ label: s.label, run: () => runAva(coachId, s.scope, userId, keys) });
  }

  // 4. The LinkedIn profile, once the voice guide and Ideal Client are drafted.
  const linkedin = step("linkedin");
  const liOpen = openOfKind(linkedin);
  if (liOpen) {
    if (outOfDate(liOpen, linkedInPrint(row))) runs.push({ label: `${linkedin.label} (rewritten)`, run: () => draftLinkedInProfile(coachId, userId) });
  } else if (!finished(linkedin) && linkedInReady(row)) {
    const optimizer = await loadOptimizerRow(coachId).catch(() => null);
    if (optimizer?.snapshot && emptyDraft(optimizer.draft)) runs.push({ label: linkedin.label, run: () => draftLinkedInProfile(coachId, userId) });
  }

  // 5. The lead lists, once the list box is drafted.
  const lists = step("lists");
  const listOpen = openOfKind(lists);
  if (listOpen) {
    if (outOfDate(listOpen, listPrint(row))) runs.push({ label: `${lists.label} (rewritten)`, run: () => draftProspectSearches(coachId, userId) });
  } else if (!finished(lists) && listBoxReady(row) && (await poolSize(coachId)) < LIST_TARGET.aim) {
    runs.push({ label: lists.label, run: () => draftProspectSearches(coachId, userId) });
  }

  const results = await Promise.allSettled(runs.map((r) => r.run()));
  results.forEach((result, i) => {
    if (result.status === "rejected") console.error(`advance ${runs[i].label}:`, result.reason instanceof Error ? result.reason.message : "failed");
  });
  return runs.filter((_, i) => results[i].status === "fulfilled").map((r) => r.label);
}

/**
 * Ava works down the launch chain for this coach, BCA-only: each pass
 * unlocks the next, until nothing more can start. She stops starting new
 * passes after about two and a half minutes (the request's time limit); the
 * next release or "advance" carries on. Returns what she drafted.
 */
export async function advanceCoach(coachId: string, userId: string | null): Promise<string[]> {
  const startedAt = Date.now();
  const done: string[] = [];
  for (let pass = 0; pass < LAUNCH_CHAIN.length && Date.now() - startedAt < 150_000; pass++) {
    const started = await advanceOnce(coachId, userId);
    if (!started.length) break;
    done.push(...started);
  }
  return done;
}

/** Where one chain step is, for the To check list. */
export type ChainState = {
  id: string;
  label: string;
  state: "released" | "check" | "next" | "waiting";
  /** "Waiting on Pain points", or what's in the draft. */
  note: string;
  /** The open item to check. */
  itemId?: string;
  scope: string;
};

/** The launch chain for one coach: what's released, what's to check, and what each later step waits on. */
export async function chainState(coachId: string): Promise<ChainState[]> {
  const raw = await ensurePracticeKnowledge(coachId);
  const [{ data }, row, optimizer, inPool] = await Promise.all([
    supabaseAdmin
      .from("launch_job_activity")
      .select("id, job_key, kind, status, edited, payload")
      .eq("coach_id", coachId)
      .in("kind", ["draft", "answers", "searches"])
      .in("status", ["open", "saved", "dismissed"]),
    withOpenDrafts(coachId, raw),
    loadOptimizerRow(coachId).catch(() => null),
    poolSize(coachId),
  ]);
  const items = (data ?? []) as ChainItem[];
  const waitingOn = (labels: string[]) => `Waiting on ${labels.join(", ")}`;
  return LAUNCH_CHAIN.map((step): ChainState => {
    const base = { id: step.id, label: step.label, scope: step.scope };
    const open = items.find((i) => i.status === "open" && i.job_key === step.scope && i.kind === step.kind);
    if (open) return { ...base, state: "check", itemId: open.id, note: "Ava's draft is ready for you" };
    const finished = items.some((i) => i.status !== "open" && i.job_key === step.scope && i.kind === step.kind);
    if (step.sections) {
      const left = step.sections.filter((key) => !raw.built_sections[key]);
      if (!left.length) return { ...base, state: "released", note: "Released" };
      const blockers = missingFor(left, row).filter((m) => !(m.kind === "answer" && m.coach));
      return blockers.length
        ? { ...base, state: "waiting", note: waitingOn(blockers.map((m) => m.label)) }
        : { ...base, state: "next", note: "Ava writes this next" };
    }
    if (step.id === "ideal-client") {
      if (finished || !emptyBoxes("market", raw).length) return { ...base, state: "released", note: "Released" };
      return { ...base, state: "next", note: "Ava fills these next, from Pam's notes" };
    }
    if (step.id === "linkedin") {
      if (finished) return { ...base, state: "released", note: "Released" };
      if (!optimizer?.snapshot) return { ...base, state: "waiting", note: waitingOn(["their LinkedIn import"]) };
      if (!emptyDraft(optimizer.draft)) return { ...base, state: "released", note: "Already has a profile draft" };
      const needs = [!row.built_sections["voice:sound"] ? "Voice guide" : "", !linkedInReady(row) && row.built_sections["voice:sound"] ? "Ideal Client boxes" : ""].filter(Boolean);
      return needs.length ? { ...base, state: "waiting", note: waitingOn(needs) } : { ...base, state: "next", note: "Ava writes this next" };
    }
    // Lead lists.
    if (finished) return { ...base, state: "released", note: "Imported" };
    if (inPool >= LIST_TARGET.aim) return { ...base, state: "released", note: `${inPool.toLocaleString("en-GB")} already in their Pool` };
    if (!listBoxReady(row)) return { ...base, state: "waiting", note: waitingOn(["Who goes on your list"]) };
    return { ...base, state: "next", note: "Ava plans these next" };
  });
}

// ---------------------------------------------------------------- BCA's list

export type ToCheckItem = {
  id: string;
  coach_id: string;
  job_key: string;
  kind: ActivityItem["kind"];
  created_at: string;
  /** "Ava's draft: The walkthrough, Pain points". */
  what: string;
};

/** Everything waiting for BCA across coaches, oldest first. */
export async function toCheckItems(): Promise<ToCheckItem[]> {
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select("id, coach_id, job_key, kind, created_at, payload")
    .eq("status", "open")
    .in("kind", ["draft", "answers", "searches", "message"])
    .order("created_at", { ascending: true })
    .limit(500);
  return ((data ?? []) as Pick<ActivityItem, "id" | "coach_id" | "job_key" | "kind" | "created_at" | "payload">[]).map((item) => ({
    id: item.id,
    coach_id: item.coach_id,
    job_key: item.job_key,
    kind: item.kind,
    created_at: item.created_at,
    what:
      item.kind === "draft"
        ? `Ava's draft: ${(item.payload.sections ?? []).map((s) => s.title).join(", ")}`
        : item.kind === "answers"
          ? `${item.payload.by === "ava" ? "Boxes Ava filled in" : "Answers from the chat"}: ${(item.payload.answers ?? []).map((a) => a.label).join(", ")}`
          : item.kind === "searches"
            ? `Prospect lists: ${(item.payload.searches ?? []).map((s) => s.label).join(", ")}`
            : "A message to the coach",
  }));
}

