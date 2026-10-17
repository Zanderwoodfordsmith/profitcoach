import {
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const TWO_WEEKS = 336;

const PAIRWISE = `Hi {{first_name}}, I thought this might be useful.

A lot of owners get caught fighting fires and never get to the work that actually moves profit.

Pairwise Prioritising takes about 5 minutes. It forces a simple choice between tasks so the low-value work falls out.

If the to-do list is running you:
https://docs.google.com/spreadsheets/d/1zvApbmFOz7A_5Pd8s2_7Ifzj_mbI83xYAHolME58T5Q/edit?usp=sharing

Have a play and tell me what you drop.`;

const REVENUE = `Hi {{first_name}}, another one that lands well with owners.

Most owners look at last month's numbers. The Revenue Growth Accelerator shows what has to happen next to hit the number, so invoicing and sales stay aligned to the goal.

If forecasting still feels like guesswork, tell me and I'll send it across.`;

const CASHFLOW = `Hi {{first_name}}, revenue is vanity, profit is sanity, cash is king.

The Cashflow Forecaster takes income, expenses and the current bank balance and shows the rises and falls. Clients often feel the stress drop in ten minutes of high-level numbers.

If you'd like to explore it, tell me and I'll send it over.`;

const CASHFLOW_MAX = `Hi {{first_name}}, if you looked at the forecaster, this is the one that sits next to it.

The Cashflow Maximiser is a short checklist of proven ways to boost cash. Even one tactic can change how the next month feels, and there are more than 25 to pick from.

Want a copy?`;

const PROFIT = `Hi {{first_name}}, we obsess over profit, so this is the tool I show most often.

The Profit Maximiser is a simple table. It shows how a small cut in expenses at a given margin can double profit. At 10% margin, an 11% cost cut can do it.

If you'd like to see the numbers, tell me and I'll send it across.`;

const EXPENSES = `{{first_name}}, one thing I forgot after the profit numbers.

For each expense ask: does this help me get or keep customers? If no, cut it. If yes, is there a cheaper way? Write the action next to it, then pick the first one.

I've never had a client not find something they were still paying for.

Interested in other ways to increase profit this quarter?`;

const TIME = `Hi {{first_name}}, time is the other leak.

The Time Value Tracker lists what you do into £10, £100 and £1,000 jobs. In a few minutes you can see which low-value work is eating the week, and what to hand off.

If useful:
https://docs.google.com/spreadsheets/d/13lch5WGPGQZCcdfMztwgO0MahjYvy-SwsegorDF0M0I/edit?usp=sharing`;

const LEVERS = `Hi {{first_name}}, a quick bit of maths I share with owners.

There are five numbers behind revenue: leads, conversion, average sale, how often people buy, and margin. Improve each by 10% and revenue grows by about 61%, because they multiply.

Most owners only work on the first one. Which of the five do you think has the most room in your business?`;

const LEVEL = `Hi {{first_name}}, one thing I've noticed after a lot of these conversations.

Owners tend to sit at one of five levels: overwhelmed, overworked, organised, overseer, owner. The jump that changes life most is usually from overworked to organised, when the business stops needing you for every decision.

Where would you put yourself right now? Happy to share what usually unlocks the next level.`;

const NINETY_DAYS = `Hi {{first_name}}, it's been a few months since we first spoke, so I thought I'd check in properly.

If it's useful, I can send you the 3-minute BOSS Score. It shows where the business is relying on you most and what to fix first. No call needed, the report comes straight to you.

Either way, how has the last quarter gone?`;

export const NURTURE_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "nurture",
  itemType: "template",
  kind: "nurture",
  name: "Ongoing nurture",
  previousNames: ["Nurture"],
  description:
    "After Connection or Reactivation goes quiet. Give something every two weeks for about four months: prioritising, revenue, cash, profit, time, the five levers, the five levels, then a 90-day check-in. Never a bare 'just checking'. Stop when they reply.",
  status: "published",
  settings: { stop_on_reply: true },
  steps: spaced([
    messageStep(PAIRWISE),
    waitStep(TWO_WEEKS),
    messageStep(REVENUE),
    waitStep(TWO_WEEKS),
    messageStep(CASHFLOW),
    waitStep(72),
    messageStep(CASHFLOW_MAX),
    waitStep(TWO_WEEKS),
    messageStep(PROFIT),
    waitStep(72),
    messageStep(EXPENSES),
    waitStep(TWO_WEEKS),
    messageStep(TIME),
    waitStep(TWO_WEEKS),
    messageStep(LEVERS),
    waitStep(TWO_WEEKS),
    messageStep(LEVEL),
    waitStep(TWO_WEEKS),
    messageStep(NINETY_DAYS),
  ]),
};

export function nurtureLibrarySteps(): CampaignStepInput[] {
  return NURTURE_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
