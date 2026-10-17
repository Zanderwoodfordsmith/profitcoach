import { coachSiteFromBlueprint } from "@/lib/coachSite/fromBlueprint";
import type { PracticeKnowledgeRow } from "./types";
import { listValue, textValue } from "./sourced";

export type BrochureGap = { label: string; href: string };

export type ProgrammeBrochure = {
  coachName: string;
  firstName: string;
  role: string;
  photoUrl: string | null;
  headline: string | null;
  promise: string | null;
  whoFor: string | null;
  stats: { value: string; label: string }[];
  problems: string[];
  helpWith: string[];
  timeframe: string | null;
  format: string | null;
  bio: string | null;
  intro: string | null;
  testimonials: { quote: string; cite: string }[];
  location: string | null;
  website: string | null;
  linkedin: string | null;
  scoreUrl: string | null;
  fee: string | null;
  gaps: BrochureGap[];
  ready: boolean;
};

const FORMAT: Record<string, string> = {
  one_to_one: "One to one",
  group: "Group sessions",
  hybrid: "One to one and group",
};

export function programmeBrochureFromBlueprint(input: {
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  profileLocation: string | null;
  row: PracticeKnowledgeRow | null;
}): ProgrammeBrochure {
  const site = coachSiteFromBlueprint({
    slug: input.slug || "you",
    name: input.name,
    avatarUrl: input.avatarUrl,
    lat: null,
    lng: null,
    profileLocation: input.profileLocation,
    row: input.row,
  });
  const payload = input.row?.payload;
  const helpWith = listValue(payload?.practice.help_with);
  const timeframe = textValue(payload?.practice.offer_timeframe) || null;
  const format = FORMAT[payload?.practice.delivery_format?.value ?? ""] ?? site.offer?.format ?? null;
  const website = textValue(payload?.identity.website) || null;
  const fee = textValue(payload?.practice.min_fee) || null;
  const headline = site.shortLine || site.positioning;
  const whoFor = site.whoIHelp || site.offer?.whoFor || null;
  const promise = site.offer?.promise || site.mediumLine || null;

  const gaps: BrochureGap[] = [];
  if (!site.bio && !site.intro) {
    gaps.push({ label: "Short bio", href: "/coach/blueprint/story" });
  }
  if (!headline) {
    gaps.push({ label: "Your offer in three lengths", href: "/coach/blueprint/offer" });
  }
  if (!site.ownerWords.length) {
    gaps.push({ label: "Problems owners ask you to solve", href: "/coach/blueprint/story" });
  }
  if (!helpWith.length) {
    gaps.push({ label: "What you help with", href: "/coach/blueprint/offer" });
  }

  const ready = Boolean(
    (headline || site.intro || site.bio) && (site.ownerWords.length || whoFor) && (helpWith.length || site.bio)
  );

  return {
    coachName: site.name,
    firstName: site.firstName,
    role: "Business Profit Coach",
    photoUrl: site.photo?.src ?? null,
    headline,
    promise,
    whoFor,
    stats: site.facts.slice(0, 4),
    problems: site.ownerWords.slice(0, 6),
    helpWith: helpWith.slice(0, 6),
    timeframe,
    format,
    bio: site.bio,
    intro: site.intro,
    testimonials: site.testimonials.slice(0, 2),
    location: site.place?.label || null,
    website,
    linkedin: site.linkedinUrl,
    scoreUrl: input.slug ? site.links.score : null,
    fee,
    gaps,
    ready,
  };
}
