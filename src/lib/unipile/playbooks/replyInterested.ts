import {
  messageStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

/** After a positive reply: send the scorecard, nudge non-completers, then offer the review. */
export const REPLY_INTERESTED_PLAYBOOK: OutreachPlaybook = {
  id: "reply-interested",
  name: "Reply interested",
  channel: "linkedin",
  description:
    "Use when they reply interested. Send the scorecard, nudge if they don't finish, then offer the review if they don't book.",
  northStar: "assessment_start",
  seedDefault: true,
  steps: spaced([
    messageStep(`Hi {{first_name}},

I've created a 3-minute BOSS Profit & Performance Scorecard for {{company}} owners who want more profit, control and growth without everything depending on them.

It gives you a score out of 100 and shows what may be holding the business back.

If you want to have a go, here's the link:
{{assessment_url}}

Once you've completed it, you can also book a 30-minute {{review_name}} and I'll help you make sense of the results.`),
    waitStep(48),
    messageStep(`Hi {{first_name}},

Just giving this a gentle nudge.

The BOSS Scorecard only takes 3 minutes and gives you a quick score out of 100 across the key areas of your business.

Useful if you want to see where things could work even better and what to focus on first.

Here's the link again:
{{assessment_url}}`),
    waitStep(72),
    messageStep(`Hi {{first_name}},

I saw you completed the BOSS Scorecard, well done for taking the first step.

Your score should give you a useful snapshot of where the business is strong and where it may be leaking profit, time or control.

If you'd like to go through it in more depth, I'm offering a 30-minute {{review_name}} where we'll look at your results and identify the first practical action I'd focus on.

Would you like me to send you a couple of times?`),
    waitStep(72),
    messageStep(`Hi {{first_name}},

No rush. If a 30-minute {{review_name}} would help make sense of the score, shout and I'll send a couple of times.

If timing is off, the scorecard is yours to use whenever it helps.`),
  ]),
};
