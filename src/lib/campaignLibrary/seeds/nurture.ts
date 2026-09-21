import {
  messageStep,
  spaced,
  waitStep,
} from "@/lib/unipile/playbookSteps";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import type { CampaignStepInput } from "@/lib/unipile/campaigns";

const TWO_WEEKS = 336;

const PAIRWISE = `Hi {{first_name}}, I thought this might be useful.

A lot of {{type_of_owner}} get caught fighting fires and never get to the work that actually moves profit.

Pairwise Prioritising takes about 5 minutes. It forces a simple choice between tasks so the low-value work falls out.

If the to-do list is running you:
https://docs.google.com/spreadsheets/d/1zvApbmFOz7A_5Pd8s2_7Ifzj_mbI83xYAHolME58T5Q/edit?usp=sharing

Have a play and tell me what you drop.`;

const REVENUE = `Hi {{first_name}}, another one that lands well with {{type_of_owner}}.

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

export const NURTURE_LIBRARY_SEED: CampaignLibrarySeed = {
  sourceKey: "nurture",
  itemType: "template",
  kind: "nurture",
  name: "Ongoing nurture",
  previousNames: ["Nurture"],
  description:
    "After Connection or Reactivation goes quiet. Value tools every two weeks: prioritising, revenue, cash, profit, then time. Stop when they reply.",
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
  ]),
};

export function nurtureLibrarySteps(): CampaignStepInput[] {
  return NURTURE_LIBRARY_SEED.steps.map((step, position) => ({
    ...step,
    position,
  }));
}
