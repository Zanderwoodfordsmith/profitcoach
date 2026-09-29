import type { CareerResult, PracticeKnowledgePayload, PracticeReportPayload } from "./types";
import { listValue, sourced, textValue } from "./sourced";
import type { KnowledgeSource, Sourced } from "./types";

export const BRIEF_SECTIONS = [
  { id: "experience", title: "Your experience and proof" },
  { id: "market", title: "Market and buyer" },
  { id: "offer", title: "Offer and positioning" },
  { id: "calls", title: "Get calls" },
  { id: "win", title: "Win clients" },
  { id: "serve", title: "Serve clients" },
  { id: "scorecard", title: "Practice scorecard" },
  { id: "priorities", title: "Current priorities" },
] as const;

export type BriefSectionId = (typeof BRIEF_SECTIONS)[number]["id"];

const HOURS_LABEL: Record<string, string> = {
  under_2_hours: "Under 2 hours a week",
  "2_5_hours_week": "2 to 5 hours a week",
  "5_10_hours_week": "5 to 10 hours a week",
  "10_15_hours_week": "10 to 15 hours a week",
  "15_plus_hours_week": "15 or more hours a week",
};

const MODEL_LABEL: Record<string, string> = {
  coaching: "Coaching",
  consulting: "Consulting",
  advisory: "Advisory",
  hybrid: "A hybrid of coaching, consulting, and advisory",
};

const FORMAT_LABEL: Record<string, string> = {
  one_to_one: "One-to-one",
  group: "Group",
  hybrid: "One-to-one and group",
};

const GEO_LABEL: Record<string, string> = {
  local: "Local",
  national: "National",
  international: "International",
};

const SOURCE_LABEL: Record<KnowledgeSource, string> = {
  linkedin: "LinkedIn",
  form: "Welcome",
  interview: "Conversation",
  admin: "BCA",
  coach_edit: "You",
};

export type BriefEdit =
  | "text"
  | "lines"
  | "hours"
  | "model"
  | "format"
  | "geo";

export type BriefBlock =
  | {
      kind: "prose";
      id: string;
      text: string;
      raw: string;
      sourceLabel: string | null;
      edit: BriefEdit;
    }
  | {
      kind: "career";
      results: CareerResult[];
      sourceLabel: string | null;
    }
  | { kind: "gap"; text: string };

export type BriefSection = {
  id: BriefSectionId;
  title: string;
  filled: boolean;
  blocks: BriefBlock[];
};

function sourceLabel(field: Sourced<unknown> | null | undefined): string | null {
  if (!field?.source) return null;
  return SOURCE_LABEL[field.source] ?? null;
}

function prose(
  id: string,
  text: string,
  field: Sourced<unknown> | null | undefined,
  edit: BriefEdit,
  raw?: string
): BriefBlock | null {
  const clean = text.trim();
  if (!clean) return null;
  return {
    kind: "prose",
    id,
    text: clean,
    raw: (raw ?? clean).trim(),
    sourceLabel: sourceLabel(field),
    edit,
  };
}

function careerSentence(result: CareerResult): string {
  const who = [result.role, result.company].filter(Boolean).join(" at ");
  const move =
    result.metric_from && result.metric_to
      ? `${result.metric_from} to ${result.metric_to}`
      : result.metric_to || result.metric_from;
  const bits = [who, move, result.timeframe ? `in ${result.timeframe}` : "", result.mechanism]
    .map((v) => v.trim())
    .filter(Boolean);
  return bits.join(", ");
}

export function hoursLabel(value: string): string {
  return HOURS_LABEL[value] ?? value.replaceAll("_", " ");
}

export function buildPracticeBrief(
  payload: PracticeKnowledgePayload,
  report: PracticeReportPayload | null
): BriefSection[] {
  const roles = listValue(payload.market.roles_held);
  const worked = listValue(payload.market.industries_worked);
  const whoBlocks = [
    prose("identity.location", textValue(payload.identity.location), payload.identity.location, "text"),
    prose(
      "identity.linkedin_url",
      textValue(payload.identity.linkedin_url),
      payload.identity.linkedin_url,
      "text"
    ),
    prose("market.roles_held", roles.join("\n"), payload.market.roles_held, "lines"),
    prose(
      "market.industries_worked",
      worked.join("\n"),
      payload.market.industries_worked,
      "lines"
    ),
    prose("identity.phone", textValue(payload.identity.phone), payload.identity.phone, "text"),
    prose("identity.website", textValue(payload.identity.website), payload.identity.website, "text"),
  ].filter((b): b is BriefBlock => Boolean(b));

  const career = payload.proof.career_results?.value ?? [];
  const careerFilled = career.some((r) => r.company || r.metric_from || r.metric_to);
  const client = payload.proof.client_results?.value ?? [];
  const clientText = client
    .map((r) => [r.title, r.story].filter(Boolean).join(". "))
    .filter(Boolean)
    .join("\n\n");
  const proofBlocks: BriefBlock[] = [];
  if (careerFilled) {
    proofBlocks.push({
      kind: "career",
      results: career,
      sourceLabel: sourceLabel(payload.proof.career_results),
    });
  }
  const clientBlock = prose(
    "proof.client_results",
    clientText,
    payload.proof.client_results,
    "text"
  );
  if (clientBlock) proofBlocks.push(clientBlock);
  if (!proofBlocks.length) {
    proofBlocks.push({
      kind: "gap",
      text: "Still open. One commercial result with a from, a to, and a timeframe.",
    });
  }

  const problems = listValue(payload.proof.problems_asked);
  const askedBlocks = [
    prose(
      "proof.problems_asked",
      problems.join("\n"),
      payload.proof.problems_asked,
      "lines"
    ),
    prose("proof.superpowers", textValue(payload.proof.superpowers), payload.proof.superpowers, "text"),
    prose("proof.uniqueness", textValue(payload.proof.uniqueness), payload.proof.uniqueness, "text"),
  ].filter((b): b is BriefBlock => Boolean(b));
  if (!askedBlocks.length) {
    askedBlocks.push({
      kind: "gap",
      text: "Still open. The problems people already ask you to solve, and what you are unusually good at.",
    });
  }

  const understand = listValue(payload.market.industries_understand);
  const credibility = listValue(payload.market.industries_credibility);
  const access = listValue(payload.market.industries_access);
  const avoid = listValue(payload.market.avoid);
  const buyers = listValue(payload.market.buyer_roles);
  const geo = payload.market.geography_pref?.value;
  const marketBlocks = [
    prose(
      "market.industries_understand",
      understand.length ? `Understands ${understand.join(", ")}` : "",
      payload.market.industries_understand,
      "lines",
      understand.join("\n")
    ),
    prose(
      "market.industries_credibility",
      credibility.length ? `Credible in ${credibility.join(", ")}` : "",
      payload.market.industries_credibility,
      "lines",
      credibility.join("\n")
    ),
    prose(
      "market.industries_access",
      access.length ? `Can access ${access.join(", ")}` : "",
      payload.market.industries_access,
      "lines",
      access.join("\n")
    ),
    prose(
      "market.avoid",
      avoid.length ? `Will not work with ${avoid.join(", ")}` : "",
      payload.market.avoid,
      "lines",
      avoid.join("\n")
    ),
    prose(
      "market.buyer_roles",
      buyers.length ? `Knows ${buyers.join(", ")}` : "",
      payload.market.buyer_roles,
      "lines",
      buyers.join("\n")
    ),
    prose(
      "market.geography_pref",
      geo ? GEO_LABEL[geo] ?? geo : "",
      payload.market.geography_pref,
      "geo",
      geo ?? ""
    ),
  ].filter((b): b is BriefBlock => Boolean(b));
  if (!marketBlocks.length && worked.length) {
    marketBlocks.push({
      kind: "gap",
      text: "LinkedIn shows where you have worked. Still open: where you have credibility, access, and who you will not take.",
    });
  } else if (!marketBlocks.length) {
    marketBlocks.push({
      kind: "gap",
      text: "Still open. Industries you understand, can access, and will not work with.",
    });
  }

  const hours = textValue(payload.working_times.hours_per_week);
  const calls = textValue(payload.working_times.prospect_call_hours);
  const model = payload.practice.delivery_model?.value;
  const format = payload.practice.delivery_format?.value;
  const workBlocks = [
    prose(
      "working_times.hours_per_week",
      hours ? hoursLabel(hours) : "",
      payload.working_times.hours_per_week,
      "hours",
      hours
    ),
    prose(
      "working_times.prospect_call_hours",
      calls ? `Prospect calls: ${calls}` : "",
      payload.working_times.prospect_call_hours,
      "text",
      calls
    ),
    prose(
      "practice.delivery_model",
      model ? MODEL_LABEL[model] ?? model : "",
      payload.practice.delivery_model,
      "model",
      model ?? ""
    ),
    prose(
      "practice.delivery_format",
      format ? FORMAT_LABEL[format] ?? format : "",
      payload.practice.delivery_format,
      "format",
      format ?? ""
    ),
    prose(
      "practice.min_fee",
      textValue(payload.practice.min_fee)
        ? `Minimum fee ${textValue(payload.practice.min_fee)}`
        : "",
      payload.practice.min_fee,
      "text",
      textValue(payload.practice.min_fee)
    ),
    prose(
      "practice.capacity",
      textValue(payload.practice.capacity)
        ? `Capacity ${textValue(payload.practice.capacity)}`
        : "",
      payload.practice.capacity,
      "text",
      textValue(payload.practice.capacity)
    ),
    prose("practice.more_of", textValue(payload.practice.more_of), payload.practice.more_of, "text"),
    prose("practice.less_of", textValue(payload.practice.less_of), payload.practice.less_of, "text"),
  ].filter((b): b is BriefBlock => Boolean(b));
  if (!workBlocks.length) {
    workBlocks.push({
      kind: "gap",
      text: "Still open. Hours, when you will take prospect calls, and whether this is coaching, consulting, or advisory.",
    });
  }

  const recommendBlocks: BriefBlock[] = report
    ? []
    : [
        {
          kind: "gap",
          text: "This writes itself once there is a precise result and we know what people ask you to solve.",
        },
      ];

  const proseId = (block: BriefBlock) => (block.kind === "prose" ? block.id : "");
  const take = (blocks: BriefBlock[], ids: string[]) =>
    blocks.filter((block) => ids.includes(proseId(block)));

  const experienceBlocks: BriefBlock[] = [
    ...take(whoBlocks, ["identity.location", "market.roles_held", "market.industries_worked"]),
    ...proofBlocks,
    ...askedBlocks,
  ];
  const offerBlocks = take(workBlocks, [
    "practice.delivery_model",
    "practice.delivery_format",
    "practice.min_fee",
    "practice.capacity",
    "practice.more_of",
    "practice.less_of",
  ]);
  const callBlocks = [
    ...take(whoBlocks, ["identity.linkedin_url", "identity.website", "identity.phone"]),
    ...take(workBlocks, ["working_times.hours_per_week", "working_times.prospect_call_hours"]),
  ];

  return [
    {
      id: "experience",
      title: "Your experience and proof",
      filled: experienceBlocks.some((b) => b.kind !== "gap"),
      blocks: experienceBlocks.length
        ? experienceBlocks
        : [{ kind: "gap", text: "Pull LinkedIn and this section starts to write itself." }],
    },
    {
      id: "market",
      title: "Market and buyer",
      filled: marketBlocks.some((b) => b.kind !== "gap"),
      blocks: marketBlocks,
    },
    {
      id: "offer",
      title: "Offer and positioning",
      filled: offerBlocks.length > 0 || Boolean(report?.offer_direction),
      blocks: offerBlocks.length
        ? offerBlocks
        : [
            {
              kind: "gap",
              text: "Still open. Coaching, consulting, or advisory, and the fee that makes a client worthwhile.",
            },
          ],
    },
    {
      id: "calls",
      title: "Get calls",
      filled: callBlocks.length > 0,
      blocks: callBlocks.length
        ? callBlocks
        : [{ kind: "gap", text: "LinkedIn, your site, and when you will take prospect calls land here." }],
    },
    {
      id: "win",
      title: "Win clients",
      filled: false,
      blocks: [
        {
          kind: "gap",
          text: "Your sales guide is written after the Decision Call. One conversation, not a stack of scripts.",
        },
      ],
    },
    {
      id: "serve",
      title: "Serve clients",
      filled: false,
      blocks: [
        {
          kind: "gap",
          text: "The delivery system and portal are built once the offer is decided.",
        },
      ],
    },
    {
      id: "scorecard",
      title: "Practice scorecard",
      filled: false,
      blocks: [
        {
          kind: "gap",
          text: "Prospects, calls, clients, and revenue appear here once a campaign is live.",
        },
      ],
    },
    {
      id: "priorities",
      title: "Current priorities",
      filled: Boolean(report),
      blocks: recommendBlocks,
    },
  ];
}

function linesOf(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function patchFromBriefEdit(
  payload: PracticeKnowledgePayload,
  id: string,
  value: string
): Partial<PracticeKnowledgePayload> {
  const text = sourced(value.trim(), "coach_edit" as const);
  const lines = sourced(linesOf(value), "coach_edit" as const);
  switch (id) {
    case "identity.location":
      return { identity: { ...payload.identity, location: text } };
    case "identity.linkedin_url":
      return { identity: { ...payload.identity, linkedin_url: text } };
    case "identity.phone":
      return { identity: { ...payload.identity, phone: text } };
    case "identity.website":
      return { identity: { ...payload.identity, website: text } };
    case "market.roles_held":
      return { market: { ...payload.market, roles_held: lines } };
    case "market.industries_worked":
      return { market: { ...payload.market, industries_worked: lines } };
    case "market.industries_understand":
      return { market: { ...payload.market, industries_understand: lines } };
    case "market.industries_credibility":
      return { market: { ...payload.market, industries_credibility: lines } };
    case "market.industries_access":
      return { market: { ...payload.market, industries_access: lines } };
    case "market.avoid":
      return { market: { ...payload.market, avoid: lines } };
    case "market.buyer_roles":
      return { market: { ...payload.market, buyer_roles: lines } };
    case "market.geography_pref":
      return {
        market: {
          ...payload.market,
          geography_pref:
            value === "local" || value === "national" || value === "international"
              ? sourced(value, "coach_edit")
              : payload.market.geography_pref,
        },
      };
    case "proof.superpowers":
      return { proof: { ...payload.proof, superpowers: text } };
    case "proof.uniqueness":
      return { proof: { ...payload.proof, uniqueness: text } };
    case "proof.problems_asked":
      return { proof: { ...payload.proof, problems_asked: lines } };
    case "proof.client_results":
      return {
        proof: {
          ...payload.proof,
          client_results: sourced(
            value
              .split(/\n{2,}/)
              .map((chunk) => chunk.trim())
              .filter(Boolean)
              .map((chunk, i) => ({
                id: `c${i + 1}`,
                title: chunk.split(". ")[0]?.slice(0, 120) ?? "Result",
                story: chunk,
              })),
            "coach_edit"
          ),
        },
      };
    case "working_times.hours_per_week":
      return { working_times: { ...payload.working_times, hours_per_week: text } };
    case "working_times.prospect_call_hours":
      return {
        working_times: {
          ...payload.working_times,
          prospect_call_hours: sourced(value.replace(/^Prospect calls:\s*/i, "").trim(), "coach_edit"),
        },
      };
    case "practice.delivery_model":
      return {
        practice: {
          ...payload.practice,
          delivery_model:
            value === "coaching" ||
            value === "consulting" ||
            value === "advisory" ||
            value === "hybrid"
              ? sourced(value, "coach_edit")
              : payload.practice.delivery_model,
        },
      };
    case "practice.delivery_format":
      return {
        practice: {
          ...payload.practice,
          delivery_format:
            value === "one_to_one" || value === "group" || value === "hybrid"
              ? sourced(value, "coach_edit")
              : payload.practice.delivery_format,
        },
      };
    case "practice.min_fee":
      return {
        practice: {
          ...payload.practice,
          min_fee: sourced(value.replace(/^Minimum fee\s*/i, "").trim(), "coach_edit"),
        },
      };
    case "practice.capacity":
      return {
        practice: {
          ...payload.practice,
          capacity: sourced(value.replace(/^Capacity\s*/i, "").trim(), "coach_edit"),
        },
      };
    case "practice.more_of":
      return { practice: { ...payload.practice, more_of: text } };
    case "practice.less_of":
      return { practice: { ...payload.practice, less_of: text } };
    default:
      return {};
  }
}

export function readyForRecommendation(payload: PracticeKnowledgePayload): boolean {
  const career = payload.proof.career_results?.value ?? [];
  const precise = career.some(
    (r) => r.precise && (r.metric_from.trim() || r.metric_to.trim()) && r.timeframe.trim()
  );
  const client = (payload.proof.client_results?.value ?? []).length > 0;
  return (
    (precise || client) &&
    Boolean(textValue(payload.proof.superpowers) || textValue(payload.proof.uniqueness)) &&
    listValue(payload.proof.problems_asked).length > 0
  );
}

export function careerSentenceFor(result: CareerResult): string {
  const sentence = careerSentence(result);
  return result.precise ? sentence : `${sentence} (no precise number yet)`;
}
