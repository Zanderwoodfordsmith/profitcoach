import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { summarizeLinkedInSnapshot } from "./linkedinSummary";

export type LibraryRow = {
  id: string;
  industry_key: string;
  industry_label: string;
  depth: "deep" | "light";
  confidence: "high" | "medium" | "low";
  role_titles: string[];
  team_size: string;
  revenue_range: string;
  geography: string;
  vocabulary: {
    customers?: string;
    staff?: string;
    jobs?: string;
    money?: string;
    extra?: string[];
  } | null;
  universal_pains: string[];
  industry_pains: string[];
  main_desires: string[];
  objections: string[];
  buying_triggers: string[];
  exemplar_payload: Record<string, unknown> | null;
  source_files: string[];
};

/** Load the coach's LinkedIn snapshot as a prompt-ready text summary. */
export async function loadCoachLinkedInSummary(
  coachId: string
): Promise<{ summary: string; snapshot: LinkedInProfileSnapshot | null }> {
  const [{ data: linkedinRow }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("coach_linkedin_profiles")
      .select("snapshot")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, coach_business_name")
      .eq("id", coachId)
      .maybeSingle(),
  ]);

  const snapshot = (linkedinRow?.snapshot as LinkedInProfileSnapshot | null) ?? null;
  const summary = summarizeLinkedInSnapshot(snapshot, {
    fullName: profile?.full_name ?? null,
    businessName: profile?.coach_business_name ?? null,
  });
  return { summary, snapshot };
}

const STOPWORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "a",
  "an",
  "services",
  "service",
  "companies",
  "company",
  "business",
  "businesses",
  "industry",
  "sector",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Best-effort match of a free-text industry name against the seeded library. */
export async function findLibraryMatch(industry: string): Promise<LibraryRow | null> {
  const trimmed = industry.trim();
  if (!trimmed) return null;

  const { data: rows } = await supabaseAdmin.from("icp_avatar_library").select("*");
  const library = (rows ?? []) as LibraryRow[];
  if (library.length === 0) return null;

  const needleWords = significantWords(trimmed);
  if (needleWords.length === 0) return null;

  let best: { row: LibraryRow; score: number } | null = null;
  for (const row of library) {
    const haystack = significantWords(`${row.industry_label} ${row.industry_key.replace(/_/g, " ")}`);
    const overlap = needleWords.filter((w) => haystack.includes(w)).length;
    if (overlap === 0) continue;
    const depthBonus = row.depth === "deep" ? 0.5 : 0;
    const score = overlap + depthBonus;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

export function buildLibraryContextText(row: LibraryRow | null): string {
  if (!row) return "";
  const lines: string[] = [`Closest library match: ${row.industry_label} (${row.depth})`];
  if (row.industry_pains?.length) {
    lines.push("Industry-specific pains:", ...row.industry_pains.map((p) => `- ${p}`));
  }
  if (row.universal_pains?.length) {
    lines.push("Universal owner pains:", ...row.universal_pains.map((p) => `- ${p}`));
  }
  if (row.main_desires?.length) {
    lines.push("Desire hooks:", ...row.main_desires.map((d) => `- ${d}`));
  }
  if (row.objections?.length) {
    lines.push("Common objections:", ...row.objections.map((o) => `- ${o}`));
  }
  if (row.buying_triggers?.length) {
    lines.push("Buying triggers:", ...row.buying_triggers.slice(0, 6).map((t) => `- ${t}`));
  }
  return lines.join("\n");
}

export function buildVocabularyText(row: LibraryRow | null): string {
  if (!row?.vocabulary) return "";
  const v = row.vocabulary;
  const lines = [
    v.customers && `customers → ${v.customers}`,
    v.staff && `staff → ${v.staff}`,
    v.jobs && `jobs → ${v.jobs}`,
    v.money && `money → ${v.money}`,
    ...(v.extra ?? []).map((e) => `term → ${e}`),
  ].filter(Boolean);
  return lines.join("\n");
}
