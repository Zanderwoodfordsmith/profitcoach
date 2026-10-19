import {
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const MSG1_B = `Hi {{first_name}}, we connected a while back and I didn't want to leave it hanging.

Are you still looking to get more profit and time out of the business, or has that gone on the back burner?`;

const MSG1_A = `Hi {{first_name}}, a quick one I share with owners: at a 10% margin, cutting costs by 11% can double profit.

Most people don't believe it until they see the maths. Want me to send the table?`;

const MSG2 = `Hi {{first_name}}, one thing I keep seeing with owners is that the visible number looks fine, and the constraint is somewhere else.

Most owners tell me revenue is fine, but they still can't take a week off. Is that still true your end, or have you already cracked it?`;

const MSG3 = `Hi {{first_name}}, that's one of the reasons we built the BOSS Score. It finds the root constraint rather than just the symptoms.

If you fancy giving it a go, I can send you a personal link.`;

const MSG4 = `I'll leave it there, {{first_name}}. If you'd ever like the 3-minute BOSS Score, just say the word and I'll send it over.`;

export const REACTIVATION_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "reactivation",
  itemType: "template",
  kind: "reactivation",
  name: "Reactivation",
  description:
    "Already connected, gone quiet. Check-in (control) vs a profit tip they can ask for, then the constraint question, permission for the BOSS Score, and a close with no link. No invite.",
  status: "published",
  settings: { stop_on_reply: true },
  steps: spaced([
    messageStep(MSG1_B, [
      { key: "B", label: "Still looking (control)", body: MSG1_B },
      { key: "A", label: "Profit tip", body: MSG1_A },
    ]),
    waitStep(72),
    messageStep(MSG2),
    waitStep(96),
    messageStep(MSG3),
    waitStep(96),
    messageStep(MSG4),
  ]),
};

export function reactivationLibrarySteps(): CampaignStepInput[] {
  return REACTIVATION_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
