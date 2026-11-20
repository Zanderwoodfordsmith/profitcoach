import {
  inviteStep,
  messageStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

/**
 * Built on Paul Hamnett's sports facility campaign (Oct 2026): a note with a
 * real result, then short follow-ups that each give something and end on a
 * yes or no. {{type_of_owner}}, {{your_result}} and {{market_observation}}
 * block launch until the coach writes their own words in.
 */

const NOTE_A = `Hi {{first_name}}, I work with {{type_of_owner}}.

Are you looking to grow your profit?

I ask because {{your_result}}.

Is this of interest?`;

const NOTE_B = `Hi {{first_name}}, I work with {{type_of_owner}}.

Are you looking to step back from the day-to-day?

I ask because {{your_result}}.

Is this of interest?`;

const THANKS = `Hi {{first_name}}, thanks for connecting.

Are you looking to:
1️⃣ Get more from the team and the customers you already have
2️⃣ Step back from the day-to-day without the place grinding to a halt

I ask because {{your_result}}.

The problem usually isn't the effort. The team and the systems haven't kept up with the business. Most owners at your stage are the same.

✅ Is this of interest?`;

const OBSERVATION = `{{market_observation}} Is that true for you, or is it different your end?`;

const FIVE_NUMBERS = `{{first_name}}, something worth knowing. Five numbers sit behind profit: leads, conversion, average spend, how often customers come back, and margin. Lift each by 10% and profit grows by around 61%, because they multiply. Which of the five has the most room in your business right now?`;

const SCORE = `{{first_name}}, would it help to see where your business is strongest and weakest? The BOSS Score takes 3 minutes and shows the one thing holding it back. Want me to send it over?`;

const LAST = `I'll leave it there, {{first_name}}. If the business ever needs you more than you'd like, I'm easy to find. Either way, good luck with the rest of the year.`;

/** Note with your result, then five short messages over about four weeks. */
export const VIP_GET_INTEREST_PLAYBOOK: OutreachPlaybook = {
  id: "vip-get-interest",
  name: "Connector",
  channel: "linkedin",
  description:
    "Connection note with your own result, then five short messages over about four weeks: thanks with two outcomes, a common pain, the five profit numbers, the BOSS Score, and a polite close. Write who you work with, your result and what you hear from owners before it can start.",
  northStar: "interested_reply",
  seedDefault: false,
  dailyInviteLimit: 9,
  steps: spaced([
    inviteStep(NOTE_A, [
      { key: "A", label: "Grow profit", body: NOTE_A },
      { key: "B", label: "Step back", body: NOTE_B },
    ]),
    waitStep(0.0833),
    messageStep(THANKS),
    waitStep(24),
    messageStep(OBSERVATION),
    waitStep(48),
    messageStep(FIVE_NUMBERS),
    waitStep(96),
    messageStep(SCORE),
    waitStep(336),
    messageStep(LAST),
    { step_type: "notify", config: { email: false, in_app: true, whatsapp: false } },
  ]),
};
