/**
 * Lead list quality (job 271, 23 Nov): before anything is imported, pull a
 * page of people from each Sales Navigator search and have Ava check 10 of
 * them against the coach's "Who goes on your list" box. Lists are then ranked
 * by how many good people they should hold (size × share that fit), so a big,
 * clean list goes first and a small or noisy one drops down.
 *
 * Job 278: each person is Good, OK or Bad (the same labels the Pool uses),
 * and a weak list gets one fix the way Zander's Find More Prospects With
 * Keyword Search lesson does it: compare how the people who fit word their
 * profiles against the misfits, then leave words out or add them.
 */

import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { asFitLabel, type FitLabel } from "@/lib/pool/fit";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgeRow, Sourced } from "@/lib/practiceKnowledge/types";
import { linkedInSearch } from "@/lib/unipile/client";
import { nextUnipileUrlSearchCursor, salesNavUrlForUnipile } from "@/lib/unipile/linkedinSearchCursor";

import type { ListPerson, ListQuality, ProspectSearchDraft } from "./jobActivity";

/** People Ava checks per list (the playbook's spot check). */
export const QUALITY_SAMPLE = 10;

function text(v: unknown, max = 160): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** The writing rules: never an em dash. */
function noDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ");
}

function personOf(item: Record<string, unknown>): ListPerson | null {
  const name = text(item.name, 80);
  if (!name) return null;
  const positions = Array.isArray(item.current_positions) ? (item.current_positions as Record<string, unknown>[]) : [];
  const job = positions[0] ?? {};
  const industry = Array.isArray(job.industry) ? text(job.industry[0], 80) : text(job.industry, 80);
  return {
    name,
    role: text(job.role, 80),
    company: text(job.company, 80),
    location: text(item.location, 80),
    headline: text(item.headline),
    url: text(item.public_profile_url, 300),
    ...(industry ? { industry } : {}),
  };
}

/** n people spread across the page, so the check isn't only the top few results. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  if (n === 1) return [list[Math.floor(list.length / 2)]!];
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]!);
}

/** LinkedIn shows at most 2,500 people a search; a page is 25. */
const LINKEDIN_SHOWS = 2_500;
const PAGE = 25;

/** One page of a search from this place in the list, with each person's place. Null when LinkedIn won't answer; throttled when it asks us to slow down. */
async function searchPage(
  accountId: string,
  url: string,
  start: number
): Promise<{ total: number | null; people: ListPerson[] } | { throttled: true } | null> {
  const res = await linkedInSearch({
    account_id: accountId,
    url: salesNavUrlForUnipile(url),
    limit: PAGE,
    timeoutMs: 30_000,
    ...(start > 0 ? { cursor: nextUnipileUrlSearchCursor({ accountId, url, start, limit: PAGE }) } : {}),
  }).catch(() => null);
  if (res && !res.ok && res.status === 429) return { throttled: true };
  if (!res?.ok) return null;
  const total = res.data?.paging?.total_count;
  const people: ListPerson[] = [];
  (res.data?.items ?? []).forEach((item: Record<string, unknown>, i: number) => {
    const person = personOf(item);
    if (person) people.push({ ...person, at: start + i + 1 });
  });
  return { total: typeof total === "number" ? total : null, people };
}

/**
 * How many people a search finds and 10 of them, before anything is imported.
 * LinkedIn puts its best matches first, so the top page is the cleanest part
 * of any list (Zander, 23 Nov: Tea and coffee scored 10/10 on its top page,
 * while its middle held cafés, coffee vans and afternoon teas). So Ava's 10
 * come from the start, the middle and the end of what LinkedIn shows: three
 * LinkedIn calls a list instead of one. Null size when LinkedIn won't say.
 */
export async function searchSample(
  accountId: string | null,
  url: string
): Promise<{ size: number | null; people: ListPerson[]; throttled: boolean }> {
  if (!accountId) return { size: null, people: [], throttled: false };
  const first = await searchPage(accountId, url, 0);
  if (!first) return { size: null, people: [], throttled: false };
  if ("throttled" in first) return { size: null, people: [], throttled: true };
  const pageOf = (r: Awaited<ReturnType<typeof searchPage>>) => (r && "people" in r ? r.people : []);
  const shown = Math.min(first.total ?? first.people.length, LINKEDIN_SHOWS);
  if (shown <= PAGE * 3) {
    // A small list: read it all and spread the 10 across it.
    const rest = await Promise.all(
      Array.from({ length: Math.ceil(shown / PAGE) - 1 }, (_, i) => searchPage(accountId, url, (i + 1) * PAGE))
    );
    return {
      size: first.total,
      people: spread([...first.people, ...rest.flatMap(pageOf)], QUALITY_SAMPLE),
      throttled: rest.some((r) => r && "throttled" in r),
    };
  }
  const [middle, end] = await Promise.all([
    searchPage(accountId, url, Math.max(PAGE, Math.floor(shown / 2) - Math.floor(PAGE / 2))),
    searchPage(accountId, url, Math.max(PAGE * 2, shown - PAGE)),
  ]);
  const seen = new Set<string>();
  const people = [...spread(first.people, 4), ...spread(pageOf(middle), 3), ...spread(pageOf(end), 3)].filter((p) => {
    const key = p.url || p.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { size: first.total, people, throttled: [middle, end].some((r) => r && "throttled" in r) };
}

/** Run fn over items a few at a time, so LinkedIn isn't asked for too much at once (23 Nov: it said 429). */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map((item, j) => fn(item, i + j)))));
  }
  return out;
}

/** A list box answer as text. Some boxes hold a list, some a line of text. */
function either(v: unknown): string {
  const value = (v as { value?: unknown } | null)?.value;
  return Array.isArray(value) ? listValue(v as Sourced<string[]>).join("; ") : textValue(v as Sourced<string> | null);
}

/** The list box says what the coach's clients do, so Ava has something to judge fit against. */
export function hasListBox(row: PracticeKnowledgeRow): boolean {
  return Boolean(either((row.payload.market as Record<string, unknown>).list_sectors).trim());
}

/** The coach's "Who goes on your list" box in a few lines, for Ava's fit checks. */
export function listBrief(row: PracticeKnowledgeRow): string {
  const market = row.payload.market as Record<string, unknown>;
  return [
    `What their business does: ${either(market.list_sectors) || "?"}`,
    `How big: ${either(market.list_size) || "owner-led, 1 to 50 staff"}`,
    `Where: ${either(market.list_where) || "United Kingdom"}`,
    either(market.list_leave_out) ? `Leave out: ${either(market.list_leave_out)}` : "",
    either(market.buyer_roles) ? `Who we talk to: ${either(market.buyer_roles)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Who fits: the same three labels for the 10-person list check and for every person in the Pool. */
export const FIT_RULES = `Label each person "good", "ok" or "bad":
- "good": they own or run the business (owner, founder, co-founder, managing director, CEO, managing partner, or a title the list box names), and it's clearly a real firm in the coach's market.
- "ok": probably right, but you can't be sure from what's here: the title is vague, or the company could be in the market but its name and headline don't say.
- "bad": not a fit. They don't own or run it, or the business is a shop, café, wholesaler, distributor, agency, consultant, coach, recruiter, student or side project (unless the list box asks for that), or it's outside the coach's market, or the list box says to leave it out.
Judge from the company name, their role, their headline and the company's LinkedIn industry. Location and staff size are already filtered; ignore them unless clearly wrong. Someone who also has another job still fits if they own or run a business in the market. In a small UK firm a "Director" is usually an owner, so that title alone is never a reason for "bad".
A line whose role is "Business listing" is a business from Google Maps with no person found yet: judge only the business (good when it's clearly in the market, ok when unsure, bad when it isn't), never the role.`;

/** One line per person for Ava: number, name, role at company (LinkedIn industry), headline. */
export function personLines(people: Pick<ListPerson, "name" | "role" | "company" | "headline" | "industry">[]): string {
  return people
    .map((p, i) => `${i + 1}. ${p.name} | ${p.role || "?"} at ${p.company || "?"}${p.industry ? ` (${p.industry})` : ""} | ${p.headline || ""}`)
    .join("\n");
}

type Verdicts = { people?: { n?: number; fit?: unknown; why?: string }[]; note?: string };

/** Ava's Good, OK or Bad for each person, in order. Null where she gave no answer. */
export async function judgePeople(
  brief: string,
  people: Pick<ListPerson, "name" | "role" | "company" | "headline" | "industry">[],
  opts: { context?: string; withNote?: boolean } = {}
): Promise<{ verdicts: ({ fit: FitLabel; why: string } | null)[]; note: string }> {
  if (!people.length) return { verdicts: [], note: "" };
  const system = `You check people from a LinkedIn Sales Navigator search for a Profit Coach (a business coach for owner-led firms): who should get the coach's messages.

Who goes on this coach's list:
${brief}

${FIT_RULES}
${
  opts.withNote
    ? `
Then a note: one short sentence in everyday words on what the bad ones have in common, or "Clean list." when almost all fit. No dashes.

Reply with JSON only:
{"people": [{"n": 1, "fit": "good", "why": "under 8 words"}], "note": "..."}`
    : `
Reply with JSON only:
{"people": [{"n": 1, "fit": "good", "why": "under 8 words"}]}`
}`;
  const user = `${opts.context ? `${opts.context}\n\n` : ""}People:
${personLines(people)}

JSON only.`;
  const { data } = await generateCampaignJson<Verdicts>({
    system,
    user,
    maxTokens: Math.min(6_000, 400 + people.length * 60),
  }).catch(() => ({ data: null }));
  const byNumber = new Map((data?.people ?? []).map((v) => [Number(v.n), v]));
  const verdicts = people.map((_, i) => {
    const v = byNumber.get(i + 1);
    const fit = asFitLabel(v?.fit);
    return fit ? { fit, why: noDashes(text(v?.why, 80)) } : null;
  });
  return { verdicts, note: noDashes(text(data?.note, 240)) };
}

/** Ava's verdict on one list's sample. Null when there's nobody to check or she couldn't answer. */
export async function judgeList(brief: string, list: { label: string; why: string }, people: ListPerson[]): Promise<ListQuality | null> {
  if (!people.length) return null;
  const { verdicts, note } = await judgePeople(brief, people, {
    context: `List: ${list.label}${list.why ? ` (${list.why})` : ""}`,
    withNote: true,
  });
  const checked = people.flatMap((p, i) => {
    const v = verdicts[i];
    return v ? [{ ...p, label: v.fit, fit: v.fit !== "bad", why: v.why }] : [];
  });
  if (!checked.length) return null;
  return {
    checked: checked.length,
    fit: checked.filter((p) => p.fit).length,
    note,
    people: checked,
    at: new Date().toISOString(),
  };
}

/** The parts of a search Ava may change when she fixes it. */
export type FixableSearch = { companyIncludes: string[]; companyExcludes: string[]; industries: string[]; keywords: string };

export type ProposedFix = {
  change: string;
  companyExcludesAdd: string[];
  companyIncludesAdd: string[];
  /** The whole new keyword string, or null to leave keywords as they are. */
  keywords: string | null;
};

/** Most tries Ava tests on one list. */
export const MAX_FIX_TRIES = 3;

const FIX_RULES = `How to fix it (Zander's method, from his Find More Prospects With Keyword Search lesson):
1. Compare the wording. Look at the company names, roles, headlines and LinkedIn industries of the good people against the bad ones. Find words the bad ones share that the good ones don't use (café, shop, tearoom, supplier, distributor, agency), and words the good ones share that the bad ones don't (manufacturer, producer, brand, roaster, distillery).
2. Only act on a pattern: at least 2 bad people share it. One odd person is not a pattern.
3. Give up to ${MAX_FIX_TRIES} different tries. Each one is tested on LinkedIn (counted, and 10 new people checked from the top, middle and end), and only the best goes in, so make them different kinds:
   a. Company-name words to leave out. They only check the company name, so they're the safest (agency, marketing, wholesale, distribution, merchants, café, tearoom).
   b. A keyword NOT. The keyword bar searches the whole profile (headline, about, past jobs), so it also catches a café whose name doesn't say café: NOT (shop OR café OR cafe OR "coffee shop" OR tearoom). Careful with words good firms use too: a brand may say "supplier to Waitrose", so NOT supplier can cut good people. The test will show it.
   c. A keyword the good ones use, to keep only them: (manufacturer OR manufacturing OR producer OR brand). This makes a list much smaller, so it's a test: it only goes in if the list stays big enough. You can join b and c: (manufacturer OR producer) NOT (shop OR café).
   Any try may also add a company-name word the good ones share that the search hasn't got (only on a list that already uses company-name words).
4. Write keywords the way LinkedIn reads them: AND, OR and NOT in capitals, quotes round phrases ("coffee shop"), brackets to group. If the list already has keywords, keep what they ask for and add to it.
5. Never change job titles, location, staff size or the industry.
6. If the bad ones can't be told apart by words (for example wine merchants and wineries both say "wines"), say so and give no tries.`;

/** Up to 3 different fixes to test on a weak list, from how the good and bad people word their profiles. Null when Ava couldn't answer. */
export async function proposeListFixes(
  brief: string,
  list: { label: string; why: string },
  search: FixableSearch,
  quality: ListQuality
): Promise<{ pattern: string; tries: ProposedFix[] } | { none: string } | null> {
  const people = quality.people.filter((p) => p.label);
  if (!people.some((p) => p.label === "bad")) return null;
  const system = `You fix a LinkedIn Sales Navigator search for a Profit Coach (a business coach for owner-led firms) before it's imported. Ava checked people from it and some don't fit.

Who goes on this coach's list:
${brief}

${FIX_RULES}

Reply with JSON only:
{"none": false, "pattern": "what the bad ones share, under 15 words, everyday words, no dashes", "tries": [{"companyExcludesAdd": [], "companyIncludesAdd": [], "keywords": null}]}
In each try, "keywords" is null to leave them as they are, or the whole new keyword string. When there's no clear pattern you can filter, set "none": true, say why in "pattern", and give no tries.`;
  const user = `List: ${list.label}${list.why ? ` (${list.why})` : ""}
Company name has: ${search.companyIncludes.join(", ") || "(none)"}
Company name leaves out: ${search.companyExcludes.join(", ") || "(none)"}
Industry: ${search.industries.join(", ") || "(none)"}
Keywords: ${search.keywords || "(none)"}

People Ava checked:
${people.map((p, i) => `${i + 1}. ${p.label!.toUpperCase()} | ${p.role || "?"} at ${p.company || "?"}${p.industry ? ` (${p.industry})` : ""} | ${p.headline || ""}${p.label === "bad" && p.why ? ` | why bad: ${p.why}` : ""}`).join("\n")}

JSON only.`;
  const { data } = await generateCampaignJson<{
    none?: boolean;
    pattern?: string;
    tries?: { companyExcludesAdd?: unknown; companyIncludesAdd?: unknown; keywords?: unknown }[];
  }>({ system, user, maxTokens: 2_000 }).catch(() => ({ data: null }));
  if (!data) return null;
  const pattern = noDashes(text(data.pattern, 160));
  const words = (v: unknown, have: string[]) => {
    const seen = new Set(have.map((w) => w.toLowerCase()));
    return (Array.isArray(v) ? v : [])
      .map((w) => text(w, 40))
      .filter((w) => w && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()))
      .slice(0, 8);
  };
  const seenTries = new Set<string>();
  const tries: ProposedFix[] = [];
  for (const t of (data.none ? [] : data.tries ?? []).slice(0, MAX_FIX_TRIES)) {
    const companyExcludesAdd = words(t.companyExcludesAdd, search.companyExcludes);
    // A new company-name word only on a list that already leads with company names.
    const companyIncludesAdd = search.companyIncludes.length ? words(t.companyIncludesAdd, search.companyIncludes) : [];
    let keywords = typeof t.keywords === "string" ? text(t.keywords, 300) : "";
    if (keywords === search.keywords) keywords = "";
    if (!companyExcludesAdd.length && !companyIncludesAdd.length && !keywords) continue;
    const key = JSON.stringify([companyExcludesAdd, companyIncludesAdd, keywords]);
    if (seenTries.has(key)) continue;
    seenTries.add(key);
    // Said the same way every time, in plain words.
    const change = [
      companyExcludesAdd.length ? `left out companies named ${companyExcludesAdd.join(", ")}` : "",
      companyIncludesAdd.length ? `added companies named ${companyIncludesAdd.join(", ")}` : "",
      keywords ? `keywords ${keywords}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    tries.push({
      change: change.charAt(0).toUpperCase() + change.slice(1),
      companyExcludesAdd,
      companyIncludesAdd,
      keywords: keywords || null,
    });
  }
  if (!tries.length) return { none: pattern || "No words set the misfits apart." };
  return { pattern, tries };
}

/** How many good people a list should hold: its size times the share that fit. */
export function goodPeople(search: Pick<ProspectSearchDraft, "size" | "quality">): number {
  if (search.size === null) return -1;
  const q = search.quality;
  return q?.checked ? (search.size * q.fit) / q.checked : search.size;
}

/** Most good people first; lists LinkedIn couldn't count go last; ties keep their order. */
export function rankSearches<T extends Pick<ProspectSearchDraft, "size" | "quality">>(list: T[]): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => goodPeople(b.s) - goodPeople(a.s) || a.i - b.i)
    .map(({ s }) => s);
}
