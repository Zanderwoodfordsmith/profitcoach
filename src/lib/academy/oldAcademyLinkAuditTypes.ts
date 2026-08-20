/** Client-safe types for the old-academy link audit (no fs / Supabase). */

export const OLD_ACADEMY_DOMAIN = "academy.businesscoachacademy.com";

export type OldAcademyLinkSource =
  | "hub_academyUrl"
  | "hub_bodyMarkdown"
  | "hub_guideMarkdown"
  | "hub_notice"
  | "body_markdown"
  | "guide_markdown"
  | "transcript_text"
  | "video_url"
  | "audio_url"
  | "resource_url";

export type OldAcademyLinkOccurrence = {
  source: OldAcademyLinkSource;
  url: string;
};

export type OldAcademyLinkLessonHit = {
  surface: "classroom" | "archive";
  courseId: string;
  courseTitle: string;
  sectionTitle: string;
  lessonId: string;
  lessonTitle: string;
  adminLessonHref: string;
  /** True when coaches see in-app media/markdown instead of the Disco CTA. */
  hasInAppContent: boolean;
  /** Hub academyUrl is the bare Disco homepage (placeholder). */
  academyUrlIsHomepageStub: boolean;
  occurrences: OldAcademyLinkOccurrence[];
};

export type OldAcademyLinkResourceHit = {
  id: string;
  title: string;
  url: string;
};

export type OldAcademyLinkAuditReport = {
  domain: string;
  generatedAt: string;
  lessons: OldAcademyLinkLessonHit[];
  resources: OldAcademyLinkResourceHit[];
  summary: {
    lessonCount: number;
    occurrenceCount: number;
    hubAcademyUrlCount: number;
    contentFieldCount: number;
    withoutInAppContentCount: number;
    homepageStubCount: number;
    resourceCount: number;
  };
};
