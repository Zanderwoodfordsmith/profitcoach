import {
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const MSG1 = `Hi {{first_name}}, it's been a while. I'm now helping owners [get more profit and time back], and I wanted people I know to hear it from me first.

No pitch. How's business your end?`;

const MSG2 = `Something I've noticed since starting: most owners tell me revenue is fine, but they still can't take a week off.

Is that you, or have you cracked it?`;

const MSG3 = `One favour, {{first_name}}: if you know an owner who's stretched too thin, I'd be grateful for an intro.

And if that's you, I'm always happy to talk it through.`;

export const WARM_NETWORK_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "warm-network",
  itemType: "template",
  kind: "reactivation",
  name: "Warm network",
  description:
    "Run this first. Your existing connections who are owners: a personal note, no pitch, one question, then a request for introductions. No invite. Warm messages got about twice the replies of cold ones in our data.",
  status: "published",
  settings: { stop_on_reply: true },
  steps: spaced([
    messageStep(MSG1),
    waitStep(96),
    messageStep(MSG2),
    waitStep(168),
    messageStep(MSG3),
  ]),
};

export function warmNetworkLibrarySteps(): CampaignStepInput[] {
  return WARM_NETWORK_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
