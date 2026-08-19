/**
 * LinkedIn Profile Optimizer — secure design (rafter-secure-design)
 *
 * AuthN: existing Supabase session JWT via requireCoachRequest.
 * AuthZ: resource ownership. coach_id is taken from the session (or admin
 * impersonation header), never from the request body. Same row as the scrape.
 * Agent: rewrite LLM runs server-side as the coach; output is their draft.
 *
 * Data: optimizer_draft is coach-authored copy (PII-adjacent content) on
 * coach_linkedin_profiles. Deleted with the profile (cascade). No extra
 * encryption beyond Supabase at rest. Do not log draft bodies.
 *
 * API: GET/PATCH /api/coach/linkedin-profile (own row). POST .../rewrite
 * (LLM). Allowlisted fields only. Generic errors. Rewrite cooldown per coach.
 *
 * Ingestion: JSON only, max lengths below, unknown keys dropped. Render as
 * React text, never HTML.
 */

export const PROFILE_SECTIONS = [
  "headline",
  "about",
  "featured",
  "experience",
  "banner",
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number];

export const FIELD_LIMITS = {
  headline: 220,
  about: 2_600,
  experienceTitle: 220,
  experienceDescription: 2_000,
  bannerCopy: 400,
  featuredNotes: 1_200,
  instruction: 500,
  maxExperienceDrafts: 20,
} as const;

export const REWRITE_COOLDOWN_MS = 5_000;

export type ExperienceDraft = {
  index: number;
  title?: string;
  description?: string;
};

export type ProfileOptimizerDraft = {
  headline?: string | null;
  about?: string | null;
  bannerCopy?: string | null;
  featuredNotes?: string | null;
  experiences?: ExperienceDraft[];
  copiedAt?: Partial<Record<ProfileSectionId, string>>;
  updatedAt?: string | null;
};

export type ProfileOptimizerVariant = {
  label: string;
  text: string;
  recommended?: boolean;
};

export type LinkedInImportProfile = {
  linkedinUrl: string;
  scrapedAt: string;
  snapshot: import("@/lib/apify/linkedinProfileTypes").LinkedInProfileSnapshot;
};

export type ProfileOptimizerPayload = {
  profile: LinkedInImportProfile | null;
  draft: ProfileOptimizerDraft;
  savedLinkedinUrl: string | null;
};
