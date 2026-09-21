import {
  inviteStep,
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const MSG2_B = `Hi {{first_name}}, thanks for connecting. I work with {{type_of_owner}}, so I hear the same thing a lot.

{{market_observation}}

Ring any bells, or is it different your end?`;

const MSG2_A = `Hi {{first_name}}, great to have you in my network.

Are you focused on growing your business at the moment, or more on maintaining what you've already built?`;

const MSG3 = `Hi {{first_name}}, one thing I see either way,  whether someone's pushing for growth or protecting what they've built... is that every business has a weakest link, and most owners are guessing which one it is.

Growth tends to break it. Steady tends to hide it.

If you had to guess, where's yours?`;

const MSG4 = `Hi {{first_name}}, that's one of the reasons we built the BOSS Scorecard . It's designed to find the root constraint rather than just the symptoms.

If you fancy giving it a go, I can send you a personalised link.`;

const MSG5 = `Hi {{first_name}}, I’ll leave this here in case it’s useful: {{scorecard_link}}

The BOSS Scorecard is a short assessment designed to show where the biggest constraint may be across profit, performance and owner-dependence.

No pressure to use it. I’ll leave you to it.`;

export const CONNECTOR_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "connector",
  itemType: "template",
  kind: "connector",
  name: "Connection",
  previousNames: ["Connector"],
  description:
    "Blank LinkedIn invite, then observation (control) vs growth/maintain. Weakest-link value, permission for the scorecard, then the link with no extra ask.",
  status: "published",
  settings: { daily_invite_limit: 9, stop_on_reply: true },
  steps: spaced([
    inviteStep(""),
    waitStep(24),
    messageStep(MSG2_B, [
      { key: "B", label: "Observation (control)", body: MSG2_B },
      { key: "A", label: "Growth vs maintain", body: MSG2_A },
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
