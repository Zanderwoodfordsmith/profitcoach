import type { SequenceStep } from "@/components/campaigns/CampaignSequenceBuilder";
import { blankLibraryMessageStep } from "@/lib/campaignLibrary/sanitize";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

export function toSequenceStep(input: CampaignStepInput): SequenceStep {
  return {
    id: input.id,
    position: input.position,
    step_type: input.step_type,
    body: input.body ?? null,
    wait_hours: input.wait_hours ?? null,
    variants: input.variants ?? [],
    send_mode: input.send_mode ?? "auto",
    fallback_hours: input.fallback_hours ?? null,
    fallback_body: input.fallback_body ?? null,
    config: input.config ?? {},
  };
}

export function blankSequenceStep(): SequenceStep {
  return toSequenceStep(blankLibraryMessageStep());
}
