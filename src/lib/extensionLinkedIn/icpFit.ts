import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import { loadProspectSearchAvatarContext } from "@/lib/salesNavigator/prospectSearch/loadAvatarContext";
import type { DraftNoteProfile } from "@/lib/extensionLinkedIn/draftNote";

export const ICP_FIT_LEVELS = [
  "very_weak",
  "weak",
  "okay",
  "strong",
  "ideal",
] as const;

export type IcpFitLevel = (typeof ICP_FIT_LEVELS)[number];

export const ICP_FIT_LEVEL_LABELS: Record<IcpFitLevel, string> = {
  very_weak: "Very weak",
  weak: "Weak",
  okay: "Okay",
  strong: "Strong",
  ideal: "Ideal",
};

/** Map 0–100 score → five UI levels. */
export function icpFitLevelFromScore(score: number): IcpFitLevel {
  if (score >= 80) return "ideal";
  if (score >= 60) return "strong";
  if (score >= 40) return "okay";
  if (score >= 20) return "weak";
  return "very_weak";
}

export type IcpFitResult = {
  score: number;
  label: IcpFitLevel;
  labelText: string;
  whyFit: string[];
  whyNot: string[];
  talkingPoints: string[];
  icpSource: "avatar" | "icp" | "brain" | null;
};

export type IcpFitProfile = DraftNoteProfile & {
  /** LinkedIn network distance: 1st / 2nd / 3rd — NOT a job title. */
  connectionDegree?: string | null;
};

const ROLE_AFTER_DEGREE =
  /^(director|co-?director|founder|co-?founder|owner|md|ceo|coo|cfo|partner|manager|managing director|proprietor)\b/i;

/** Strip LinkedIn network-distance tokens wrongly glued onto titles. */
export function sanitizeLinkedInTitleField(
  input: string | null | undefined
): string | null {
  if (!input?.trim()) return null;
  let t = input.trim().replace(/\s+/g, " ");
  t = t.replace(/^[·•|]\s*/g, "");
  t = t.replace(/\s*[·•|]\s*(1st|2nd|3rd)\s*(degree)?\s*$/i, "");
  // "2nd Director" → Director (distance badge glued on). Keep "3rd Generation…".
  const glued = t.match(/^(1st|2nd|3rd)\s*(degree)?\s*[·•|]?\s+(.+)$/i);
  if (glued?.[3] && ROLE_AFTER_DEGREE.test(glued[3])) {
    t = glued[3];
  }
  if (/^(1st|2nd|3rd)$/i.test(t)) return null;
  t = t.trim();
  return t || null;
}

const SYSTEM = `You score how well a LinkedIn prospect fits a BCA coach's Ideal Client Profile.

You are a practical UK business coach scoring outreach priority — not a strict filter.
Default to generous when core signals look right. Missing data is not a fail.

Return ONLY valid JSON:
{
  "score": 0-100,
  "whyFit": ["short bullet", "..."],
  "whyNot": ["short bullet", "..."],
  "talkingPoints": ["short angle for outreach", "..."]
}

Scoring guide (use the high end of the band when unsure):
- 90-100: Ideal — director/owner/MD in the right niche AND same town / core ICP geography. Warm 2nd-degree is a bonus.
- 80-89: Ideal — same, with only tiny gaps
- 60-79: Strong — good ICP with small gaps (nearby town, size unclear, slightly adjacent niche)
- 40-59: Okay — real overlap but meaningful doubt (wrong seniority OR weak niche — not merely a thin profile)
- 20-39: Weak — thin overlap only
- 0-19: Very weak — clearly wrong role/industry

CRITICAL — LinkedIn "1st" / "2nd" / "3rd":
- These mean network distance (how connected you are), NOT job seniority.
- NEVER invent titles like "2nd Director" or "2nd owner". If title is Director, they are a Director.
- connectionDegree "2nd" is a POSITIVE warm signal (shared connection) — mention in whyFit, raise the score slightly.

Geography:
- Same town as the coach ICP = Ideal geography. Zero ding.
- Neighbouring UK towns/counties within ~45–60 minutes = GOOD fit (tiny ding at most).
- Only dock hard for clearly distant regions.

Company size / thin profiles:
- Do NOT punish missing About, missing headline detail, unknown turnover, or unknown headcount.
- Thin LinkedIn profiles are normal for trades/construction owners. Score on role + industry + location.
- Never put "no about section" or "can't verify £1M–£10M" as a reason to drop below Strong when core signals match.
- Only dock size if the company is clearly far outside the ICP.

Niche / role:
- Owner, founder, MD, director, partner in the coach’s industry → strong/ideal baseline when geo matches.
- Adjacent niches (e.g. construction recruitment) → mild ding only.
- Employees with no ownership signal score lower than directors/owners.
- Clear wrong industry → Weak / Very weak.

Rules:
- Same town + construction (or ICP industry) + director/owner ≈ 90–95. That is Ideal, not Okay.
- Bias upward when owner/director + niche + local geography align.
- Use only evidence from the prospect fields + ICP context. Do not invent employers, titles, headcount, or P&L doubts from network distance.
- whyFit / whyNot: 1-3 short bullets. Prefer concrete facts. Leave whyNot empty or very light when the lead is Ideal.
- talkingPoints: 2 concrete personalisation angles (not full messages). Do not invent company size brackets.
- No markdown fences.`;

export async function scoreProspectIcpFit(opts: {
  coachId: string;
  profile: IcpFitProfile;
}): Promise<IcpFitResult> {
  const [avatarCtx, brain] = await Promise.all([
    loadProspectSearchAvatarContext(opts.coachId),
    loadCoachAiContextRow(opts.coachId),
  ]);

  if (!avatarCtx.avatarSummary && !brain?.ideal_client?.trim()) {
    throw new Error(
      "No Ideal Client set yet. Finish First Campaign ICP/avatar (or AI brain ideal client) first."
    );
  }

  const jobTitle = sanitizeLinkedInTitleField(opts.profile.jobTitle);
  const headline = sanitizeLinkedInTitleField(opts.profile.headline);
  const degreeRaw = opts.profile.connectionDegree?.trim().toLowerCase() || null;
  const connectionDegree =
    degreeRaw && /^(1st|2nd|3rd)$/.test(degreeRaw) ? degreeRaw : null;

  const user = `ICP / avatar context (source=${avatarCtx.source ?? "none"}):
${avatarCtx.avatarSummary || "(none)"}

Coach brain ideal_client (may duplicate):
${brain?.ideal_client?.trim() || "(none)"}

Prospect:
${JSON.stringify(
  {
    fullName: opts.profile.fullName,
    jobTitle,
    businessName: opts.profile.businessName ?? null,
    headline,
    location: opts.profile.location ?? null,
    about: opts.profile.about?.slice(0, 1200) ?? null,
    connectionDegree,
    linkedinUrl: opts.profile.linkedinUrl ?? null,
  },
  null,
  2
)}

Reminders:
- connectionDegree is LinkedIn network distance only (1st/2nd/3rd). It is NOT part of their job title.
- Thin profile / missing About / unknown turnover must NOT tank a same-town director in the right industry.
- Same town + right niche + director/owner → score around 90–95.

Score fit and return JSON.`;

  const { data, error } = await generateCampaignJson<{
    score?: number;
    whyFit?: string[];
    whyNot?: string[];
    talkingPoints?: string[];
  }>({
    system: SYSTEM,
    user,
    maxTokens: 1024,
  });

  if (error || !data) {
    throw new Error(error || "Could not score ICP fit.");
  }

  let score = Number(data.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const label = icpFitLevelFromScore(score);

  const asBullets = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 4)
      : [];

  return {
    score,
    label,
    labelText: ICP_FIT_LEVEL_LABELS[label],
    whyFit: asBullets(data.whyFit),
    whyNot: asBullets(data.whyNot),
    talkingPoints: asBullets(data.talkingPoints),
    icpSource: avatarCtx.source,
  };
}
