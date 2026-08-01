/** Client-safe helpers for in-app lesson content (no Node/fs or Supabase). */

import type { AcademyRecommendedAction } from "./lessonActions";

export type LessonInAppContent = {
  videoUrl: string | null;
  /** Overview tab (short what / why). */
  bodyMarkdown: string;
  /** Optional Guide tab (longer written walkthrough). */
  guideMarkdown: string;
  transcriptText: string | null;
  /** Recommended next steps on Overview (right column). */
  recommendedActions: AcademyRecommendedAction[];
};

export type SectionTitleParts = {
  /** Short wedge label (e.g. "Client Compass") shown as an eyebrow. */
  eyebrow: string | null;
  title: string;
};

/**
 * Category titles follow "Short Label: Full outcome title". Split them so the
 * UI can style the short label as an eyebrow above the full title. Titles
 * without a short prefix (or with a long pre-colon clause) pass through.
 */
export function splitSectionTitleEyebrow(raw: string): SectionTitleParts {
  const idx = raw.indexOf(": ");
  if (idx > 0) {
    const eyebrow = raw.slice(0, idx).trim();
    const rest = raw.slice(idx + 2).trim();
    const wordCount = eyebrow.split(/\s+/).length;
    if (rest && wordCount <= 3 && eyebrow.length <= 28) {
      return { eyebrow, title: rest };
    }
  }
  return { eyebrow: null, title: raw };
}

export function hasInAppLessonContent(
  videoUrl?: string | null,
  bodyMarkdown?: string | null,
  transcriptText?: string | null,
  guideMarkdown?: string | null
): boolean {
  return (
    Boolean(videoUrl?.trim()) ||
    Boolean(bodyMarkdown?.trim()) ||
    Boolean(guideMarkdown?.trim()) ||
    Boolean(transcriptText?.trim())
  );
}
