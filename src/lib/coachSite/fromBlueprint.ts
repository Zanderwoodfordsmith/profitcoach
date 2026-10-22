import { isClientResult, resultChange } from "@/lib/practiceKnowledge/results";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import type {
  BlueprintBlock,
  BuiltSection,
  CareerResult,
  DeliveryFormat,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
} from "@/lib/practiceKnowledge/types";
import type {
  CoachSite,
  CoachSiteFact,
  CoachSiteGapRow,
  CoachSiteOffer,
  CoachSitePhoto,
  CoachSiteQuote,
  CoachSiteSource,
  CoachSiteStep,
} from "./types";

export type CoachSiteInput = {
  slug: string;
  name: string;
  avatarUrl: string | null;
  /** From profiles.latitude / longitude (geocoded from their location). */
  lat: number | null;
  lng: number | null;
  /** Free-text location from the profile, used when the Blueprint has none. */
  profileLocation: string | null;
  row: PracticeKnowledgeRow | null;
  /** Better photos kept in /public for coaches who have them. */
  photo?: CoachSitePhoto | null;
  stagePhoto?: CoachSitePhoto | null;
  /** Live sites read only sections the coach or BCA signed off against the current version. */
  approvedOnly?: boolean;
};

/* ---------- Block helpers ---------- */

function signedOff(row: PracticeKnowledgeRow, key: string, built: BuiltSection): boolean {
  const revision = [built.generated_at, built.edited_at ?? ""].sort().pop() ?? "";
  const coach = row.payload.review.approved_sections?.value?.[key] ?? "";
  const bca = row.payload.review.bca_approved_sections?.value?.[key] ?? "";
  return (coach !== "" && coach >= revision) || (bca !== "" && bca >= revision);
}

function sectionBlocks(
  row: PracticeKnowledgeRow | null,
  key: string,
  approvedOnly: boolean
): BlueprintBlock[] {
  const built = row?.built_sections[key];
  if (!row || !built) return [];
  if (approvedOnly && !signedOff(row, key, built)) return [];
  return built.blocks;
}

/** Blocks between a heading (matched loosely) and the next heading. */
function underHeading(blocks: BlueprintBlock[], ...names: string[]): BlueprintBlock[] {
  const wanted = names.map((n) => n.toLowerCase());
  const start = blocks.findIndex(
    (b) => b.type === "heading" && wanted.includes(b.text.trim().toLowerCase())
  );
  if (start < 0) return [];
  const rest = blocks.slice(start + 1);
  const end = rest.findIndex((b) => b.type === "heading");
  return end < 0 ? rest : rest.slice(0, end);
}

function first<T extends BlueprintBlock["type"]>(
  blocks: BlueprintBlock[],
  type: T
): Extract<BlueprintBlock, { type: T }> | null {
  return (blocks.find((b) => b.type === type) as Extract<BlueprintBlock, { type: T }>) ?? null;
}

function clean(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  // Writing rules: never an em dash on a public page. The writers sometimes slip " - " in too,
  // but a range like "£1M - £8M" keeps its hyphen.
  return t
    .replace(/\s*—\s*/g, ", ")
    .replace(/(\S+)\s+-\s+(?=\S)/g, (match, before: string, offset: number, whole: string) => {
      const after = whole.slice(offset + match.length);
      return /\d[kKmM%]?$/.test(before) && /^[£$€\d]/.test(after) ? match : `${before}, `;
    });
}

function cleanList(items: string[] | undefined): string[] {
  return (items ?? []).map((i) => clean(i)).filter((i): i is string => Boolean(i));
}

/** "'The margin looked alright...'" → The margin looked alright... */
function unquote(text: string): string {
  return text.replace(/^['"‘“]+|['"’”]+$/g, "").trim();
}

/* ---------- Field readers ---------- */

function readLines(blocks: BlueprintBlock[]) {
  const messages = blocks.filter(
    (b): b is Extract<BlueprintBlock, { type: "message" }> => b.type === "message"
  );
  const byLabel = (...labels: string[]) =>
    clean(
      messages.find((m) => labels.includes(m.label.trim().toLowerCase()))?.body ?? null
    );
  return {
    short: byLabel("short line", "short"),
    medium: byLabel("medium"),
    long: byLabel("paragraph", "long"),
  };
}

function readGap(blocks: BlueprintBlock[]): CoachSiteGapRow[] {
  const table = first(underHeading(blocks, "The gap"), "table");
  if (!table) return [];
  return table.rows
    .map((r) => ({ today: clean(r[0]) ?? "", want: clean(r[1]) ?? "" }))
    .filter((r) => r.today && r.want);
}

function paragraphUnder(blocks: BlueprintBlock[], heading: string): string | null {
  return clean(first(underHeading(blocks, heading), "paragraph")?.text ?? null);
}

function readOffer(blocks: BlueprintBlock[]): CoachSiteOffer | null {
  const pairs = first(underHeading(blocks, "The offer"), "pairs");
  if (pairs) {
    const get = (label: string) =>
      clean(pairs.items.find((p) => p.label.trim().toLowerCase() === label)?.value ?? null);
    // Price options and proof are left out on purpose: prices stay off marketing pages,
    // and proof has its own section.
    const offer: CoachSiteOffer = {
      name: get("name"),
      promise: get("promise"),
      whoFor: get("who it is for"),
      included: get("what is included"),
      format: get("format"),
    };
    if (Object.values(offer).some(Boolean)) return offer;
  }
  const offer: CoachSiteOffer = {
    name: null,
    promise: paragraphUnder(blocks, "Our promise"),
    whoFor: paragraphUnder(blocks, "Who we help"),
    included: cleanList(first(underHeading(blocks, "Our strategy"), "numbered")?.items).join(" "),
    format: paragraphUnder(blocks, "Think of this as"),
  };
  offer.included = offer.included || null;
  return Object.values(offer).some(Boolean) ? offer : null;
}

function readFacts(...sources: BlueprintBlock[][]): CoachSiteFact[] {
  for (const blocks of sources) {
    const stats = first(blocks, "stats");
    if (stats?.items.length) {
      return stats.items
        .map((s) => ({ value: clean(s.value) ?? "", label: clean(s.label) ?? "" }))
        .filter((s) => s.value && s.label);
    }
  }
  return [];
}

function readSteps(blocks: BlueprintBlock[]): CoachSiteStep[] {
  const steps = first(blocks, "steps");
  return (steps?.items ?? [])
    .map((s) => ({ title: clean(s.title) ?? "", detail: clean(s.detail) ?? "" }))
    .filter((s) => s.title);
}

/** "John Davy, business owner (testimonial)" → "John Davy, business owner". */
function citeFromTitle(title: string): string {
  return title.replace(/\s*\((testimonial|client testimonial)\)\s*$/i, "").trim();
}

/** What clients said, from the client results that have their words and a name. */
function readTestimonials(row: PracticeKnowledgeRow | null): CoachSiteQuote[] {
  const results = row?.payload.proof.career_results?.value ?? [];
  return results
    .filter(isClientResult)
    .map((r) => ({
      quote: clean(unquote(r.quote ?? "")) ?? "",
      cite: citeFromTitle([r.client_name?.trim(), r.company.trim()].filter(Boolean).join(", ")),
    }))
    .filter((q) => q.quote && q.cite);
}

/** A Results bullet that is just a testimonial again (starts with the client's name). */
function isTestimonialEcho(text: string, quotes: CoachSiteQuote[]): boolean {
  return quotes.some((q) => {
    const who = q.cite.split(",")[0]?.trim();
    return Boolean(who && text.startsWith(who));
  });
}

function readPlace(input: CoachSiteInput, onepager: BlueprintBlock[]) {
  const pairs = onepager.filter(
    (b): b is Extract<BlueprintBlock, { type: "pairs" }> => b.type === "pairs"
  );
  const fromProfile = pairs
    .flatMap((p) => p.items)
    .find((i) => i.label.trim().toLowerCase() === "location")?.value;
  const raw =
    clean(fromProfile) ??
    clean(input.row?.payload.identity.location?.value ?? null) ??
    clean(input.profileLocation);
  if (!raw && input.lat == null) return null;
  // "Kingston Upon Hull, England, United Kingdom" → "Kingston Upon Hull, England"
  const label = raw ? raw.split(",").slice(0, 2).join(",").trim() : "";
  return { label, lat: input.lat, lng: input.lng };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function formatDelivery(format: DeliveryFormat | ""): string | null {
  if (format === "one_to_one") return "One to one";
  if (format === "group") return "Group sessions";
  if (format === "hybrid") return "One to one and group";
  return null;
}

function formatCareer(result: CareerResult): string | null {
  if (!resultChange(result)) return null;
  const when = result.timeframe.trim();
  const where = isClientResult(result)
    ? [result.client_name?.trim(), result.company.trim()].filter(Boolean).join(" at ")
    : [result.role.trim(), result.company.trim()].filter(Boolean).join(" at ");
  const line = [resultChange(result), when, where].filter(Boolean).join(", ");
  return clean(line);
}

function careerResults(payload: PracticeKnowledgePayload | undefined): string[] {
  return (payload?.proof.career_results?.value ?? [])
    .map(formatCareer)
    .filter((line): line is string => Boolean(line));
}

function defaultMethod(
  payload: PracticeKnowledgePayload | undefined,
  offer: CoachSiteOffer | null
): CoachSiteStep[] {
  const format = formatDelivery(payload?.practice.delivery_format?.value ?? "");
  const rhythm = textValue(payload?.practice.session_rhythm);
  const clock = textValue(payload?.practice.offer_timeframe);
  const included = offer?.included?.trim() || "";
  const work =
    [format, rhythm].filter(Boolean).join(". ") ||
    "Weekly sessions on the numbers that matter this quarter.";
  const steps: CoachSiteStep[] = [
    {
      title: "Start with the score",
      detail: "A 15-minute BOSS Scorecard so you can see where the business actually stands.",
    },
    { title: "Ninety days of work", detail: work },
  ];
  if (clock) steps.push({ title: "A result you can point to", detail: clock });
  else if (included) steps.push({ title: "What you leave with", detail: included });
  return steps;
}

/* ---------- The mapper ---------- */

export function coachSiteFromBlueprint(input: CoachSiteInput): CoachSite {
  const approvedOnly = Boolean(input.approvedOnly);
  const payload = input.row?.payload;
  const direction = sectionBlocks(input.row, "offer:direction", approvedOnly);
  const lines = sectionBlocks(input.row, "offer:lines", approvedOnly);
  const onepager = sectionBlocks(input.row, "story:onepager", approvedOnly);
  const bioBlocks = sectionBlocks(input.row, "story:bio", approvedOnly);
  const avatar = sectionBlocks(input.row, "market:avatar", approvedOnly);

  const three = readLines(lines);
  const testimonials = readTestimonials(input.row);
  const fromCareer = careerResults(payload);
  const fromOnepagerResults = cleanList(
    first(underHeading(onepager, "Results"), "bullets")?.items
  ).filter((r) => !isTestimonialEcho(r, testimonials));
  const results = fromCareer.length ? fromCareer : fromOnepagerResults;
  const fromPayloadProblems = listValue(payload?.proof.problems_asked).map(unquote).map(clean).filter(
    (line): line is string => Boolean(line)
  );
  const fromOnepagerProblems = cleanList(
    first(underHeading(onepager, "The problems I fix"), "bullets")?.items
  ).map(unquote);
  const ownerWords = fromPayloadProblems.length ? fromPayloadProblems : fromOnepagerProblems;

  const photo =
    input.photo ??
    (input.avatarUrl
      ? {
          src: input.avatarUrl,
          alt: input.name,
          kind: "avatar" as const,
          width: 450,
          height: 450,
        }
      : null);

  const linkedin = input.row?.payload.identity.linkedin_url?.value?.trim() || null;
  const slug = encodeURIComponent(input.slug);
  const offer = readOffer(direction);
  const storedMethod = readSteps(underHeading(onepager, "How I work"));
  const hasOfferShape = Boolean(
    offer ||
      payload?.practice.delivery_format?.value ||
      textValue(payload?.practice.offer_timeframe) ||
      textValue(payload?.practice.session_rhythm)
  );

  const site: CoachSite = {
    slug: input.slug,
    name: input.name,
    firstName: firstName(input.name),
    photo,
    stagePhoto: input.stagePhoto ?? null,
    place: readPlace(input, onepager),
    linkedinUrl: linkedin && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(linkedin) ? linkedin : null,

    positioning: clean(first(direction, "lede")?.text) ?? paragraphUnder(direction, "Our promise"),
    shortLine: three.short,
    mediumLine: three.medium,
    longLine: three.long,
    intro:
      paragraphUnder(bioBlocks, "For partners and events") ??
      clean(first(onepager, "lede")?.text) ??
      clean(first(bioBlocks, "lede")?.text),
    whoIHelp:
      offer?.whoFor ??
      paragraphUnder(onepager, "Who I help") ??
      clean(first(avatar, "lede")?.text),
    ownerWords,
    gap: readGap(direction),
    keyMessages: (() => {
      const legacy = cleanList(first(underHeading(direction, "Key messages"), "numbered")?.items);
      return legacy.length
        ? legacy
        : cleanList(first(underHeading(direction, "Our strategy"), "numbered")?.items);
    })(),
    method: storedMethod.length ? storedMethod : hasOfferShape ? defaultMethod(payload, offer) : [],
    offer,
    whyMe: cleanList(first(underHeading(direction, "Why you"), "bullets")?.items),
    bio: clean(first(underHeading(bioBlocks, "Short bio"), "paragraph")?.text),
    facts: readFacts(bioBlocks, onepager),
    testimonials,
    results,

    links: {
      score: `/score/${slug}`,
      assessment: `/assessment/${slug}`,
      book: `/book/${slug}`,
    },
    missing: [],
    approvedOnly,
  };

  const missing: CoachSiteSource[] = [];
  if (!direction.length) missing.push("offer:direction");
  if (!lines.length) missing.push("offer:lines");
  if (!bioBlocks.length) missing.push("story:bio");
  if (!ownerWords.length) missing.push("proof.problems_asked");
  if (!testimonials.length) missing.push("proof.client_results");
  if (!site.photo) missing.push("photo");
  if (!site.place) missing.push("location");
  site.missing = missing;

  return site;
}
