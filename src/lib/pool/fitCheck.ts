/**
 * Fit on every person in a coach's lists (job 278, 23 Nov). Ava labels people
 * Good, OK or Bad as they come in (the import tick, 100 a minute) or when the
 * coach asks; the coach or BCA can change any label, and Ava never overwrites
 * a person's call. One person can sit on the Pool and on several lists, so a
 * label writes through to every row with their identity.
 */

import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import { withOpenDrafts } from "@/lib/launch/drafts";
import { hasListBox, judgePeople, listBrief } from "@/lib/launch/listQuality";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";
import { canonicalLinkedInProfileUrl } from "@/lib/salesNavigator/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

import type { FitLabel } from "./fit";

/** Ava labels people who came in from this day on; older people only when the coach asks. */
export const FIT_LABELS_FROM = "2026-11-23T00:00:00Z";
/** People per AI call, and calls at once. */
const BATCH = 25;
const AT_ONCE = 4;
/** Most people one "Ask Ava to check" labels. */
export const CHECK_FIT_MAX = 200;

type PersonRow = {
  id: string;
  coach_id: string;
  identity_key: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  industry: string | null;
  source: string | null;
};

const PERSON_SELECT = "id, coach_id, identity_key, full_name, first_name, last_name, job_title, company, linkedin_url, industry, source";

/** LinkedIn addresses of everyone marked Bad, so campaigns can leave them out. */
export async function loadBadFitLinkedInUrls(coachId: string): Promise<Set<string>> {
  const page = await fetchAllSupabasePages<{ linkedin_url: string | null }>((from, to) =>
    supabaseAdmin
      .from("coach_lead_list_items")
      .select("linkedin_url")
      .eq("coach_id", coachId)
      .eq("fit", "bad")
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (page.error) throw new Error(page.error.message || "Could not load Bad fit people.");
  const urls = new Set<string>();
  for (const row of page.data) {
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) urls.add(url);
  }
  return urls;
}

async function identityKeysFor(coachId: string, itemIds: string[]): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("identity_key")
    .eq("coach_id", coachId)
    .in("id", itemIds);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.identity_key as string | null).filter((k): k is string => Boolean(k)))];
}

/** The coach or BCA sets a fit (null clears it, so Ava may label them again). Returns people changed. */
export async function setPeopleFit(coachId: string, itemIds: string[], fit: FitLabel | null): Promise<number> {
  if (!itemIds.length) return 0;
  const keys = await identityKeysFor(coachId, itemIds);
  const patch = { fit, fit_why: null, fit_by: fit ? "person" : null, fit_at: fit ? new Date().toISOString() : null };
  for (let i = 0; i < keys.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .update(patch)
      .eq("coach_id", coachId)
      .in("identity_key", keys.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  // Rows without an identity key (older imports) by id.
  const { error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .update(patch)
    .eq("coach_id", coachId)
    .in("id", itemIds)
    .is("identity_key", null);
  if (error) throw new Error(error.message);
  return keys.length || itemIds.length;
}

/** Headline and the company's LinkedIn industry from the lead cache, by LinkedIn address. */
async function profileWords(urls: (string | null)[]): Promise<Map<string, { headline: string; industry: string }>> {
  const keys = [...new Set(urls.map((url) => canonicalLinkedInProfileUrl(url)).filter((url): url is string => Boolean(url)))];
  const out = new Map<string, { headline: string; industry: string }>();
  for (let i = 0; i < keys.length; i += 40) {
    const { data } = await supabaseAdmin
      .from("leadrocks_leads")
      .select("linkedin_url, industry, raw")
      .in("linkedin_url", keys.slice(i, i + 40));
    for (const row of data ?? []) {
      const key = canonicalLinkedInProfileUrl(String(row.linkedin_url ?? ""));
      if (!key || out.has(key)) continue;
      const raw = row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {};
      out.set(key, {
        headline: typeof raw.headline === "string" ? raw.headline : "",
        industry: typeof row.industry === "string" ? row.industry : "",
      });
    }
  }
  return out;
}

/** Most of the coach's own calls Ava reads as examples. */
const EXAMPLES_MAX = 40;

/**
 * The coach's own calls (Check fit, job 285) as examples for Ava, newest
 * first, one per person. Empty when they haven't sorted anyone themselves.
 */
async function coachExamples(coachId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("identity_key, id, job_title, company, industry, fit, fit_why, tags")
    .eq("coach_id", coachId)
    .eq("fit_by", "person")
    .not("fit", "is", null)
    .order("fit_at", { ascending: false })
    .limit(EXAMPLES_MAX * 3);
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const r of data ?? []) {
    const key = (r.identity_key as string | null) ?? (r.id as string);
    if (seen.has(key) || lines.length >= EXAMPLES_MAX) continue;
    seen.add(key);
    const vip = Array.isArray(r.tags) && r.tags.some((t) => String(t).toLowerCase() === "vip");
    const label = vip ? "GOOD (VIP)" : String(r.fit).toUpperCase();
    const why = r.fit_why && r.fit_why !== "VIP" ? ` | their reason: ${r.fit_why}` : "";
    lines.push(`- ${label} | ${r.job_title || "?"} at ${r.company || "?"}${r.industry ? ` (${r.industry})` : ""}${why}`);
  }
  if (!lines.length) return "";
  return `\n\nHow the coach sorted people themselves. Follow their lead: when these clash with the rules below, the coach is right. Rate people like these the same way.\n${lines.join("\n")}`;
}

/** The coach's list box as Ava's brief, plus their own calls; null when the box is empty (nothing to judge against). */
async function coachBrief(coachId: string): Promise<string | null> {
  const row = await withOpenDrafts(coachId, await ensurePracticeKnowledge(coachId));
  if (!hasListBox(row)) return null;
  return listBrief(row) + (await coachExamples(coachId).catch(() => ""));
}

/** Ava labels these people (one row per person) and writes it to every list they're on. */
async function labelRows(coachId: string, brief: string, rows: PersonRow[]): Promise<number> {
  const words = await profileWords(rows.map((r) => r.linkedin_url));
  const batches: PersonRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  let labelled = 0;
  for (let i = 0; i < batches.length; i += AT_ONCE) {
    await Promise.all(
      batches.slice(i, i + AT_ONCE).map(async (batch) => {
        const people = batch.map((r) => {
          const found = words.get(canonicalLinkedInProfileUrl(r.linkedin_url) ?? "");
          // A Google Maps business with no person yet: its "title" is the category (Plumber), not a job.
          if (!r.linkedin_url) {
            const business = r.company || r.full_name || "?";
            return {
              name: business,
              role: `Business listing${r.job_title ? ` (${r.job_title})` : ""}`,
              company: business,
              headline: "",
              industry: r.industry || "",
            };
          }
          return {
            name: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || "?",
            role: r.job_title ?? "",
            company: r.company ?? "",
            headline: found?.headline ?? "",
            industry: found?.industry || r.industry || "",
          };
        });
        const { verdicts } = await judgePeople(brief, people);
        // Ava didn't answer at all: leave them for the next run.
        if (verdicts.every((v) => !v)) return;
        const at = new Date().toISOString();
        await Promise.all(
          batch.map(async (r, j) => {
            const v = verdicts[j];
            // One she skipped is marked as looked at (no label), so the tick doesn't keep picking them up.
            const patch = v
              ? { fit: v.fit, fit_why: v.why || null, fit_by: "ava", fit_at: at }
              : { fit_by: "ava", fit_at: at };
            let q = supabaseAdmin.from("coach_lead_list_items").update(patch).eq("coach_id", coachId).or("fit_by.is.null,fit_by.eq.ava");
            q = r.identity_key ? q.eq("identity_key", r.identity_key) : q.eq("id", r.id);
            const { error } = await q;
            if (!error && v) labelled += 1;
          })
        );
      })
    );
  }
  return labelled;
}

/** One row per person: the same person on the Pool and a list is checked once. */
function onePerPerson(rows: PersonRow[]): PersonRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.coach_id}|${r.identity_key ?? r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** "Ask Ava to check": labels the picked people now, skipping anyone a person has labelled. */
export async function checkPeopleFit(coachId: string, itemIds: string[]): Promise<{ labelled: number; skipped: number }> {
  const brief = await coachBrief(coachId);
  if (!brief) throw new Error("Fill in Who goes on your list first (Your Ideal Client on the Blueprint), so Ava knows who fits.");
  const ids = itemIds.slice(0, CHECK_FIT_MAX);
  const { data, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select(PERSON_SELECT)
    .eq("coach_id", coachId)
    .in("id", ids)
    .or("fit_by.is.null,fit_by.eq.ava");
  if (error) throw new Error(error.message);
  const rows = onePerPerson((data ?? []) as PersonRow[]);
  const labelled = await labelRows(coachId, brief, rows);
  return { labelled, skipped: itemIds.length - labelled };
}

/**
 * The import tick: people new since Ava started labelling (job 278) who have
 * a LinkedIn profile and no label yet, up to `limit` a minute. Coaches whose
 * list box is empty wait until it's filled in.
 */
export async function labelNewPeopleFit(limit = 100): Promise<number> {
  const waiting: string[] = [];
  let labelled = 0;
  for (let round = 0; round < 3 && labelled < limit; round += 1) {
    let q = supabaseAdmin
      .from("coach_lead_list_items")
      .select(PERSON_SELECT)
      .is("fit", null)
      .is("fit_by", null)
      .not("linkedin_url", "is", null)
      .gte("created_at", FIT_LABELS_FROM)
      .order("created_at", { ascending: true })
      .limit(limit * 2);
    if (waiting.length) q = q.not("coach_id", "in", `(${waiting.join(",")})`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = onePerPerson((data ?? []) as PersonRow[]);
    if (!rows.length) break;
    const byCoach = new Map<string, PersonRow[]>();
    for (const r of rows) byCoach.set(r.coach_id, [...(byCoach.get(r.coach_id) ?? []), r]);
    for (const [coachId, people] of byCoach) {
      if (labelled >= limit) break;
      const brief = await coachBrief(coachId).catch(() => null);
      if (!brief) {
        waiting.push(coachId);
        continue;
      }
      labelled += await labelRows(coachId, brief, people.slice(0, limit - labelled));
    }
  }
  return labelled;
}

/** Most people one re-sort covers. */
export const RERATE_MAX = 600;

/**
 * After the coach sorts people in Check fit (job 285): Ava re-sorts everyone
 * else on that list with their calls as examples. Never touches a person's own call.
 */
export async function rerateListFit(coachId: string, listId: string): Promise<number> {
  const brief = await coachBrief(coachId);
  if (!brief) return 0;
  const page = await fetchAllSupabasePages<PersonRow>((from, to) =>
    supabaseAdmin
      .from("coach_lead_list_items")
      .select(PERSON_SELECT)
      .eq("coach_id", coachId)
      .eq("list_id", listId)
      .or("fit_by.is.null,fit_by.eq.ava")
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (page.error) throw new Error(page.error.message || "Could not load the list.");
  const rows = onePerPerson(page.data).slice(0, RERATE_MAX);
  return labelRows(coachId, brief, rows);
}
