import { ApifyClient } from "apify-client";
import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInFeaturedItem,
  LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfileTypes";

export type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInFeaturedItem,
  LinkedInProfileSnapshot,
} from "@/lib/apify/linkedinProfileTypes";

const DEFAULT_ACTOR = "harvestapi/linkedin-profile-scraper";
const PROFILE_SCRAPER_MODE = "Profile details no email ($4 per 1k)";

/** Re-scrape cooldown to control Apify spend (admins can force). */
export const LINKEDIN_PROFILE_SCRAPE_COOLDOWN_MS = 60 * 60 * 1000;

export class LinkedInProfileError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_url"
      | "scrape_failed"
      | "empty_result"
  ) {
    super(message);
    this.name = "LinkedInProfileError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function dateObjectToText(value: unknown): string | null {
  const rec = asRecord(value);
  if (!rec) return asString(value);
  return asString(rec.text) ?? asString(rec.year);
}

function imageUrlFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  const rec = asRecord(value);
  if (!rec) return null;
  const sizes = Array.isArray(rec.sizes) ? rec.sizes : [];
  return (
    asString(rec.url) ??
    asString(rec.rootUrl) ??
    imageUrlFromUnknown(sizes[0] ?? null)
  );
}

/**
 * Accepts common LinkedIn profile URL shapes and returns a canonical
 * https://www.linkedin.com/in/{slug} URL, or null if invalid.
 */
export function normalizeLinkedInProfileUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
  if (inIdx < 0 || !parts[inIdx + 1]) return null;

  const slug = parts[inIdx + 1].replace(/\/+$/, "");
  if (!slug || !/^[a-zA-Z0-9\-_%]+$/.test(slug)) return null;

  return `https://www.linkedin.com/in/${decodeURIComponent(slug)}`;
}

function mapExperience(item: unknown): LinkedInExperience {
  const rec = asRecord(item) ?? {};
  return {
    title: asString(rec.position) ?? asString(rec.title) ?? asString(rec.jobTitle),
    company:
      asString(rec.companyName) ??
      asString(rec.company) ??
      asString(rec.company_name),
    industry:
      asString(rec.companyIndustry) ??
      asString(rec.industry) ??
      asString(rec.company_industry),
    location: asString(rec.location) ?? asString(rec.jobLocation),
    start: dateObjectToText(rec.startDate) ?? asString(rec.jobStartedOn),
    end: dateObjectToText(rec.endDate) ?? asString(rec.jobEndedOn),
    duration: asString(rec.duration) ?? asString(rec.currentJobDuration),
    description: asString(rec.description) ?? asString(rec.jobDescription),
    employmentType: asString(rec.employmentType),
    workplaceType: asString(rec.workplaceType),
    experienceGroupId: asString(rec.experienceGroupId),
    skills: mapSkills(rec.skills),
  };
}

function mapEducation(item: unknown): LinkedInEducation {
  const rec = asRecord(item) ?? {};
  return {
    school:
      asString(rec.schoolName) ??
      asString(rec.school) ??
      asString(rec.institutionName),
    degree: asString(rec.degree) ?? asString(rec.degreeName),
    field:
      asString(rec.fieldOfStudy) ??
      asString(rec.field) ??
      asString(rec.degreeSpec),
    start: dateObjectToText(rec.startDate) ?? asString(rec.startedOn),
    end: dateObjectToText(rec.endDate) ?? asString(rec.endedOn),
  };
}

function mapFeatured(item: unknown): LinkedInFeaturedItem {
  const rec = asRecord(item) ?? {};
  const images = Array.isArray(rec.images) ? rec.images : [];
  const firstImage = images[0];
  return {
    title: asString(rec.title),
    subtitle: asString(rec.subtitle),
    url: asString(rec.link) ?? asString(rec.url),
    imageUrl: imageUrlFromUnknown(firstImage) ?? imageUrlFromUnknown(rec.image),
  };
}

function mapSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const s = asString(item);
      if (s) out.push(s);
      continue;
    }
    const rec = asRecord(item);
    const name =
      asString(rec?.title) ?? asString(rec?.name) ?? asString(rec?.skill);
    if (name) out.push(name);
  }
  return out;
}

function locationText(raw: unknown): string | null {
  if (typeof raw === "string") return asString(raw);
  const rec = asRecord(raw);
  if (!rec) return null;
  return (
    asString(rec.linkedinText) ??
    asString(asRecord(rec.parsed)?.text) ??
    asString(rec.text)
  );
}

export function normalizeLinkedInProfileItem(
  raw: unknown,
  fallbackUrl?: string | null
): LinkedInProfileSnapshot {
  const rec = asRecord(raw) ?? {};
  const firstName = asString(rec.firstName);
  const lastName = asString(rec.lastName);
  const fullName =
    asString(rec.fullName) ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  const experiencesRaw = Array.isArray(rec.experience)
    ? rec.experience
    : Array.isArray(rec.experiences)
      ? rec.experiences
      : [];
  const educationRaw = Array.isArray(rec.education)
    ? rec.education
    : Array.isArray(rec.educations)
      ? rec.educations
      : [];
  const featuredRaw = Array.isArray(rec.featured)
    ? rec.featured
    : rec.featured
      ? [rec.featured]
      : [];

  const bannerUrl =
    imageUrlFromUnknown(rec.coverPicture) ??
    imageUrlFromUnknown(rec.backgroundImage) ??
    imageUrlFromUnknown(rec.banner) ??
    imageUrlFromUnknown(rec.bannerUrl);

  return {
    linkedinUrl:
      asString(rec.linkedinUrl) ??
      asString(rec.linkedinPublicUrl) ??
      fallbackUrl ??
      null,
    publicIdentifier: asString(rec.publicIdentifier),
    firstName,
    lastName,
    fullName,
    headline: asString(rec.headline),
    about: asString(rec.about) ?? asString(rec.summary),
    photoUrl:
      imageUrlFromUnknown(rec.photo) ??
      imageUrlFromUnknown(rec.profilePicture) ??
      imageUrlFromUnknown(rec.profilePic),
    bannerUrl,
    location: locationText(rec.location),
    connectionsCount:
      asNumber(rec.connectionsCount) ?? asNumber(rec.connections),
    followerCount: asNumber(rec.followerCount) ?? asNumber(rec.followers),
    experiences: experiencesRaw.map(mapExperience),
    education: educationRaw.map(mapEducation),
    skills: mapSkills(rec.skills),
    featured: featuredRaw.map(mapFeatured).filter(
      (f) => f.title || f.subtitle || f.url || f.imageUrl
    ),
  };
}

export type ScrapeLinkedInProfileResult = {
  snapshot: LinkedInProfileSnapshot;
  raw: Record<string, unknown>;
  linkedinUrl: string;
};

export async function scrapeLinkedInProfile(
  linkedinUrlInput: string
): Promise<ScrapeLinkedInProfileResult> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new LinkedInProfileError(
      "Server is not configured with APIFY_TOKEN.",
      "not_configured"
    );
  }

  const linkedinUrl = normalizeLinkedInProfileUrl(linkedinUrlInput);
  if (!linkedinUrl) {
    throw new LinkedInProfileError(
      "Enter a valid LinkedIn profile URL (linkedin.com/in/…).",
      "invalid_url"
    );
  }

  const actorId =
    process.env.APIFY_LINKEDIN_PROFILE_ACTOR?.trim() || DEFAULT_ACTOR;
  const client = new ApifyClient({ token });

  let run;
  try {
    run = await client.actor(actorId).call(
      {
        profileScraperMode: PROFILE_SCRAPER_MODE,
        queries: [linkedinUrl],
      },
      { waitSecs: 180 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "LinkedIn profile scrape failed.";
    throw new LinkedInProfileError(message, "scrape_failed");
  }

  if (!run?.defaultDatasetId) {
    throw new LinkedInProfileError(
      "Apify run finished without a dataset.",
      "scrape_failed"
    );
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: 5,
  });

  const first = items.find((item) => {
    const rec = asRecord(item);
    if (!rec) return false;
    if (rec.succeeded === false) return false;
    if (asString(rec.error)) return false;
    return true;
  });

  if (!first) {
    const errItem = items[0] ? asRecord(items[0]) : null;
    const detail =
      asString(errItem?.error) ??
      "No LinkedIn profile data returned. Check the URL is public.";
    throw new LinkedInProfileError(detail, "empty_result");
  }

  const raw = asRecord(first) ?? { value: first };
  return {
    linkedinUrl,
    raw,
    snapshot: normalizeLinkedInProfileItem(first, linkedinUrl),
  };
}
