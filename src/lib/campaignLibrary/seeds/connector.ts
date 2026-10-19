import {
  inviteStep,
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const MSG2_B = `Hi {{first_name}}, thanks for connecting. I work with business owners, so I hear the same thing a lot.

Most owners tell me revenue is fine, but they still can't take a week off.

Ring any bells, or is it different your end?`;

const MSG2_A = `Hi {{first_name}}, great to have you in my network.

Are you focused on growing your business at the moment, or more on keeping what you've already built?`;

const MSG3 = `Hi {{first_name}}, one thing I see in nearly every business, growing or steady: there's a weakest link, and most owners are guessing which one it is.

Growth tends to break it. Steady tends to hide it.

If you had to guess, where's yours?`;

const MSG4 = `Hi {{first_name}}, a quick bit of maths I share with owners.

Five numbers sit behind revenue: leads, conversion, average sale, how often people buy, and margin. Improve each by 10% and the result grows by about 61%, because they multiply.

Which of the five has the most room in yours?`;

const MSG5 = `I'll leave it there, {{first_name}}. If the business ever starts needing you more than you'd like, I'm easy to find.

Either way, good luck with the rest of the year.`;

export const CONNECTOR_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "connector",
  itemType: "template",
  kind: "connector",
  name: "Connection",
  previousNames: ["Connector"],
  description:
    "Blank invite, then short messages with one question each: observation (control) vs growth/keep, the weakest link, the five levers, then a warm close. No links. Move quiet people into Ongoing nurture.",
  status: "published",
  settings: { daily_invite_limit: 9, stop_on_reply: true },
  steps: spaced([
    inviteStep(""),
    waitStep(24),
    messageStep(MSG2_B, [
      { key: "B", label: "Observation (control)", body: MSG2_B },
      { key: "A", label: "Growth vs keep", body: MSG2_A },
    ]),
    waitStep(72),
    messageStep(MSG3),
    waitStep(96),
    messageStep(MSG4),
    waitStep(96),
    messageStep(MSG5),
  ]),
};

export function connectorLibrarySteps(): CampaignStepInput[] {
  return CONNECTOR_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
