import {
  MARKETING_EMAILS,
  OWNER_EMAILS,
  PROFIT_EMAILS,
} from "@/lib/unipile/playbooks/pamEmails";
import {
  emailStep,
  messageStep,
  packEmailBody,
  spaced,
  waitStep,
  type OutreachPlaybook,
  type PlaybookStep,
} from "@/lib/unipile/playbookSteps";

const TWO_WEEKS = 336;

function fiveDayOpeners(): Array<Omit<PlaybookStep, "position">> {
  const days = Math.min(
    OWNER_EMAILS.length,
    PROFIT_EMAILS.length,
    MARKETING_EMAILS.length
  );
  const items: Array<Omit<PlaybookStep, "position">> = [];
  for (let i = 0; i < days; i++) {
    if (i > 0) items.push(waitStep(24));
    const owner = OWNER_EMAILS[i];
    const profit = PROFIT_EMAILS[i];
    const marketing = MARKETING_EMAILS[i];
    if (!owner || !profit || !marketing) continue;
    items.push(
      emailStep(owner.subject, owner.preview, owner.body, [
        {
          key: "A",
          label: "Owner dependence",
          body: packEmailBody(owner.subject, owner.preview, owner.body),
        },
        {
          key: "B",
          label: "Profit leakage",
          body: packEmailBody(profit.subject, profit.preview, profit.body),
        },
        {
          key: "C",
          label: "Marketing",
          body: packEmailBody(
            marketing.subject,
            marketing.preview,
            marketing.body
          ),
        },
      ])
    );
  }
  return items;
}

/** After Connector: 5-day email (three angles), then LinkedIn value DMs. */
export const VIP_NURTURE_PLAYBOOK: OutreachPlaybook = {
  id: "vip-nurture",
  name: "Nurture",
  channel: "linkedin",
  description:
    "People who did not convert in Connector. 5-day email (owner / profit / marketing variants), then LinkedIn value DMs every two weeks.",
  northStar: "interested_reply",
  seedDefault: true,
  steps: spaced([
    ...fiveDayOpeners(),
    waitStep(TWO_WEEKS),
    messageStep(`Hi {{first_name}},

I thought you may find this useful. Recently my {{company}} clients have been struggling with prioritising projects and getting caught fighting fires. I shared a new tool with them and the results have been amazing.

It's called Pairwise Prioritising. It takes less than 5 minutes but has helped my clients:

1. Quickly identify what tasks truly matter, so they could get rid of 10 hours of work a week on average.
2. Instant clarity. Spend less time deciding and more time focused on what matters.
3. Improved team performance. They gave it to their team so everyone is now clear on their key priorities.

If you ever feel you have too many priorities to decide between, this uses the principle of simple choice and it does the thinking for you.

If you'd like it for you or your team you can get it here:
https://docs.google.com/spreadsheets/d/1zvApbmFOz7A_5Pd8s2_7Ifzj_mbI83xYAHolME58T5Q/edit?usp=sharing

Let me know your thoughts and if it helped.

Best regards,
{{coach_name}}

P.S. You can use this for more than just projects, also time, KPIs, hiring and more.`),
    waitStep(TWO_WEEKS),
    messageStep(`Hi {{first_name}},

I thought you might find this helpful. Many of my clients in {{company}} have been facing challenges with forecasting revenue and staying ahead of their financial targets.

It's called the Revenue Growth Accelerator:

1. See the future, not the past. Anticipate financial needs and course-correct before issues arise.
2. Boost team drive. It keeps invoicing and sales activity aligned to the revenue goal.
3. Transform financial visibility. A clear roadmap of what to do to keep cash flowing.

If you feel it would be useful, tell me and I'll send it across.

Best regards,
{{coach_name}}

P.S. If you'd like a call to discuss how other clients have implemented it, I'm happy to share.`),
    waitStep(TWO_WEEKS),
    messageStep(`Hi {{first_name}},

I thought you might appreciate this. Many of my clients have been navigating cash flow management. I introduced a tool that's been incredibly effective.

It's called the Cashflow Forecaster, based on the adage: revenue is vanity, profit is sanity, but cash is king.

1. Visual clarity. Input income, expenses and current bank balances and see the rises and falls. No surprises.
2. Proactive planning. Spot cash challenges before they become critical.
3. Streamlined management. Less time crunching numbers, more time making decisions.

Several clients have reported a significant drop in financial stress within 10 minutes of putting in high-level numbers.

If you'd like to explore it, tell me and I'll send it over.

Best regards,
{{coach_name}}

P.S. Beyond cash flow, this has helped clients with budgeting, seasonal changes, and negotiating with suppliers.`),
    waitStep(72),
    messageStep(`Hi {{first_name}},

I hope you found the Cashflow Forecaster useful. I wanted to follow up with another tool that complements it, the Cashflow Maximiser. Our clients always do this after using the forecaster.

1. A checklist that walks through proven ways to boost cash flow.
2. Designed for ease. A few straightforward steps can make a significant impact.
3. Actionable. Implementing even one strategy can create a noticeable improvement.

Clients using the checklist have sometimes in less than a minute thought of an idea that changed how they manage cash overnight.

If you'd like a copy of the Cashflow Maximiser, let me know.

Best regards,
{{coach_name}}

P.S. Even one of these tactics can solve a cashflow issue, and there are more than 25 to choose from.`),
    waitStep(TWO_WEEKS),
    messageStep(`Hi {{first_name}},

We obsess over profit. So I wanted to share my favourite tool because it blows the minds of 99 out of 100 people I show it to, yet it takes less than a minute.

It's the Profit Maximiser.

It's just a table of numbers, but when you see what they represent, it changes how you think about increasing profit. It shows how reducing expenses at specific profit margins can drastically alter the bottom line.

1. At a 10% margin, an 11% reduction in expenses can double your profit.
2. Seeing the numbers encourages a fresh look at expenses, the fat every business accumulates over time.
3. Immediate clarity on where financial improvements can be made.

If you'd like to see your numbers, tell me and I'll send it across.

Best regards,
{{coach_name}}`),
    waitStep(72),
    messageStep(`{{first_name}}, one thing I forgot to share. After seeing the potential of reducing expenses, here is the easiest way to look at what to reduce.

Step 1: List all your expenses
Step 2: For each expense ask "Does this help me get or keep customers?" (If no, eliminate it)
Step 3: If yes, ask "Is there a way I can reduce this expense?"
Step 4: Make action items next to each way to reduce.
Step 5: Prioritise them and get to work.

You won't always find ways to cut every cost. I've never had a client not discover something unnecessary they were still paying for.

Simple changes can lead to significant savings.

Best,
{{coach_name}}

P.S. Are you interested in other ways to increase your profit this quarter?`),
    waitStep(TWO_WEEKS),
    messageStep(`Hi {{first_name}},

Time is one of our most valuable resources, yet it's often spent on tasks that don't move the needle because the jobs end up back on your desk.

That's why I want to introduce you to one of my favourite tools, the Time Value Tracker.

1. Activity breakdown. List your activities and categorise them into £10, £100 and £1,000 jobs.
2. Instant clarity. It shows at a glance which low-value tasks consume most of your day.
3. Delegation insights. It becomes clear which tasks to hand off so you can grow the business.

In a few minutes you'll see where your time is going.

If you're interested:
https://docs.google.com/spreadsheets/d/13lch5WGPGQZCcdfMztwgO0MahjYvy-SwsegorDF0M0I/edit?usp=sharing

Best regards,
{{coach_name}}`),
  ]),
};
