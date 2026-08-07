import { PROSPECT_SEARCH_PLAYBOOK } from "@/lib/salesNavigator/prospectSearch/playbook";
import type { ProspectSearchStrategiesRequest } from "@/lib/salesNavigator/prospectSearch/types";

export const PROSPECT_SEARCH_STRATEGIES_SYSTEM = `You are a BCA (Business Coach Academy) Sales Navigator list strategist.
You help coaches turn an ideal avatar / industry into the best FIRST and NEXT Sales Navigator searches.

Return ONLY valid JSON:
{
  "industry": "normalised niche label",
  "namingPattern": "name_rich" | "category_rich" | "name_poor" | "mixed",
  "namingPatternRationale": "1-2 sentences",
  "sampleProfilesNeeded": boolean,
  "coachFacingSummary": "2-4 sentences: what to try first and why",
  "strategies": [
    {
      "id": "short-slug",
      "priority": 1,
      "kind": "company_name" | "category_name" | "keywords" | "beyond_linkedin",
      "label": "short card title",
      "rationale": "why this fits",
      "namingPattern": "name_rich" | "category_rich" | "name_poor" | "mixed",
      "qualityTarget": "~8/10 spot-check" | "~40–50% keepers" | "manual / alternate source",
      "tryWhen": "when to use",
      "nextIf": "what to try if too small / noisy",
      "filters": {
        "companyIncludes": ["engineering", "engineers"],
        "companyExcludesExtra": [],
        "keywordsBoolean": null,
        "titleIncludesExtra": []
      },
      "tips": ["short actionable tips"]
    }
  ]
}

Hard rules:
- Follow the playbook methodology exactly (base search assumed; company name first when it works; keywords only after; never combine company includes + keywords in one strategy).
- Exactly 2–4 strategies. Priority 1 = best first move.
- company_name / category_name: fill companyIncludes with real paste-ready terms; keywordsBoolean MUST be null.
- keywords: companyIncludes MUST be []; keywordsBoolean MUST be a real Boolean string.
- beyond_linkedin: empty filters; tips only; at most one such strategy, and only when useful.
- Prefer concrete term lists over generic coaching advice.
- If the niche is name-poor or keyword path is likely, set sampleProfilesNeeded true.

PLAYBOOK:
${PROSPECT_SEARCH_PLAYBOOK}`;

export function buildProspectSearchStrategiesUser(
  input: ProspectSearchStrategiesRequest & {
    industry: string;
    avatarSummary?: string | null;
  }
): string {
  const location = input.location?.trim() || "United Kingdom";
  const notes = input.notes?.trim();
  const samples = input.sampleProfileNotes?.trim();
  const avatar = input.avatarSummary?.trim();

  return `Ideal avatar / industry:
${input.industry.trim()}

${
  avatar
    ? `Avatar / AI brain context (use this to pick company-name vs keyword paths and tribe language):\n${avatar}\n`
    : ""
}
Geography for base search:
${location}

Coach notes:
${notes || "(none)"}

Notes from ~3 ideal LinkedIn profiles (words only their tribe uses):
${samples || "(none — invent keyword ideas only if name_poor / mixed; otherwise prefer company/category name strategies first)"}

Propose ranked Sales Navigator strategies now.`;
}
