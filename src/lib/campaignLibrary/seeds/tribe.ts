import {
  inviteStep,
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const INVITE = `Hi {{first_name}}, I work with [your tribe, e.g. Midlands engineering MDs]. Always good to know more people running [their world].`;

const MSG1 = `Thanks for connecting, {{first_name}}. Most [your tribe] I speak to say [a problem, in their words].

Is that true your end, or is it different?`;

const MSG2 = `One thing I see a lot with [your tribe]: [one insight with a number].

When we fixed it at [company], [the number before] became [the number after] in [how long it took]. Have you ever looked at yours?`;

const MSG3 = `I can show you where yours sits in 10 minutes if it's useful. No pitch, just the numbers.

Worth a look? If not, totally fine.`;

const MSG4 = `I'll leave it there, {{first_name}}. If [the problem] becomes the priority, I'm here.`;

export const TRIBE_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "tribe",
  itemType: "template",
  kind: "connector",
  name: "Tribe connection",
  description:
    "For one group that recognises itself: a place, a role or a moment (women founders, Midlands MDs, founders raising money). Short invite note with no link, their problem in their words, one proof, a no-pressure offer. Fill every [bracket] before launch.",
  status: "published",
  settings: { daily_invite_limit: 9, stop_on_reply: true },
  steps: spaced([
    inviteStep(INVITE),
    waitStep(24),
    messageStep(MSG1),
    waitStep(72),
    messageStep(MSG2),
    waitStep(120),
    messageStep(MSG3),
    waitStep(336),
    messageStep(MSG4),
  ]),
};

export function tribeLibrarySteps(): CampaignStepInput[] {
  return TRIBE_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
