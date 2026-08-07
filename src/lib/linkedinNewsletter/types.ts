export type NewsletterCadence = "weekly" | "fortnightly" | "monthly";

export type NewsletterEditionKind =
  | "overview_537"
  | "strategy"
  | "mistake"
  | "checklist"
  | "profit_system"
  | "industry"
  | "custom";

export type NewsletterFormat =
  | "pam_537_overview"
  | "pam_deep_dive"
  | "quick_insight"
  | "timely_pov"
  | "in_depth"
  | "breezy_story"
  | "curated_roundup";

export type NewsletterLengthMode = "short" | "long";

export type NewsletterEditionStatus = "planned" | "draft" | "ready" | "copied";

export type Overview537 = {
  strategies: string[];
  mistakes: string[];
  checklist: string[];
};

export type NewsletterFixedBlocks = {
  intro?: string;
  bio?: string;
  subscribe_share?: string;
  cta_label?: string;
  cta_url?: string;
  phone?: string;
  sign_off?: string;
};

export type NewsletterCover = {
  template?: "navy_banner" | "orange_accent" | "minimal_dark";
  headline?: string;
  tagline?: string;
  emoji?: string;
};

export type NewsletterSeriesRow = {
  id: string;
  user_id: string;
  name: string;
  tagline: string | null;
  cadence: NewsletterCadence;
  lead_topic: string | null;
  overview_537: Overview537;
  fixed_blocks: NewsletterFixedBlocks;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type NewsletterEditionRow = {
  id: string;
  series_id: string;
  user_id: string;
  sequence_index: number;
  kind: NewsletterEditionKind;
  kind_index: number | null;
  title: string;
  tagline: string | null;
  format: NewsletterFormat;
  length_mode: NewsletterLengthMode;
  seo_title: string | null;
  seo_description: string | null;
  body_markdown: string;
  blocks: unknown[];
  promo_post_text: string | null;
  cover: NewsletterCover;
  status: NewsletterEditionStatus;
  created_at: string;
  updated_at: string;
};

export type PlannedEdition = {
  sequence_index: number;
  kind: NewsletterEditionKind;
  kind_index: number | null;
  title: string;
  tagline: string;
  format: NewsletterFormat;
  length_mode: NewsletterLengthMode;
};

export const SHORT_WORD_RANGE = { min: 400, max: 800 } as const;
export const LONG_WORD_HINT = 2000;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function lengthGuidance(mode: NewsletterLengthMode): string {
  if (mode === "long") {
    return `Target roughly ${LONG_WORD_HINT}+ words. In-depth guide or case study only when the value warrants it. Still scannable: short paragraphs, bold subheads, bullets.`;
  }
  return `Target ${SHORT_WORD_RANGE.min}–${SHORT_WORD_RANGE.max} words (quick insight / timely POV). Scannable, shareable, saveable — a LinkedIn post with more breathing room.`;
}
