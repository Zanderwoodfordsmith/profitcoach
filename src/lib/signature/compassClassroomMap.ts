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
    sectionId: "get-calls-step-1-choose-understand-ideal-clients",
  },
  pipeline_setup: {
    courseId: "get-calls",
    sectionId: "get-calls-step-2-build-prospect-list",
  },
  engine: {
    courseId: "get-calls",
    sectionId: "get-calls-step-4-top-100-conversations",
  },
  offer: {
    courseId: "win-clients",
    sectionId: "win-clients-offer-sales-foundations",
  },
  value: {
    courseId: "win-clients",
    sectionId: "win-clients-value-sessions",
  },
  closing: {
    courseId: "win-clients",
    sectionId: "win-clients-client-closing-objections",
  },
  launchpad: {
    courseId: "coach-clients",
    sectionId: "coach-clients-onboarding",
  },
  rhythm: {
    courseId: "coach-clients",
    sectionId: "coach-clients-certification-simulators",
  },
  continuity: {
    courseId: "coach-clients",
    sectionId: "coach-clients-retention",
  },
};
