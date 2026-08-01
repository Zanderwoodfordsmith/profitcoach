import type { AcademyRecommendedAction } from "./lessonActions";

/** Pillar ids from My Compass / signature v2 (`reach` = Connect, `enrol` = Enroll). */
export type AcademyCompassPillarId = "reach" | "enrol" | "deliver";

export type { AcademyRecommendedAction } from "./lessonActions";

export type AcademyLesson = {
  id: string;
  title: string;
  emoji?: string;
  description?: string;
  /** Sidebar length label, e.g. `6m` (from catalog or DB override). */
  duration?: string;
  /** Supports common YouTube URLs; other URLs may show as a link or generic video element later. */
  videoUrl?: string | null;
  /** Overview tab content. */
  bodyMarkdown?: string;
  /** Optional Guide tab (longer walkthrough / SOP). */
  guideMarkdown?: string;
  /** Recommended next steps shown beside Overview. */
  recommendedActions?: AcademyRecommendedAction[];
  transcriptText?: string | null;
  /**
   * Admin-only: coaches never see draft lessons.
   * From catalog JSON and/or `academy_lesson_content.is_draft`.
   */
  draft?: boolean;
};

export type AcademyCourse = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  /** When set, course card uses the same solid colour as that pillar on My Compass. */
  compassPillarId?: AcademyCompassPillarId;
  /** When set, only coaches with one of these access tiers can see the course. */
  accessTiers?: string[];
  lessons: AcademyLesson[];
};

export type AcademyCategory = {
  id: string;
  title: string;
  description?: string;
  courses: AcademyCourse[];
};

export type AcademyCatalog = {
  categories: AcademyCategory[];
};

export type { AcademyResourceArea, AcademyResourceKind } from "./parseResourcesMarkdown";
export type {
  AcademyResourceRow,
  AcademyResourceSectionRow,
  AcademyResourcesCatalog,
} from "./resources";
