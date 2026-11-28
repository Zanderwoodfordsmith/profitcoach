import { resolveReference } from "@/lib/agent/context";
import { loadOptimizerRow, PART_TITLES, saveLinkedIn } from "@/lib/agent/tools/blueprint";
import { buildSalesNavSearch } from "@/lib/agent/tools/prospects";
import { emptyDraft } from "@/lib/linkedinProfileOptimizer/draft";
import { loadProfileWriterInputs, rewriteProfilePart, WRITE_EVERY_PART } from "@/lib/linkedinProfileOptimizer/rewritePart";
import type { ProfileSectionId } from "@/lib/linkedinProfileOptimizer/types";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { ensureCoachPool } from "@/lib/leadLists/audienceLists";
import { listFitLabel } from "@/lib/pool/fit";
import { BLUEPRINT_SECTIONS, fieldFilled, sectionByKey, type FieldSpec, type SectionRef } from "@/lib/practiceKnowledge/blueprint";
import { blueprintContextFromRow } from "@/lib/practiceKnowledge/blueprintContext";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { listOnboardingTranscripts, onboardingTranscriptText } from "@/lib/practiceKnowledge/ingestOnboarding";
import { summarizeKnowledgeForPrompt } from "@/lib/practiceKnowledge/prompts";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import type { BlueprintBlock, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { PROSPECT_SEARCH_PLAYBOOK } from "@/lib/salesNavigator/prospectSearch/playbook";
import { ensureProspectsSetup } from "@/lib/pool/prospectsSetup";
import { SALES_NAV_INDUSTRIES, salesNavIndustry } from "@/lib/salesNavigator/industries";
import { resolveSalesNavRegion } from "@/lib/salesNavigator/regions";
import { keywordsOnlyExclude, parseSalesNavSearchUrl } from "@/lib/salesNavigator/parseSalesNavFilters";
import { summarizeSalesNavSearch } from "@/lib/salesNavigator/salesNavSearchSummary";
import { startSalesNavImport } from "@/lib/salesNavigator/startImport";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLiveLinkedInUnipileAccount } from "@/lib/unipile/linkedinSearchAccount";

import { avaWorkFor, fillableAnswer, missingFor, pageScope } from "./avaWork";
import { inputPrint, withOpenDrafts } from "./drafts";
import { goodPeople, inBatches, judgeList, listBrief, proposeListFixes, rankSearches, searchSample } from "./listQuality";
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
  type ListPerson,
  type ListQuality,
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

/** People on a coach's list: aim for 1,000 to 2,500, and 200 at least (20 Nov: messages still go out in a thin market). */
export const LIST_TARGET = { floor: 200, aim: 1_000, most: 2_500 };
/** Up to 20 lists, so each sector can split into the things those firms make (19 Nov). Sizes stay together, 1 to 50 (Zander, 21 Nov). */
const MAX_LISTS = 20;

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
  }>({ system, user, maxTokens: 6_000, writing: true });

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
 * Navigator searches by sub-sector at 1 to 50 staff (Paul Hamnett's way), with
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
- 2 to ${MAX_LISTS} separate lists, never more than ${MAX_LISTS}: cover every sector in the list box before splitting any further. Split by sub-sector, so each list is clean and the coach can see what's in it. Example (Paul Hamnett, gyms): "Gyms", "Padel, tennis and squash clubs", "Boutique fitness studios".
- Go deep. Break each sector into the things those firms actually make or do, and give each its own list with its own words. Example (drinks): "Spirits" (vodka, whisky, whiskey, gin, rum, distillery), "Wine" (wine, wines, vineyard, winery), "Beer and cider" (brewery, brewing, ales, cider), "Tea and coffee" (tea, coffee, roasters), "Soft drinks" (juice, kombucha, soda, cordial).
- One way in per list: company-name words OR an industry, not both (Zander's rule, 21 Nov). Both together shrinks the list far too much, and LinkedIn's industry labels are often wrong, so a company-name list almost never gets an industry. An industry on its own is a good list when it only holds the coach's market (for example Distilleries, Breweries, Wineries; exact names from the industry list below). Rarely, an industry list can take a few company-name words to narrow it. When a word also names shops, cafés or salons (coffee, tea, bakery, beauty), leave those out with exclude words (shop, café, cafe, salon) instead of adding an industry. Never use broad industries (Manufacturing, Retail, Wholesale) on their own.
- Staff size: use 1 to 50 (both "1-10" and "11-50" in the same list) for almost every list, about 95% of the time. 11 to 50 is the ideal client, but many industries have few firms at 11 to 50 on LinkedIn, and many owners never link their staff, so a 30-person firm often shows as 1 to 10. We find each firm's real size when the list comes in, and the coach can filter to 11 to 50 later. Never split a list by size or because it is big, and never make separate 1 to 10 lists. Add "51-200" only when the list box asks for bigger firms.
- Aim for ${LIST_TARGET.aim.toLocaleString("en-GB")} to ${LIST_TARGET.most.toLocaleString("en-GB")} people in total. ${LIST_TARGET.floor} is the least, so messages can still go out in a thin market. A big list (5,000 people or more) is fine: the import gets past LinkedIn's 2,500 a search on its own, so never split a list for size.
- Team sizes allowed: "1-10", "11-50", "51-200", "201-500".
- Company-name words first (how owners name their own business). Keywords only when owners don't name their business that way. Never both in one list. At most 8 words a list, quotes round phrases, no loose words many firms use (solutions, services, group, systems), and no words other trades share (care, clean, health, fresh, farm, kitchen, water, natural): they pull in care homes, cleaners, clinics and builders.
- Leave out what the coach's list box says to leave out, as company words to exclude.
- Extra job titles only when the list box names them.

Method:
${PROSPECT_SEARCH_PLAYBOOK}

${rules()}

Reply with JSON only:
{"thinking": "3 to 5 short sentences for BCA in everyday words: who you're going after and why, how the lists add up to the target, and what you're leaving out",
 "lists": [{"label": "under 6 words", "why": "one sentence, under 20 words", "industries": [], "companyIncludes": [], "keywords": null, "companyExcludesExtra": [], "titleIncludesExtra": [], "teamSizes": ["1-10", "11-50"]}]}

LinkedIn's industry list (use these names exactly):
${SALES_NAV_INDUSTRIES.map((i) => i.title).join("; ")}`;

  const user = `${sources}

People already in their Pool: ${inPool.toLocaleString("en-GB")}.
${previous?.payload.searches?.length ? `\nYour last plan:\n${previous.payload.searches.map((s) => `- ${s.label}: ${s.size ?? "?"} people`).join("\n")}\n` : ""}${changes?.trim() ? `\nBCA asked for this change: ${changes.trim()}\n` : ""}
Plan the lists now. JSON only.`;

  const ask = (text: string) => generateCampaignJson<PlannedLists>({ system, user: text, maxTokens: 4_000, writing: true });
  const first = (await ask(user)).data;
  let thinking = first?.thinking?.trim() || "";
  let planned = buildPlannedLists(first?.lists, region);
  if (!planned.length) throw new Error("Ava couldn't plan a search from this. Try again.");
  let counted = await countSearches(coachId, userId, planned.map((p) => p.draft.url));

  // Ava looks again once LinkedIn has counted (job 271): small lists get widened, combined or dropped.
  const smallOnes = planned.filter((_, i) => (counted.sizes[i] ?? Infinity) < SMALL_LIST);
  if (smallOnes.length) {
    const lines = planned.map((p, i) => `- ${JSON.stringify(p.raw)} → ${counted.sizes[i] ?? "?"} people`).join("\n");
    const review = (
      await ask(`${user}

You planned these lists, and LinkedIn counted each one:
${lines}

${LIST_SIZE_RULES}

Return the whole new plan, every list you keep, in the same JSON. In "thinking", say in everyday words what you changed and why. JSON only.`)
    ).data;
    const again = buildPlannedLists(review?.lists, region);
    if (again.length) {
      planned = again;
      counted = await countSearches(coachId, userId, again.map((p) => p.draft.url));
      thinking = review?.thinking?.trim() || thinking;
    }
  }

  // Ava checks 10 people from each list, then the lists go in order of good people (size × share that fit),
  // so a small or noisy list is never the first to go out; then tick from the top up to 2,500 people.
  const brief = listBrief(row);
  const qualities = await Promise.all(planned.map((p, i) => judgeList(brief, p.draft, counted.samples[i] ?? [])));
  const { kept, dropped } = dropBadLists(
    await fixWeakLists(
      coachId,
      userId,
      brief,
      planned.map((p, i) => ({
        ...p.draft,
        size: counted.sizes[i] ?? null,
        roughSize: counted.sizes[i] != null && counted.rough,
        quality: qualities[i] ?? undefined,
      }))
    )
  );
  const ordered = rankSearches(kept);
  let total = 0;
  let full = false;
  const searches: ProspectSearchDraft[] = ordered.map((s, i) => {
    const search = { ...s, id: `list-${i + 1}` };
    if (search.size === null) return search;
    const people = search.size;
    // Ticks run down from the top and stop at the first list that won't fit, so they never skip a bigger list.
    const on = !full && (total === 0 || total + people <= LIST_TARGET.most);
    if (on) total += people;
    else full = true;
    return { ...search, on };
  });

  await replaceOpen(coachId, LIST_SCOPE, "searches");
  return add({
    coachId,
    jobKey: LIST_SCOPE,
    kind: "searches",
    body: accountId ? "" : "Their LinkedIn isn't connected, so nothing can import yet.",
    payload: {
      searches,
      dropped: dropped.length ? dropped : undefined,
      thinking: thinking || undefined,
      changes: changes?.trim() || undefined,
      version: (previous?.payload.version ?? 0) + 1,
      inputs: listPrint(row),
    },
    status: "open",
    edited: Boolean(changes?.trim()),
    createdBy: userId,
  });
}

type PlannedList = {
  label?: string;
  why?: string;
  industries?: string[];
  companyIncludes?: string[];
  keywords?: string | null;
  companyExcludesExtra?: string[];
  titleIncludesExtra?: string[];
  teamSizes?: string[];
};
type PlannedLists = { thinking?: string; lists?: PlannedList[] };

/** Under this many people a list is too small to run on its own (job 271). */
const SMALL_LIST = 300;

/** How Ava judges a plan once LinkedIn has counted it (Zander, 21 Nov, job 271). */
const LIST_SIZE_RULES = `How to fix the plan now you know the sizes:
- A list under ${SMALL_LIST} people is too small for an automated campaign on its own, and must never be the first list. For each one:
  1. Widen it: if it has company-name words AND an industry, take the industry off (one way in per list). Or add more of the words those firms really put in their names (singular, plural, -ing, the products they make).
  2. Or combine it with a similar list that takes the same message (cookies + crisps + snacks → one snacks list). Never combine lists that need a different message.
  3. If neither works, keep it as it is, low in the order: a small, specific list is still useful for a one-off campaign. Drop a list only when it's off the coach's market. (Lists where 3 or fewer in 10 people fit are dropped after the quality check.)
- Never split a list because it's big. Lists over 2,500 are fine: the import gets past LinkedIn's limit itself.
- Aim for 500 or more people a list where the market allows, and ${LIST_TARGET.aim.toLocaleString("en-GB")} to ${LIST_TARGET.most.toLocaleString("en-GB")} in total.
- Put the biggest, cleanest lists first. The first list is the one the coach starts with, so make it the strongest.
- Keep good lists exactly as they are.`;

/** Ava's lists as Sales Navigator searches, with what she wrote for each (so she can see it again). */
function buildPlannedLists(lists: PlannedList[] | undefined, region: string): { draft: Omit<ProspectSearchDraft, "size">; raw: PlannedList }[] {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) : []);
  const built: { draft: Omit<ProspectSearchDraft, "size">; raw: PlannedList }[] = [];
  for (const [i, list] of (lists ?? []).slice(0, MAX_LISTS).entries()) {
    const keywords = list.keywords?.trim() || "";
    // Company-name words and keywords never go together, except a keyword NOT (Zander, 23 Nov).
    const companyIncludes = keywords && !keywordsOnlyExclude(keywords) ? [] : strings(list.companyIncludes);
    const industries = strings(list.industries).map(salesNavIndustry).filter((x): x is { id: string; title: string } => Boolean(x));
    if (!keywords && !companyIncludes.length && !industries.length) continue;
    const search = buildSalesNavSearch({
      location: region,
      companyIncludes,
      companyExcludesExtra: strings(list.companyExcludesExtra),
      keywords,
      titleIncludesExtra: strings(list.titleIncludesExtra),
      teamSizes: strings(list.teamSizes).filter((s) => SIZE_BANDS.includes(s)),
      degrees: ["2", "3"],
      industries,
    });
    if ("error" in search) continue;
    built.push({
      draft: { id: `list-${i + 1}`, label: list.label?.trim() || `List ${i + 1}`, why: list.why?.trim() || "", url: search.url, on: true },
      raw: list,
    });
  }
  return built;
}

const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-500"];

/** Zander Demo: holds Zander's own LinkedIn with Sales Navigator, used only to count searches (21 Nov). */
const BCA_COUNT_PROFILE_ID = "5cb89c87-88a9-4cfc-9f95-9591f74f8529";

/**
 * Counts for these searches: on the coach's LinkedIn first. When that gives
 * nothing (not connected, or no Sales Navigator), on the admin clicking, then
 * Zander's, as a rough count (their 2nd and 3rd connections, not the coach's).
 */

async function countSearches(
  coachId: string,
  userId: string | null,
  urls: string[]
): Promise<{ sizes: (number | null)[]; samples: ListPerson[][]; rough: boolean; throttled: boolean }> {
  const run = async (accountId: string) => {
    // Four lists at a time: each list is three LinkedIn pages (top, middle, end).
    const results = await inBatches(urls, 4, (url) => searchSample(accountId, url));
    return { sizes: results.map((r) => r.size), samples: results.map((r) => r.people), throttled: results.some((r) => r.throttled) };
  };
  let throttled = false;
  const own = await requireLiveLinkedInUnipileAccount(coachId).catch(() => null);
  if (own) {
    const counted = await run(own);
    if (counted.sizes.some((n) => n !== null)) return { ...counted, rough: false };
    throttled ||= counted.throttled;
  }
  // Then the admin clicking, then Zander's LinkedIn (with Sales Navigator), which is connected on the Zander Demo profile.
  const fallbacks = [...new Set([userId, BCA_COUNT_PROFILE_ID].filter((id): id is string => Boolean(id) && id !== coachId))];
  for (const profileId of fallbacks) {
    const bca = await requireLiveLinkedInUnipileAccount(profileId).catch(() => null);
    if (!bca || bca === own) continue;
    const counted = await run(bca);
    if (counted.sizes.some((n) => n !== null)) return { ...counted, rough: true };
    throttled ||= counted.throttled;
  }
  return { sizes: urls.map(() => null), samples: urls.map(() => []), rough: false, throttled };
}

/**
 * A list that bad goes (Zander, 23 Nov): 3 or fewer in 10 of the people Ava
 * checked fit, after her fix has had its try. It needs 6 or more checked, so a
 * thin sample can't drop it, and a plan never loses every list. Lists BCA
 * edits by hand are never dropped. Dropped lists are kept aside to show why.
 */
function dropBadLists(searches: ProspectSearchDraft[]): { kept: ProspectSearchDraft[]; dropped: ProspectSearchDraft[] } {
  const bad = (s: ProspectSearchDraft) =>
    Boolean(s.quality && s.quality.checked >= 6 && listFitLabel(s.quality.fit, s.quality.checked) === "bad");
  const kept = searches.filter((s) => !bad(s));
  if (!kept.length) return { kept: searches, dropped: [] };
  const stamp = Date.now().toString(36);
  return { kept, dropped: searches.filter(bad).map((s, i) => ({ ...s, id: `dropped-${stamp}-${i + 1}`, on: false })) };
}

/**
 * Ava's fix step (job 278): whenever 2 or more of the people she checked are
 * Bad (a pattern, not one odd person), she compares how the good and bad
 * people word their profiles and tests up to 3 different changes the way
 * Zander's keyword lesson does: company words to leave out, a keyword NOT
 * (shop OR café), a keyword the good ones use (manufacturer OR producer).
 * LinkedIn counts each try and she checks 10 new people from across it. The
 * try with the most good people goes in, only when more of them fit and the
 * list stays over 300; otherwise the old search stays, with what she tried.
 * A list she has already tried keeps its result until the list is edited.
 */
async function fixWeakLists(
  coachId: string,
  userId: string | null,
  brief: string,
  searches: ProspectSearchDraft[]
): Promise<ProspectSearchDraft[]> {
  // Three lists at a time, and every try waits once LinkedIn asks us to slow down.
  let throttled = false;
  return inBatches(searches, 3, async (s) => {
      const q = s.quality;
      const bad = q ? q.people.filter((p) => (p.label ?? (p.fit ? "good" : "bad")) === "bad").length : 0;
      if (s.fix || !q || q.checked < 6 || bad < 2 || s.size === null || s.size < SMALL_LIST) return s;
      const old = summarizeSalesNavSearch(s.url);
      const keywords = parseSalesNavSearchUrl(s.url).keywordsBoolean ?? "";
      const before = { fit: q.fit, checked: q.checked, size: s.size };
      const at = new Date().toISOString();
      const proposed = await proposeListFixes(
        brief,
        s,
        { companyIncludes: old.company_includes, companyExcludes: old.company_excludes, industries: old.industries, keywords },
        q
      );
      if (!proposed) return s;
      if ("none" in proposed) return { ...s, fix: { pattern: proposed.none, change: "Nothing to filter out", kept: false, before, at } };
      const degreeIds: Record<string, "1" | "2" | "3"> = { F: "1", S: "2", O: "3", "1": "1", "2": "2", "3": "3" };
      // One try at a time, so LinkedIn isn't asked for too much at once.
      const results: {
        change: string;
        url: string | null;
        size: number | null;
        rough: boolean;
        quality: ListQuality | null;
      }[] = [];
      for (const t of proposed.tries) {
        if (throttled) break;
        const search = buildSalesNavSearch({
          location: old.location || "United Kingdom",
          companyIncludes: [...old.company_includes, ...t.companyIncludesAdd],
          companyExcludesExtra: [...old.company_excludes, ...t.companyExcludesAdd],
          keywords: t.keywords ?? keywords,
          titleIncludesExtra: old.title_includes,
          teamSizes: old.team_sizes.filter((size) => SIZE_BANDS.includes(size)),
          degrees: old.degrees.map((d) => degreeIds[d]).filter((d): d is "1" | "2" | "3" => Boolean(d)),
          industries: old.industries.map(salesNavIndustry).filter((x): x is { id: string; title: string } => Boolean(x)),
          allowKeywordsWithCompany: true,
        });
        if ("error" in search) {
          results.push({ change: t.change, url: null, size: null, rough: false, quality: null });
          continue;
        }
        const counted = await countSearches(coachId, userId, [search.url]);
        throttled ||= counted.throttled;
        const size = counted.sizes[0] ?? null;
        const quality = size === null ? null : await judgeList(brief, s, counted.samples[0] ?? []);
        results.push({ change: t.change, url: search.url, size, rough: counted.rough, quality });
      }
      // LinkedIn stopped answering before any try was counted: try again next time.
      if (!results.some((r) => r.quality)) return s;
      const share = q.fit / q.checked;
      // A try needs 6 or more people checked to count (a short sample is noise).
      const better = results.filter(
        (r) => r.url && r.size !== null && r.size >= SMALL_LIST && r.quality && r.quality.checked >= 6 && r.quality.fit / r.quality.checked > share
      );
      const best = better.sort((x, y) => goodPeople({ size: y.size, quality: y.quality ?? undefined }) - goodPeople({ size: x.size, quality: x.quality ?? undefined }))[0];
      const tries = results.map((r) => ({
        change: r.change,
        ...(r.quality && r.size !== null ? { after: { fit: r.quality.fit, checked: r.quality.checked, size: r.size } } : {}),
        kept: r === best,
      }));
      if (!best) {
        // Show the closest try as the headline, and every try under it.
        const closest = results.find((r) => r.quality) ?? results[0]!;
        const after = closest.quality && closest.size !== null ? { fit: closest.quality.fit, checked: closest.quality.checked, size: closest.size } : undefined;
        return { ...s, fix: { pattern: proposed.pattern, change: closest.change, kept: false, before, ...(after ? { after } : {}), tries, at } };
      }
      return {
        ...s,
        url: best.url!,
        size: best.size,
        roughSize: best.rough,
        quality: best.quality!,
        fix: {
          pattern: proposed.pattern,
          change: best.change,
          kept: true,
          before,
          after: { fit: best.quality!.fit, checked: best.quality!.checked, size: best.size },
          tries,
          at,
        },
      };
  });
}

async function openSearches(id: string): Promise<ActivityItem> {
  const item = await getItem(id);
  if (item.kind !== "searches" || item.status !== "open") throw new Error("These searches aren't waiting any more.");
  return item;
}

/**
 * BCA changes one list on the Lead lists page (21 Nov): its name, company-name
 * words, industry, keywords and staff. The base search (titles, left-out
 * companies, place, connections) stays as it was. Lists shown as one row
 * (the same search split by staff) become one search. LinkedIn counts it again.
 */
export async function editProspectSearch(
  id: string,
  userId: string | null,
  edit: { searchIds: string[]; label: string; companyIncludes: string[]; industries: string[]; keywords: string; teamSizes: string[] }
): Promise<void> {
  const item = await openSearches(id);
  const searches = item.payload.searches ?? [];
  const first = searches.find((s) => s.id === edit.searchIds[0]);
  if (!first) throw new Error("That list has gone. Reload the page.");
  const old = summarizeSalesNavSearch(first.url);
  const unknown = edit.industries.filter((name) => !salesNavIndustry(name));
  if (unknown.length) throw new Error(`Not a LinkedIn industry: ${unknown.join(", ")}. Use the exact name from Sales Navigator.`);
  const teamSizes = edit.teamSizes.filter((size) => SIZE_BANDS.includes(size));
  if (!teamSizes.length) throw new Error("Pick at least one staff size.");
  const keywords = edit.keywords.trim();
  const companyIncludes = edit.companyIncludes.map((w) => w.trim()).filter(Boolean);
  const industries = edit.industries.map(salesNavIndustry).filter((x): x is { id: string; title: string } => Boolean(x));
  if (!keywords && !companyIncludes.length && !industries.length) throw new Error("Give the list company-name words, an industry or keywords.");
  const degreeIds: Record<string, "1" | "2" | "3"> = { F: "1", S: "2", O: "3", "1": "1", "2": "2", "3": "3" };
  const search = buildSalesNavSearch({
    location: old.location || "United Kingdom",
    companyIncludes,
    // The base adds its own; anything extra this list already had stays.
    companyExcludesExtra: old.company_excludes,
    keywords,
    titleIncludesExtra: old.title_includes,
    teamSizes,
    degrees: old.degrees.map((d) => degreeIds[d]).filter((d): d is "1" | "2" | "3" => Boolean(d)),
    industries,
    allowKeywordsWithCompany: true,
  });
  if ("error" in search) throw new Error(search.error);
  const counted = await countSearches(item.coach_id, userId, [search.url]);
  const size = counted.sizes[0] ?? null;
  const label = edit.label.trim() || first.label;
  const row = await withOpenDrafts(item.coach_id, await ensurePracticeKnowledge(item.coach_id));
  const quality = await judgeList(listBrief(row), { label, why: first.why }, counted.samples[0] ?? []);
  const next = searches
    .filter((s) => s.id === first.id || !edit.searchIds.includes(s.id))
    .map((s) =>
      s.id === first.id
        ? { ...s, label, url: search.url, size, roughSize: size !== null && counted.rough, quality: quality ?? undefined, fix: undefined }
        : s
    );
  const { error } = await supabaseAdmin
    .from("launch_job_activity")
    .update({ payload: { ...item.payload, searches: next }, edited: true })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}

/** "Check sizes": what LinkedIn says each list finds, before anything is imported. */
export async function sizeProspectSearches(id: string, userId: string | null): Promise<{ rough: boolean; throttled: boolean }> {
  const item = await openSearches(id);
  const list = item.payload.searches ?? [];
  const [counted, row] = await Promise.all([
    countSearches(item.coach_id, userId, list.map((s) => s.url)),
    withOpenDrafts(item.coach_id, await ensurePracticeKnowledge(item.coach_id)),
  ]);
  if (counted.sizes.every((n) => n === null) && counted.throttled) {
    throw new Error("LinkedIn asked us to slow down, so nothing was counted. Try Check lists again in an hour.");
  }
  if (counted.sizes.every((n) => n === null)) {
    throw new Error(
      "LinkedIn wouldn't count these. Counting needs Sales Navigator on the coach's LinkedIn or on Zander's (connected on Zander Demo). Check that one is still connected."
    );
  }
  // Ava checks 10 people from each list, then the lists go in order of good people (size × share that fit).
  const brief = listBrief(row);
  const qualities = await Promise.all(list.map((s, i) => judgeList(brief, s, counted.samples[i] ?? [])));
  const { kept, dropped } = dropBadLists(
    await fixWeakLists(
      item.coach_id,
      userId,
      brief,
      list.map((s, i) => {
        if (counted.sizes[i] === null) return s;
        // A short sample (LinkedIn stopped answering part way) never replaces a full check.
        const fresh = qualities[i];
        const quality = fresh && (fresh.checked >= 6 || !s.quality) ? fresh : s.quality;
        return { ...s, size: counted.sizes[i], roughSize: counted.rough, quality };
      })
    )
  );
  const searches = rankSearches(kept);
  const allDropped = [...(item.payload.dropped ?? []), ...dropped];
  const { error } = await supabaseAdmin
    .from("launch_job_activity")
    .update({ payload: { ...item.payload, searches, dropped: allDropped.length ? allDropped : undefined } })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
  return { rough: counted.rough, throttled: counted.throttled };
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
/**
 * BCA changed a waiting draft's words by hand on the Launch page (job 248).
 * Same row, marked edited, so a later run never throws it away. A LinkedIn
 * draft changes one part; any other draft changes one section's blocks.
 */
export async function editOpenDraft(
  id: string,
  edit: { key?: string; blocks?: BlueprintBlock[]; part?: string; text?: string }
): Promise<void> {
  const draft = await getItem(id);
  if (draft.kind !== "draft" || draft.status !== "open") throw new Error("This draft isn't waiting any more.");
  const payload = { ...draft.payload };
  if (payload.linkedinParts && edit.part) {
    const text = (edit.text ?? "").trim();
    if (!text) throw new Error("That part is empty.");
    const parts = { ...(payload.linkedinParts as Record<string, string>), [edit.part]: text };
    payload.linkedinParts = parts;
    const blocks = Object.entries(parts).flatMap(([part, words]) => [
      { type: "heading" as const, text: PART_TITLES[part as ProfileSectionId] ?? part },
      { type: "paragraph" as const, text: words },
    ]);
    payload.sections = (payload.sections ?? []).map((section) => (section.key === "linkedin:rewrite" ? { ...section, blocks } : section));
  } else if (edit.key && edit.blocks) {
    const sections = payload.sections ?? [];
    if (!sections.some((section) => section.key === edit.key)) throw new Error("That section isn't in this draft.");
    payload.sections = sections.map((section) => (section.key === edit.key ? { ...section, blocks: edit.blocks! } : section));
  } else {
    throw new Error("Nothing to change.");
  }
  const { error } = await supabaseAdmin.from("launch_job_activity").update({ payload, edited: true }).eq("id", id).eq("status", "open");
  if (error) throw new Error(error.message);
}

/** BCA changed one of Ava's draft answers on the coach's Blueprint (21 Nov). Same row, marked edited; Release still decides. */
export async function editOpenAnswer(id: string, path: string, value: string): Promise<void> {
  const item = await getItem(id);
  if (item.kind !== "answers" || item.status !== "open") throw new Error("These answers aren't waiting any more.");
  const answers = (item.payload.answers ?? []).map((a) => (a.path === path ? { ...a, value } : a));
  if (!answers.some((a) => a.path === path)) throw new Error("That box isn't in Ava's answers.");
  const { error } = await supabaseAdmin
    .from("launch_job_activity")
    .update({ payload: { ...item.payload, answers }, edited: true })
    .eq("id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}

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
  { id: "lists", label: "Prospect lists", scope: LIST_SCOPE, kind: "searches" },
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
      // Sections that were blocked when this draft was written (e.g. pain points before the Ideal Client
      // boxes were drafted) and can be written now. Never added to a draft BCA has edited.
      const more = existing.edited ? [] : writable(s.scope, base).filter((key) => s.sections!.includes(key) && !keys.includes(key));
      if (keys.length && (more.length || outOfDate(existing, inputPrint(base, { sections: keys })))) {
        runs.push({ label: `${s.label} (${more.length ? "rest added" : "rewritten"})`, run: () => runAva(coachId, s.scope, userId, [...keys, ...more]) });
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
  // Prospects set up at launch (job 320): the ready-made smart lists and their connections, once. Sends nothing.
  await ensureProspectsSetup(coachId).catch((err) => console.error("prospects setup:", err instanceof Error ? err.message : "failed"));
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

