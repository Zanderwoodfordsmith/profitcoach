import type { SignatureModuleId } from "@/lib/signatureModelV2";

export type CompassClassroomTarget = {
  courseId: string;
  sectionId: string;
};

/**
 * Outer Compass modules → Classroom hub card + section.
 * Lifestyle lenses are intentionally unmapped.
 * Client-safe (no Node/fs).
 */
export const COMPASS_CLASSROOM_TARGETS: Partial<
  Record<SignatureModuleId, CompassClassroomTarget>
> = {
  compass: {
    courseId: "get-calls",
    sectionId: "client-acquisition-step-1-choose-understand-ideal-clients",
  },
  pipeline_setup: {
    courseId: "get-calls",
    sectionId: "client-acquisition-step-2-build-prospect-list",
  },
  engine: {
    courseId: "get-calls",
    sectionId: "client-acquisition-step-4-top-100-conversations",
  },
  offer: {
    courseId: "win-clients",
    sectionId: "client-acquisition-offer-sales-foundations",
  },
  value: {
    courseId: "win-clients",
    sectionId: "client-acquisition-value-sessions",
  },
  closing: {
    courseId: "win-clients",
    sectionId: "client-acquisition-client-closing-objections",
  },
  launchpad: {
    courseId: "profit-coach-system",
    sectionId: "client-delivery-client-onboarding",
  },
  rhythm: {
    courseId: "profit-coach-system",
    sectionId: "coach-certification",
  },
  continuity: {
    courseId: "profit-coach-system",
    sectionId: "client-retention",
  },
};

export type ResolvedCompassClassroomLink = {
  moduleId: SignatureModuleId;
  courseId: string;
  sectionId: string;
  lessonId: string;
};

export function classroomHrefForLink(
  basePath: string,
  link: Pick<ResolvedCompassClassroomLink, "courseId" | "lessonId">,
): string {
  const base = basePath.replace(/\/$/, "");
  return `${base}/${encodeURIComponent(link.courseId)}/${encodeURIComponent(link.lessonId)}`;
}
