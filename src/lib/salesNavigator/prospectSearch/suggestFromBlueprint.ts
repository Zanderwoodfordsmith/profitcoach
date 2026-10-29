import { buildSalesNavSearch } from "@/lib/agent/tools/prospects";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { blocksToMarkdown, sanitizeBuiltSections } from "@/lib/practiceKnowledge/blocks";
import { loadProspectSearchAvatarContext } from "@/lib/salesNavigator/prospectSearch/loadAvatarContext";
import { normalizeProspectSearchStrategies } from "@/lib/salesNavigator/prospectSearch/normalizeStrategies";
import {
  PROSPECT_SEARCH_STRATEGIES_SYSTEM,
  buildProspectSearchStrategiesUser,
} from "@/lib/salesNavigator/prospectSearch/prompts";
import { resolveSalesNavRegion } from "@/lib/salesNavigator/regions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SalesNavSuggestion = {
  id: string;
  label: string;
  rationale: string;
  /** Company-name words, or empty for a keyword search. */
  terms: string[];
  keywords: string | null;
  url: string;
};

export type SalesNavSuggestResponse = {
  industry: string;
  summary: string;
  region: string;
  teamSizes: string[];
  searches: SalesNavSuggestion[];
};

const TEAM_SIZE_RULE = `
Also return a top-level "teamSizes" array for these searches:
- ["11-50"] by default.
- ["11-50", "51-200"] when the ideal client is a bigger firm (about £5M+ turnover or 50+ staff).
- Never include "1-10": it is the last resort, and the coach adds it later if the list is too small.

Keep each company-name search to at most 8 words, all clearly naming this kind of business, with quotes round phrases. Leave out loose words many other firms use (studio, arena, solutions, systems, technologies, tech, group, services). Make a second search rather than a longer one.

The coach reads each "label" and "rationale". Write them in everyday words: label under 6 words, no "Keywords:" prefix; rationale one sentence under 20 words. No em dashes.`;

/** The model still slips in em dashes now and then; the writing rules ban them. */
function plain(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").trim();
}

const FAILED = { error: "Could not suggest a search. Try again.", status: 502 } as const;

/** Ready-to-import Sales Nav searches from the coach's Blueprint, by the Classroom playbook. */
export async function suggestSalesNavSearches(
  coachId: string
): Promise<SalesNavSuggestResponse | { error: string; status: number }> {
  const [avatar, { data: practice }, { data: profile }] = await Promise.all([
    loadProspectSearchAvatarContext(coachId),
    supabaseAdmin
      .from("coach_practice_knowledge")
      .select("built_sections")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("location").eq("id", coachId).maybeSingle(),
  ]);

  const industry = avatar.industryHint?.trim() || "";
  if (!industry && !avatar.avatarSummary) {
    return {
      error: "Fill in who you help on your Blueprint first, then we can suggest a search.",
      status: 400,
    };
  }

  const criteriaBlocks = sanitizeBuiltSections(practice?.built_sections ?? {})["market:criteria"]
    ?.blocks;
  const criteria = criteriaBlocks?.length ? blocksToMarkdown(criteriaBlocks).slice(0, 3_000) : "";

  const location = (profile?.location as string | null)?.trim() || "";
  const region = resolveSalesNavRegion(location)?.text ?? "United Kingdom";

  const { data, error } = await generateCampaignJson<Record<string, unknown>>({
    system: `${PROSPECT_SEARCH_STRATEGIES_SYSTEM}\n${TEAM_SIZE_RULE}`,
    user: buildProspectSearchStrategiesUser({
      industry: industry || "See the avatar context.",
      location: region,
      notes: criteria ? `Prospect criteria from their Blueprint:\n${criteria}` : null,
      avatarSummary: avatar.avatarSummary,
    }),
    maxTokens: 4096,
  });
  if (error || !data) {
    return FAILED;
  }

  const result = normalizeProspectSearchStrategies(data, industry);
  if (!result) {
    return FAILED;
  }

  const askedSizes = Array.isArray(data.teamSizes) ? data.teamSizes : [];
  const teamSizes = askedSizes.includes("51-200") ? ["11-50", "51-200"] : ["11-50"];

  const searches: SalesNavSuggestion[] = [];
  for (const strategy of result.strategies) {
    if (strategy.kind === "beyond_linkedin") continue;
    const keywords = strategy.kind === "keywords" ? strategy.filters.keywordsBoolean ?? "" : "";
    const terms = strategy.kind === "keywords" ? [] : strategy.filters.companyIncludes;
    if (!keywords && terms.length === 0) continue;
    const built = buildSalesNavSearch({
      location: region,
      companyIncludes: terms,
      companyExcludesExtra: strategy.filters.companyExcludesExtra,
      keywords,
      titleIncludesExtra: strategy.filters.titleIncludesExtra,
      teamSizes,
      degrees: ["2", "3"],
    });
    if ("error" in built) continue;
    searches.push({
      id: strategy.id,
      label: plain(strategy.label),
      rationale: plain(strategy.rationale),
      terms,
      keywords: keywords || null,
      url: built.url,
    });
    if (searches.length === 3) break;
  }

  if (searches.length === 0) {
    return FAILED;
  }

  return {
    industry: result.industry,
    summary: result.coachFacingSummary,
    region,
    teamSizes,
    searches,
  };
}
