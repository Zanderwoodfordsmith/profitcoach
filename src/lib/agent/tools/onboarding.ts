import { ingestOnboardingSources } from "@/lib/practiceKnowledge/ingestOnboarding";
import { loadOnboardingStatus } from "@/lib/practiceKnowledge/onboardingStatus";

import type { AgentToolDef } from "../types";
import { coachOf } from "./util";

export const onboardingTools: AgentToolDef[] = [
  {
    name: "onboarding_status",
    label: "Checking what is ready",
    needsCoach: true,
    description:
      "Where this coach is on the practice-ready path: LinkedIn scraped or not, sales-call transcripts pulled, facts still open, sections written, and which outputs are ready to review.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => loadOnboardingStatus(coachOf(ctx).id),
  },
  {
    name: "ingest_onboarding",
    label: "Pulling what we already have",
    needsCoach: true,
    description:
      "Pull this coach's BCA sales-call transcripts and scrape their LinkedIn profile into the Blueprint. Safe to run again. Does not invent facts.",
    input_schema: {
      type: "object",
      properties: {
        linkedin_url: {
          type: "string",
          description: "Optional LinkedIn profile URL if it is not already on their account",
        },
      },
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const url = typeof input.linkedin_url === "string" ? input.linkedin_url.trim() : "";
      const result = await ingestOnboardingSources(coach.id, {
        scrapeLinkedIn: true,
        linkedinUrl: url || null,
      });
      const status = await loadOnboardingStatus(coach.id);
      return { ...result, stage: status.stage, missing_facts: status.missing_facts };
    },
  },
];
