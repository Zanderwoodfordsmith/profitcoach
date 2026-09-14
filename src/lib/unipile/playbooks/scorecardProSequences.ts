import {
  emailStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

const SIGN_OFF = `{{coach_name}}`;

const BOOK_LINE = `Book your {{review_name}}: reply to this email and I will send times.`;

/** Started the Pro diagnostic, did not finish. */
export const SCORECARD_PRO_INCOMPLETE_PLAYBOOK: OutreachPlaybook = {
  id: "scorecard-pro-incomplete",
  name: "Boss Score Pro · Started, not finished",
  channel: "email",
  description:
    "For people who started BOSS Score Pro and left. Three nudges over 5 days.",
  northStar: "assessment_start",
  seedDefault: true,
  steps: spaced([
    emailStep(
      "{{first_name}}, you're part way through BOSS Score Pro",
      "Your answers are saved. Finish the diagnostic.",
      `Hi {{first_name}},

You started the BOSS Score Pro diagnostic.

It is the full 50-question read across the business. Your answers are saved, so you can pick up where you left off.

Finish it here:
{{assessment_pro_url}}

${SIGN_OFF}`
    ),
    waitStep(48),
    emailStep(
      "The useful bit is the full picture",
      "Most owners start it. Fewer see the report.",
      `Hi {{first_name}},

Most owners start the diagnostic, get interrupted, and never see the report.

The useful bit is the whole picture — where the business is strong, and which area is actually capping it.

Pick it up here:
{{assessment_pro_url}}

${SIGN_OFF}`
    ),
    waitStep(72),
    emailStep(
      "Your Pro diagnostic is still waiting",
      "Last nudge. Your call.",
      `Hi {{first_name}},

Last note from me on this.

If you want the full diagnostic, the link is here:
{{assessment_pro_url}}

If not, no problem. It will be here when the timing is better.

${SIGN_OFF}`
    ),
  ]),
};

/** After they finish Boss Score Pro. */
export const SCORECARD_PRO_COMPLETE_PLAYBOOK: OutreachPlaybook = {
  id: "scorecard-pro-complete",
  name: "Boss Score Pro · Completed",
  channel: "email",
  description:
    "After they finish the 50-question diagnostic. Make sense of the report and offer a review.",
  northStar: "call_booked",
  seedDefault: true,
  steps: spaced([
    emailStep(
      "{{first_name}}, you finished BOSS Score Pro",
      "The report is only useful if you act on it.",
      `Hi {{first_name}},

You finished the BOSS Score Pro diagnostic. That is more than most owners do.

The report names where the business is strong and which area is the expensive constraint. The next step is not to fix everything. It is to pick the one move that unlocks the rest.

If you want a second pair of eyes on it, book a {{review_name}}. We look at the report together and you leave with one priority.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(48),
    emailStep(
      "Fifty questions. One priority.",
      "The diagnostic is a map, not a to-do list.",
      `Hi {{first_name}},

A 50-question diagnostic can feel like a lot of red ink.

Treat it as a map. One area is the bottleneck. Fix that and the rest of the report gets easier. Try to fix all of it at once and nothing moves.

A {{review_name}} is how we pick that one area with you, using the answers you already gave.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(72),
    emailStep(
      "Don't let the report sit in your inbox",
      "Owners who act in the first week move. The rest re-take it a year later.",
      `Hi {{first_name}},

The owners who get value from this diagnostic do one thing in the first week: they decide what to do with it.

The ones who don't close the tab, mean to come back to it, and take it again a year later with the same score.

If you want next year to look different, start with a {{review_name}}. Even if you decide not to work together, you walk away with a clear next move.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(72),
    emailStep(
      "Last note on your Pro diagnostic, {{first_name}}",
      "The report is yours either way.",
      `Hi {{first_name}},

This is the last email I will send about your BOSS Score Pro results.

One offer. A {{review_name}}. We look at the diagnostic, name the one move that matters most, and you leave with a clear next step.

If that sounds useful: ${BOOK_LINE}

If not, no problem. The report is yours to use whenever it helps.

${SIGN_OFF}`
    ),
  ]),
};
