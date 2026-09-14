import {
  inviteStep,
  messageStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

const VIP_MSG1_A = `Hi {{first_name}}, Most owners running a {{company}} business your size tell me revenue is growing but profit isn't following it. The issue is rarely sales. It's that nobody has ever scored the nine areas underneath the business to find where the money is actually leaking. Worth a chat? I've got two ideas for a business your size.`;

const VIP_MSG1_B = `Hi {{first_name}}, Most owners at your size aren't short of work. They're short of themselves. Everything still routes through you. That isn't a time management problem, it's a systems one, and it's usually three specific things. Want me to tell you which three?`;

const VIP_MSG1_C = `Hi {{first_name}}, Most owners I meet know something is capping their growth. Very few can name which thing, so they end up fixing the loudest problem instead of the most expensive one. I use a 13 question scorecard that names it and puts a number on the gap. Want the link?`;

const VIP_MSG2_A = `Forgot to mention, the last {{company}} owner I did this with found £180K sitting in his pricing, not his pipeline. Would it help to see what we changed?`;

const VIP_MSG2_B = `Forgot to mention, we took a £900K owner from 58 hours a week to 41 in five months without dropping revenue. Want me to show you what came off his plate first?`;

const VIP_MSG2_C = `Forgot to mention, the average score on this is around 4 out of 10, and almost everyone guesses the wrong area. Would it make sense to send you yours?`;

const VIP_MSG4_A = `Totally get it if the timing's off. Just know that when getting profit to move without adding headcount does become the priority, I'd be glad to help. All the best either way, {{first_name}}.`;

const VIP_MSG4_B = `No worries if now isn't the moment. When getting the business to run without you does move up the list, I'm here. Wishing you a good quarter either way.`;

const VIP_MSG4_C = `Sounds like this isn't a priority right now and that's fair enough. If it changes, the 13 questions are yours, no charge and no call needed. All the best.`;

/** Four LinkedIn DMs over ~14 days after they accept. 9 connection requests a day. */
export const VIP_GET_INTEREST_PLAYBOOK: OutreachPlaybook = {
  id: "vip-get-interest",
  name: "Connector",
  channel: "linkedin",
  description:
    "Connect, then the 2-week interest sequence. 9 connection requests a day. After they accept: 48 hours of posts, then problem opener, proof, name nudge, loose breakup.",
  northStar: "interested_reply",
  seedDefault: true,
  dailyInviteLimit: 9,
  steps: spaced([
    inviteStep(""),
    waitStep(48),
    messageStep(VIP_MSG1_A, [
      { key: "A", label: "Profit isn't following revenue", body: VIP_MSG1_A },
      { key: "B", label: "Owner is the bottleneck", body: VIP_MSG1_B },
      { key: "C", label: "Can't name what's broken", body: VIP_MSG1_C },
    ]),
    waitStep(72),
    messageStep(VIP_MSG2_A, [
      { key: "A", label: "Pricing proof", body: VIP_MSG2_A },
      { key: "B", label: "Hours proof", body: VIP_MSG2_B },
      { key: "C", label: "Scorecard proof", body: VIP_MSG2_C },
    ]),
    waitStep(72),
    messageStep("{{first_name}}?"),
    waitStep(144),
    messageStep(VIP_MSG4_A, [
      { key: "A", label: "Profit priority", body: VIP_MSG4_A },
      { key: "B", label: "Run without you", body: VIP_MSG4_B },
      { key: "C", label: "Scorecard free", body: VIP_MSG4_C },
    ]),
  ]),
};
