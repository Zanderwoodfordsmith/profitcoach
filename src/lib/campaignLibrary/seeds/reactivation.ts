import {
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const MSG1_B = `Hi {{first_name}}, we connected a while back and I didn't want to leave it hanging.

Are you still looking to get more profit and time out of the business, or has that gone on the back burner?`;

const MSG1_A = `Hi {{first_name}},

I've put together a 3-minute BOSS Scorecard for {{type_of_owner}} who are doing well on paper, but feel stretched too thin behind the scenes.

It gives you a score out of 100 and shows where the business may be over-relying on you.

What do you reckon you'll score?`;

const MSG2 = `Hi {{first_name}}, one thing I keep seeing with {{type_of_owner}} is that the visible number looks fine, and the constraint is somewhere else.

{{market_observation}}

Is that still true your end, or have you already cracked it?`;

const MSG3 = `Hi {{first_name}}, that's one of the reasons we built the BOSS Scorecard. It's designed to find the root constraint rather than just the symptoms.

If you fancy giving it a go, I can send you a personalised link.`;

const MSG4 = `Hi {{first_name}}, I'll leave this here in case it's useful: {{scorecard_link}}

The BOSS Scorecard is a short assessment designed to show where the biggest constraint may be across profit, performance and owner-dependence.

No pressure to use it. I'll leave you to it.`;

export const REACTIVATION_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "reactivation",
  itemType: "template",
  kind: "reactivation",
  name: "Reactivation",
  description:
    "Already connected, gone quiet. Check-in (control) vs scorecard invite, then the same permission-and-link close as Connection. No invite.",
  status: "published",
  settings: { stop_on_reply: true },
  steps: spaced([
    messageStep(MSG1_B, [
      { key: "B", label: "Still looking (control)", body: MSG1_B },
      { key: "A", label: "Scorecard invite", body: MSG1_A },
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
