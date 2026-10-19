# Ava's quality bar

One rubric per thing Ava writes. The same rubric does two jobs:

1. **Ava evals.** Ava writes for fixed test coaches (fictional, in `src/lib/evals/fixtures`). Her output is checked in code (lengths, banned phrases, tokens, invented numbers) and scored by a judge model against the rubric. Run with `npx tsx scripts/ava-evals.ts`.
2. **Coach audit.** Every active coach's live LinkedIn profile and campaign messages are scored with the same rubric, so BCA can see where each coach is today and Ava knows what to fix first. Run with `npx tsx scripts/ava-coach-audit.ts`.

Results: Admin → Ava → Evals, and Admin → Coaches → Quality.

## How a score is made

- Each criterion is scored 1 to 5 by the judge. The anchors under each criterion say what a 1, 3 and 5 look like. The weighted average becomes 0 to 100.
- Code checks run first. A **gate** (for example an invented number in Ava's copy, or a connection note over 300 characters) fails the piece and caps the score at 40. A **penalty** takes points off.
- Bands: 85+ Strong, 70 to 84 Good, 50 to 69 Needs work, under 50 Weak.

## Editing a rubric

Change the wording of a criterion, its anchors or its weight here (or in Admin → Ava). Keep the heading shape `### id | weight N | Label` so the code can read it. Code checks live in `src/lib/evals/checks.ts`; the "Checked in code" list in each file says which apply.

When a rubric changes, scores before and after are not comparable. Run the suite again for a new baseline.

## Where the bar comes from

- The classroom methods in `content/practice-skills` (linkedin-profile, campaigns, nurture, replies, pain-points) and the writing rules.
- The 110k-invite review (Oct 2026): links in a connection note cut acceptance by about 40%; messages under about 300 characters get more replies; a full About (1,200+ characters) and 1,000+ connections went with 4 to 6 points more acceptance; headline wording showed no clear effect on acceptance.
- `scripts/ava-outcome-calibration.ts` checks each rubric against what actually happened (acceptance, replies, interest) and says which criteria predict results.
