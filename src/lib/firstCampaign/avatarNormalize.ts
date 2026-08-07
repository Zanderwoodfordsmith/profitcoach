import type { IdealClientProfilePayload, AvatarPayload, LabelledPoint } from "./types";

/** Build a prompt-ready profile stub from a saved coach_icps row (no LLM). */
export function stubProfileFromIcp(icp: {
  label?: string | null;
  industry?: string | null;
  geography?: string | null;
  role_titles?: string[] | null;
  team_size?: string | null;
  revenue_range?: string | null;
  profile_payload?: IdealClientProfilePayload | null;
}): IdealClientProfilePayload {
  const existing = icp.profile_payload;
  if (existing && typeof existing === "object" && existing.targetMarket) {
    return existing;
  }

  const industry = icp.industry?.trim() || "Business services";
  const geography = icp.geography?.trim() || "United Kingdom";
  const teamSize = icp.team_size?.trim() || "11-50";
  const revenueRange = icp.revenue_range?.trim() || "£1M-£10M";
  const roleTitles =
    icp.role_titles && icp.role_titles.length > 0
      ? icp.role_titles
      : ["Owner", "Founder", "CEO", "Managing Director"];

  return {
    targetMarket: {
      industry,
      geography,
      teamSize,
      revenueRange,
    },
    decisionMaker: {
      roleTitles,
      profile: [
        `Runs a ${teamSize}-person ${industry} business in ${geography}.`,
      ],
    },
    currentReality: [
      "Still the bottleneck for key decisions.",
      "Busy weeks that don't reliably translate into profit.",
    ],
    corePainPoints: [
      {
        theme: "Control",
        points: [
          {
            label: "Bottleneck",
            text: "Everything still routes through them.",
          },
        ],
      },
    ],
    desiredOutcomes: [
      {
        label: "Freedom",
        text: "A business that runs without them in every detail.",
      },
    ],
    notAFit: ["Pre-revenue founders", "Lifestyle solopreneurs with no team"],
    coachPositioning: {
      positioningStatement: `I help ${roleTitles[0]?.toLowerCase() ?? "owners"} of ${industry.toLowerCase()} businesses get their time and margins back.`,
      whyThisCoach: [],
      messagingHooks: [],
    },
    oneLineSummary: icp.label?.trim() || `${industry} ${roleTitles[0]} — ${geography}`,
  };
}

function asPoints(value: unknown): LabelledPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: item };
      if (item && typeof item === "object" && "text" in item) {
        const o = item as { label?: unknown; text?: unknown };
        return {
          label: typeof o.label === "string" ? o.label : undefined,
          text: String(o.text ?? ""),
        };
      }
      return null;
    })
    .filter((p): p is LabelledPoint => Boolean(p && p.text));
}

/**
 * Normalise model output so the review UI never crashes on missing fields.
 * Returns null if the payload is too empty to be useful.
 */
export function normalizeAvatarPayload(raw: unknown): AvatarPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const personaRaw =
    r.persona && typeof r.persona === "object"
      ? (r.persona as Record<string, unknown>)
      : null;
  if (!personaRaw) return null;

  const triggersRaw =
    r.triggers && typeof r.triggers === "object"
      ? (r.triggers as Record<string, unknown>)
      : {};

  const demographics =
    personaRaw.demographics && typeof personaRaw.demographics === "object"
      ? (personaRaw.demographics as Record<string, unknown>)
      : {};

  const specificProblemRaw =
    personaRaw.specificProblem && typeof personaRaw.specificProblem === "object"
      ? (personaRaw.specificProblem as Record<string, unknown>)
      : null;

  const realityRaw =
    personaRaw.reality && typeof personaRaw.reality === "object"
      ? (personaRaw.reality as Record<string, unknown>)
      : null;

  const headline = String(personaRaw.headline ?? "").trim();
  const personaName = String(personaRaw.personaName ?? "").trim();
  if (!headline && !personaName) return null;

  const pronounRaw = String(personaRaw.subjectPronoun ?? "they").toLowerCase();
  const subjectPronoun =
    pronounRaw === "he" || pronounRaw === "she" ? pronounRaw : "they";

  const vocabRaw =
    r.industryVocabulary && typeof r.industryVocabulary === "object"
      ? (r.industryVocabulary as Record<string, unknown>)
      : undefined;

  return {
    triggers: {
      dreams: asPoints(triggersRaw.dreams),
      pastFailures: asPoints(triggersRaw.pastFailures),
      fears: asPoints(triggersRaw.fears),
      suspicions: asPoints(triggersRaw.suspicions),
      enemies: asPoints(triggersRaw.enemies),
    },
    persona: {
      headline: headline || `${personaName}: Ideal client`,
      personaName: personaName || "Alex",
      subjectPronoun,
      demographics: {
        age: String(demographics.age ?? ""),
        location: String(demographics.location ?? ""),
        education: String(demographics.education ?? ""),
        occupation: String(demographics.occupation ?? ""),
        businessSize:
          typeof demographics.businessSize === "string"
            ? demographics.businessSize
            : undefined,
      },
      specificProblem: {
        text: String(
          specificProblemRaw?.text ??
            personaRaw.specificProblem ??
            "Things feel busier than they are profitable."
        ),
        isQuoted: Boolean(specificProblemRaw?.isQuoted ?? true),
      },
      triggeringEvents: asPoints(personaRaw.triggeringEvents),
      background: String(personaRaw.background ?? ""),
      reality: {
        headingSuffix:
          typeof realityRaw?.headingSuffix === "string"
            ? realityRaw.headingSuffix
            : undefined,
        prose: String(realityRaw?.prose ?? ""),
      },
      internalMonologue: String(personaRaw.internalMonologue ?? ""),
      goals: asPoints(personaRaw.goals),
      challenges: asPoints(personaRaw.challenges),
      behaviour: asPoints(personaRaw.behaviour),
      quote: String(
        personaRaw.quote ?? "I need someone who has done this before."
      ),
    },
    industryVocabulary: vocabRaw
      ? {
          customers:
            typeof vocabRaw.customers === "string" ? vocabRaw.customers : undefined,
          staff: typeof vocabRaw.staff === "string" ? vocabRaw.staff : undefined,
          jobs: typeof vocabRaw.jobs === "string" ? vocabRaw.jobs : undefined,
          money: typeof vocabRaw.money === "string" ? vocabRaw.money : undefined,
          extra: Array.isArray(vocabRaw.extra)
            ? vocabRaw.extra.map(String)
            : undefined,
        }
      : undefined,
    mainDesires: Array.isArray(r.mainDesires)
      ? r.mainDesires.map(String).filter(Boolean)
      : undefined,
    messagingHooks: Array.isArray(r.messagingHooks)
      ? r.messagingHooks.map(String).filter(Boolean)
      : undefined,
  };
}
