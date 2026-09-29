import type { ProgrammeIntakeTimeCommitment } from "@/config/programmeIntake";
import type { PracticeKnowledgePayload } from "./types";
import { sourced } from "./sourced";

export function payloadFromWelcomeIntake(opts: {
  linkedinUrl?: string | null;
  timeCommitment?: ProgrammeIntakeTimeCommitment | string | null;
}): Partial<PracticeKnowledgePayload> {
  const at = new Date().toISOString();
  const linkedinUrl = opts.linkedinUrl?.trim() || "";
  const hours = opts.timeCommitment?.trim() || "";
  return {
    identity: {
      phone: null,
      whatsapp: null,
      website: null,
      timezone: null,
      location: null,
      linkedin_url: linkedinUrl ? sourced(linkedinUrl, "form", at) : null,
    },
    working_times: {
      hours_per_week: hours ? sourced(hours, "form", at) : null,
      preferred_hours: null,
      prospect_call_hours: null,
      notification_channel: null,
    },
  };
}
