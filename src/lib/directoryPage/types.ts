import type { LinkedInExperience } from "@/lib/apify/linkedinProfileTypes";
import { sanitizeShareUrl } from "@/lib/shareLinks/sanitizeUrl";
import { parseSocialLinks, type SocialLinks } from "@/lib/shareLinks/socials";

/** One line of a coach's career, newest first. */
export type CareerRow = { title: string; company: string; years: string };

/** A client result the coach adds by hand. */
export type ResultRow = { quote: string; name: string; role: string; outcome: string };

/** Page sections a coach can hide on their live page. */
export const SECTION_KEYS = ["about", "serves", "career", "results"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * profiles.directory_page. A missing key means "never set": career then comes
 * from the LinkedIn import. An empty value means the coach cleared it, so the
 * live page hides that section.
 */
export type DirectoryPageExtras = {
  career?: CareerRow[];
  results?: ResultRow[];
  serves?: string;
  industries?: string[];
  /** The industries were drafted by AI and the coach has not changed them yet. */
  industries_suggested?: boolean;
  booking_url?: string;
  /** Where the face sits in the photo, in percent. */
  photo_focus?: { x: number; y: number };
  /** Sections the coach switched off, even though they have content. */
  hidden?: SectionKey[];
  /** Intro video, uploaded to the directory-videos bucket. */
  video_url?: string;
};

/**
 * The sectors AI picks from, so the directory can filter on them. Coaches can
 * still type their own on their page.
 */
export const SECTORS = [
  "Construction & trades",
  "Engineering & manufacturing",
  "Technology & IT",
  "Professional services",
  "Marketing & creative",
  "Retail & consumer goods",
  "Health & life sciences",
  "Hospitality & travel",
  "Farming & food",
  "Property",
  "Finance & insurance",
  "Education & training",
  "Logistics & transport",
  "Charities & public sector",
] as const;

export const VIDEO_BUCKET = "directory-videos";
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024;

/** Everything the coach page draws. Public fields only. */
export type DirectoryCoachView = {
  slug: string;
  name: string;
  firstName: string;
  business: string | null;
  avatarUrl: string | null;
  /** The one-line headline, or null when the coach has only a long summary. */
  summary: string | null;
  /** About text: the bio, else a long summary. */
  bio: string | null;
  /** About came from the summary column, so saving a headline must keep it. */
  aboutFromSummary: boolean;
  location: string | null;
  level: string | null;
  listed: boolean;
  linkedinUrl: string | null;
  socials: SocialLinks;
  extras: DirectoryPageExtras;
  /** extras.career, else the LinkedIn import. */
  career: CareerRow[];
  careerFromLinkedIn: boolean;
  hasCalendar: boolean;
};

/** What only the coach (or an admin) sees while editing. */
export type DirectoryEditorExtras = {
  coachId: string;
  /** True when an admin is editing someone else's page. */
  actingAsAdmin: boolean;
  /** Admins only: every coach page, for jumping between them. */
  coaches?: { slug: string; name: string; listed: boolean }[];
};

export const LIMITS = {
  career: 6,
  results: 6,
  industries: 8,
  title: 120,
  company: 80,
  years: 24,
  quote: 600,
  name: 80,
  role: 100,
  outcome: 80,
  serves: 600,
  industry: 40,
} as const;

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Keeps line breaks (for quotes and paragraphs). */
function text(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.replace(/\r/g, "").trim().slice(0, max) : "";
}

function clampPct(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : null;
}

/** Reads stored or posted extras. Unknown keys are dropped; missing keys stay missing. */
export function parseDirectoryPage(raw: unknown): DirectoryPageExtras {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: DirectoryPageExtras = {};

  if (Array.isArray(src.career)) {
    out.career = src.career
      .map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        return {
          title: str(row.title, LIMITS.title),
          company: str(row.company, LIMITS.company),
          years: str(row.years, LIMITS.years),
        };
      })
      .filter((r) => r.title || r.company)
      .slice(0, LIMITS.career);
  }

  if (Array.isArray(src.results)) {
    out.results = src.results
      .map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        return {
          quote: text(row.quote, LIMITS.quote),
          name: str(row.name, LIMITS.name),
          role: str(row.role, LIMITS.role),
          outcome: str(row.outcome, LIMITS.outcome),
        };
      })
      .filter((r) => r.quote || r.outcome)
      .slice(0, LIMITS.results);
  }

  if (typeof src.serves === "string") out.serves = text(src.serves, LIMITS.serves);

  if (Array.isArray(src.industries)) {
    const seen = new Set<string>();
    out.industries = src.industries
      .map((i) => str(i, LIMITS.industry))
      .filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()))
      .slice(0, LIMITS.industries);
  }

  if (src.industries_suggested === true) out.industries_suggested = true;

  if (typeof src.booking_url === "string") {
    const raw = src.booking_url.trim();
    if (!raw) out.booking_url = "";
    else {
      const parsed = sanitizeShareUrl(raw);
      if (parsed.ok) out.booking_url = parsed.url;
    }
  }

  if (typeof src.video_url === "string") {
    const parsed = sanitizeShareUrl(src.video_url);
    // Only our own bucket: the page plays it in a <video> tag.
    if (parsed.ok && parsed.url.includes(`/storage/v1/object/public/${VIDEO_BUCKET}/`)) {
      out.video_url = parsed.url;
    }
  }

  if (Array.isArray(src.hidden)) {
    out.hidden = SECTION_KEYS.filter((k) => (src.hidden as unknown[]).includes(k));
  }

  if (src.photo_focus && typeof src.photo_focus === "object") {
    const f = src.photo_focus as Record<string, unknown>;
    const x = clampPct(f.x);
    const y = clampPct(f.y);
    if (x !== null && y !== null) out.photo_focus = { x, y };
  }

  return out;
}

/** Faces sit in the top third of most portraits, so that is the default focus. */
export const DEFAULT_PHOTO_FOCUS = { x: 50, y: 28 } as const;

function year(raw: string | null): string | null {
  return raw?.match(/(19|20)\d{2}/)?.[0] ?? null;
}

function isCurrent(raw: string | null): boolean {
  return !raw || /present|now|current/i.test(raw);
}

/**
 * The LinkedIn import as career rows: roles at the same company merge into one
 * row (the newest title, the full span of years). Newest first, at most five.
 */
export function careerFromLinkedIn(experiences: LinkedInExperience[] | null | undefined): CareerRow[] {
  const rows: Array<CareerRow & { from: string | null; to: string | null; current: boolean }> = [];
  for (const e of experiences ?? []) {
    const company = str(e.company, LIMITS.company);
    const title = str(e.title, LIMITS.title);
    if (!company || !title) continue;
    const from = year(e.start);
    const current = isCurrent(e.end);
    const to = current ? null : year(e.end);
    const last = rows[rows.length - 1];
    if (last && last.company.toLowerCase() === company.toLowerCase()) {
      if (from && (!last.from || from < last.from)) last.from = from;
      continue;
    }
    rows.push({ title, company, years: "", from, to, current });
  }
  return rows.slice(0, 5).map(({ title, company, from, to, current }) => ({
    title,
    company,
    years: current
      ? from
        ? `${from} to now`
        : "Now"
      : from && to && from !== to
        ? `${from} to ${to}`
        : (to ?? from ?? ""),
  }));
}

export function socialsFrom(raw: unknown): SocialLinks {
  return parseSocialLinks(raw);
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
