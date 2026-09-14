import {
  emailStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

export type PamEmail = {
  subject: string;
  preview: string;
  body: string;
};

function pamSequence(emails: PamEmail[]) {
  const steps = [];
  for (let i = 0; i < emails.length; i++) {
    if (i > 0) steps.push(waitStep(24));
    const e = emails[i];
    steps.push(emailStep(e.subject, e.preview, e.body));
  }
  return spaced(steps);
}

const SIGN_OFF = `Best,
{{coach_name}}`;

export const OWNER_EMAILS: PamEmail[] = [
  {
    subject: "Are you too needed in your business?",
    preview: "Being essential can eventually become the problem.",
    body: `Hi {{first_name}},

There's a trap many successful business owners fall into.

It usually starts with being very good at what they do.
Customers trust them.
The team values their judgement.
They can solve problems quickly.
They know how things should be done.

So whenever something important comes up, it naturally finds its way back to them.

A tricky customer? Ask the owner.
A team issue? Ask the owner.
A decision nobody wants to make? Ask the owner.

And before long, the whole business starts revolving around one person.

That may have helped you build the business but it can also become the thing that stops it growing because if every important decision needs you, the business can only move as fast as you are available.

So here's the question:

If you stepped away for two weeks with no calls, no messages and no checking in, what would happen?

Would the business keep moving or would things start backing up?

Tomorrow I'll send you a simple way to find out where the biggest constraints are.
It takes about three minutes.

${SIGN_OFF}`,
  },
  {
    subject: "Where is the business actually stuck?",
    preview: "You can't fix what you can't see.",
    body: `Hi {{first_name}},

When a business feels hard to run, owners often start fixing things at speed.

They hire someone.
Change the software.
Add a meeting.
Delegate more.
Try to "be more productive."

Sometimes that helps.

But often, six months later, the same problems are still there.

Why?

Because they've treated symptoms rather than the real constraint.

If people don't know what they're allowed to decide, more team members simply means more people asking for approval.

If standards only live in your head, delegating more work won't create freedom.

If every decision still comes back to you, improving your diary won't fix the business.

That's why I use the BOSS Profit & Performance Scorecard.

It takes around three minutes and gives you a score out of 100 across the key areas that drive profit, performance, control and growth.

Take it here:
{{assessment_url}}

Once you've completed it, you'll also have the option to book a 30-minute {{review_name}}, where we can look at your results together and identify what I'd fix first.

Three honest minutes can tell you a lot.

${SIGN_OFF}`,
  },
  {
    subject: '"I haven\'t got time"',
    preview: "That may be the problem, not the excuse.",
    body: `Hi {{first_name}},

One of the most common things I hear from business owners is:

"I know I need to work on the business. I just haven't got time."

I get it but that is often the problem.

If too many decisions depend on you, too many problems come back to you, and too much knowledge lives inside your head, your diary fills itself.

Then because your diary is full, you don't have time to fix the reasons everything depends on you.

Round and round you go.

The answer is not becoming better at doing everything yourself.

The answer is identifying where the business is too dependent on you and fixing those areas in the right order.

That usually means improving:

Systems
Decision-making
Team ownership
Marketing consistency
Sales conversion
Profit visibility

The BOSS Scorecard helps highlight where the biggest pressure points are.

Take it here:
{{assessment_url}}

Then, if it makes sense, book your 30-minute {{review_name}} and we'll look at what to tackle first.

${SIGN_OFF}`,
  },
  {
    subject: "What is being indispensable costing you?",
    preview: "Owner-dependence is more expensive than you think.",
    body: `Hi {{first_name}},

Owner-dependence is not just a time problem.

Time is only the bit you notice first.

The bigger cost is what doesn't happen because too much still depends on you.

The strategic work that gets pushed back.
The sales opportunity that gets followed up too late.
The team member who never steps up because you keep stepping in.
The system that never gets built.
The profit that never quite matches the effort.

That is an expensive way to run a business.

The goal is not to vanish from the business.

The goal is to build a business that performs well without needing your fingerprints on everything.

More profit.
More control.
More business value.
More choice over where your time goes.

Start with the BOSS Scorecard:
{{assessment_url}}

You'll get your score, your current business owner level, and what to fix first.

After that, you can book a 30-minute {{review_name}}, and I'll help you interpret the results.

${SIGN_OFF}`,
  },
  {
    subject: "One final nudge",
    preview: "Your business. Your call.",
    body: `Hi {{first_name}},

One final nudge from me.

If your business could:

Make more profit
Run more smoothly
Grow in value
Rely less on you for every important decision

Would it be worth three minutes to find out where things are currently getting stuck?

If something in these emails has made you think:

"Yes, too much still comes back to me."

Good. Not because that's ideal but because seeing it is useful.

You can't fix what you can't see.

Take the BOSS Profit & Performance Scorecard here:
{{assessment_url}}

Then, if you want help making sense of your results, book a 30-minute {{review_name}}.

No hard sell, simply a good look at what is going on, what it may be costing you, and what I'd tackle first.

${SIGN_OFF}`,
  },
];

export const PROFIT_EMAILS: PamEmail[] = [
  {
    subject: "More sales may not fix this",
    preview: "Revenue is not the prize if profit is leaking.",
    body: `Hi {{first_name}},

A lot of business owners assume the answer to most problems is more sales.

More leads.
More customers.
More turnover.
More activity.

And sometimes, yes, more sales help but not if the profit model underneath is leaking.

If margins are too tight, pricing is wrong, costs have crept up, conversion is weak, or the wrong clients are being attracted, more sales can simply create more work without enough reward.

That is one of the most frustrating places to be.

The business looks busy.
The team are flat out.
Customers are being served.

But the owner is still thinking:

"Why don't I have more to show for this?"

That is usually a profit leakage problem.

Tomorrow I'll send you a simple way to see where profit, performance and control may be leaking in your business.

It takes around three minutes.

${SIGN_OFF}`,
  },
  {
    subject: "Where is profit quietly leaking?",
    preview: "Most businesses have leaks they haven't spotted yet.",
    body: `Hi {{first_name}},

Most profit leaks are not dramatic. They are usually quiet.

A little too much discounting.
A few low-margin customers.
A weak follow-up process.
Inconsistent conversion.
Costs that have crept up.
Team inefficiencies that nobody has measured.
Work being redone because systems are not clear.

None of these may look huge on their own. Together, they can quietly drain a serious amount of profit. That's why I use the BOSS Profit & Performance Scorecard.

It takes around three minutes and gives you a score out of 100 across the key areas that drive profit, performance, control and growth.

Take it here:
{{assessment_url}}

Once completed, you'll also have the option to book a 30-minute {{review_name}}, where we can look at your results and identify the first profit opportunities to focus on.

${SIGN_OFF}`,
  },
  {
    subject: "Busy is not the goal",
    preview: "Activity without profit is just expensive effort.",
    body: `Hi {{first_name}},

Busy can be deceiving.

A full diary can feel like progress.
A busy team can look like growth.
Lots of customer work can make the business feel successful but busy is not the same as profitable.

If the wrong work is being sold, margins are weak, delivery is inefficient, or follow-up is poor, the business can feel successful on the surface while quietly underperforming underneath.

The real question is:

Are you getting enough profit for the effort going in?

If the answer is no, it usually comes down to one or more of the five profit levers:

Lead generation
Conversion
Average sale value
Repeat business
Profit margin

Small improvements across these areas can make a big difference.

Start by finding out where you currently stand:
{{assessment_url}}

Then book your 30-minute {{review_name}} if you want help identifying what to improve first.

${SIGN_OFF}`,
  },
  {
    subject: "This is why profit feels tight",
    preview: "You can't improve what you can't see.",
    body: `Hi {{first_name}},

Many business owners look at turnover first but turnover does not tell the whole story.

You need to know:

Which work is most profitable
Which customers are worth more
Which costs are creeping up
Which marketing is producing results
Which activities are creating profit
Which parts of the business are quietly draining time and cash

Without that visibility, decisions become guesswork and guesswork is expensive.

The BOSS Profit & Performance Scorecard helps you get a clearer view of what is working, what is leaking, and what to fix first.

Take it here:
{{assessment_url}}

Once you have your score and report, book a 30-minute {{review_name}} if you'd like me to help you interpret the results and spot the first practical actions.

${SIGN_OFF}`,
  },
  {
    subject: "What is another year of profit leakage worth?",
    preview: "Small leaks become expensive over time.",
    body: `Hi {{first_name}},

One final thought.

If your business is already working hard, the answer is not always to add more.

More leads.
More work.
More team.
More hours.

Sometimes the better move is to fix what is already leaking.

A small margin improvement.
A better conversion process.
A clearer sales follow-up.
A stronger pricing structure.
A more efficient delivery process.

These can all improve profit without simply piling more work on top.

So before another month disappears, take three minutes and find out where your business may be leaking profit, time or control.

Take the BOSS Scorecard here:
{{assessment_url}}

Then, if you want help working out what to fix first, book your 30-minute {{review_name}}.

${SIGN_OFF}`,
  },
];

export const MARKETING_EMAILS: PamEmail[] = [
  {
    subject: "Why is marketing so hit and miss?",
    preview: "More activity is not always the answer.",
    body: `Hi {{first_name}},

A lot of business owners are frustrated with their marketing.

They post.
They network.
They send emails.
They try campaigns.
They ask for referrals.
They maybe even pay someone to help.

But the results are still inconsistent.

A few leads here.
A quiet patch there.
Some interest, but not enough of the right conversations.

So they assume the answer is more marketing but more activity is not always the answer.

If the message is unclear, the audience is too broad, the offer is weak, follow-up is inconsistent, or conversion is poor, more marketing can simply create more noise.

The goal is not just more activity.

The goal is a better commercial system.

Tomorrow I'll send you a simple way to see where your marketing, sales and business performance may be getting stuck.

${SIGN_OFF}`,
  },
  {
    subject: "You may not have a lead problem",
    preview: "The real issue may be earlier or later than you think.",
    body: `Hi {{first_name}},

When marketing is not working, most people assume they need more leads. Sometimes they do but often the real issue is somewhere else.

The target market is too broad.
The message is too vague.
The offer is not compelling enough.
The follow-up is weak.
Sales conversations are not converting.
Delivery is too dependent on the owner, so growth feels risky.

That is why "do more marketing" is not always the best first answer. You need to know where the real constraint is. That's why I use the BOSS Profit & Performance Scorecard.

It takes around three minutes and gives you a score out of 100 across the key areas that drive profit, performance, control and growth.

Take it here:
{{assessment_url}}

Once you've completed it, you'll also have the option to book a 30-minute {{review_name}}, where we can look at your results and identify what I'd focus on first to improve your lead flow and conversion.

${SIGN_OFF}`,
  },
  {
    subject: "More leads won't fix everything",
    preview: "Especially if the rest of the system is leaking.",
    body: `Hi {{first_name}},

More leads sound lovely.

Of course they do but more leads will not fix everything if the system behind them is weak.

If the wrong people are enquiring, conversion will suffer.
If follow-up is inconsistent, opportunities will leak.
If pricing is unclear, sales conversations become awkward.
If delivery depends too much on the owner, growth creates pressure instead of progress.

Good marketing does not sit on its own. It connects to sales, operations, team, profit and delivery. That is why the BOSS Scorecard looks across the business, not just at one isolated activity.

It helps identify where the biggest constraint sits, so you don't waste the next 90 days fixing the wrong thing.

Take it here:
{{assessment_url}}

Then book your 30-minute {{review_name}} if you'd like help interpreting your results.

${SIGN_OFF}`,
  },
  {
    subject: "Inconsistent marketing is expensive",
    preview: "Quiet pipelines create noisy problems.",
    body: `Hi {{first_name}},

When marketing is inconsistent, the whole business feels it.

Sales become unpredictable.
Cash flow becomes harder to manage.
The team are either too quiet or too stretched.
The owner starts chasing work, discounting, overthinking, or saying yes to the wrong customers.

That creates pressure and pressure usually leads to reactive decisions.

The better route is to build a business where marketing and sales are part of a consistent system.

Clear market.
Clear message.
Clear follow-up.
Clear conversion process.
Clear numbers.

The BOSS Profit & Performance Scorecard will show you where the gaps are and what to fix first.

Take it here:
{{assessment_url}}

Once you've completed it, book your 30-minute {{review_name}} and we'll identify the first practical moves to improve your pipeline.

${SIGN_OFF}`,
  },
  {
    subject: "Still guessing what to fix?",
    preview: "Start with the diagnosis.",
    body: `Hi {{first_name}},

One final nudge.

If you want more consistent leads, stronger sales conversations and a better pipeline, don't start by guessing.

Start with the diagnosis.

The BOSS Profit & Performance Scorecard takes around three minutes and shows you where the business may be getting stuck.

You'll get:

A score out of 100
Your current business owner level
Insight into what is working
Clarity on what may be holding back performance
Guidance on what to fix first

Take it here:
{{assessment_url}}

Then, if you want support turning the results into action, book a 30-minute {{review_name}}.

No hard sell, simply clarity on what to focus on next.

${SIGN_OFF}`,
  },
];

export const PAM_OWNER_DEPENDENCE: OutreachPlaybook = {
  id: "pam-owner-dependence",
  name: "Nurture · Owner dependence (5 days)",
  channel: "email",
  description:
    "5-day email for owners stuck in the day-to-day. Scorecard, then a 30-minute review.",
  northStar: "assessment_start",
  seedDefault: false,
  steps: pamSequence(OWNER_EMAILS),
};

export const PAM_PROFIT_LEAKAGE: OutreachPlaybook = {
  id: "pam-profit-leakage",
  name: "Nurture · Profit leakage (5 days)",
  channel: "email",
  description:
    "5-day email for owners with revenue but profit that does not match the effort.",
  northStar: "assessment_start",
  seedDefault: false,
  steps: pamSequence(PROFIT_EMAILS),
};

export const PAM_MARKETING: OutreachPlaybook = {
  id: "pam-marketing",
  name: "Nurture · Marketing not working (5 days)",
  channel: "email",
  description:
    "5-day email for owners who need more consistent leads and a better pipeline.",
  northStar: "assessment_start",
  seedDefault: false,
  steps: pamSequence(MARKETING_EMAILS),
};
