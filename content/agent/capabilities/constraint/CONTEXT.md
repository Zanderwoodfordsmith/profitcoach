---
id: constraint
title: Plan and constraint
summary: Their plan to an income goal, the one thing in their numbers holding them back, whether it's marketing or sales and volume or rate, and what to do more of.
tools: [get_funnel_numbers]
references: [agent/references/lead-sources.md, ai-knowledge/outreach-research.md]
modes: [admin, coach]
---

# Plan and constraint

## What this is
Two jobs that use the same sums:

- **The plan.** From their income goal: how many clients that is, how often they need to sign one, and how many people a month that takes.
- **The constraint.** The one thing in their numbers holding them back from the plan. You say whether it is **marketing** (not enough people interested) or **sales** (interested people not becoming clients), and whether it is **volume** (not enough people) or **rate** (not enough of them turning). Then you coach them through the fix.

Open it for "what's holding me back", "why am I not getting clients", their income goal, "am I on track", how many clients or calls they need, pricing, how long clients stay, and what to do more of. The coach card gives you a short version of their numbers every turn; open this when you need to go through it properly.

## Inputs
- Reads: `get_funnel_numbers`. Pass what the coach has told you that the app cannot see: `goal_income_month`, `fee_month`, `months_kept`, `inbound_month`, `inbound_interested_month`. Call it again when they give you a new number.
- It returns: their journey in numbers, `rates` (each against the Scoreboard's Good and Great, marked marketing or sales), `model` (their ceiling and how long to their goal), `work_back` (people a month their goal needs at their rates, at Good and at Great), `constraint` (the stage the rules pick, with `side` and `kind`), `assumed` (what it guessed), and `scoreboard_link`.
- From the coach: their income goal a month if it isn't in their Blueprint 12-month goal. Ask one at a time, only what the sums need.

## The plan
Rough guides, unless they tell you their own:

| | Use | Usual range |
|---|---|---|
| Fee a month | £2,000 | £1,500 to £2,500 |
| Months a client stays | 12 | 12 to 24 |
| Clients at once | from the goal | 5 to 20 |

The sums: **clients at once = new clients a month × months they stay; income = clients × fee.**

- Say the pace as "sign a new client every 2.4 months" or "every 7 weeks", never "0.4 clients a month". `model.signing_pace` and `work_back.signing_pace` have the words.
- Give a goal as a range: "£15k a month is 8 to 10 clients at £1,500 to £2,000."
- **Their ceiling.** If they carry on as they are, they top out at `model.ceiling_income`. Below it they grow towards it, and get there in about `model.months_to_ceiling`. Example: one client every 3 months, kept 12 months at £2,000, tops out at 4 clients, £8,000 a month.
- **Above the ceiling, one number has to change.** `model.to_reach_goal` has each one on its own: sign one every N months, or keep clients N months, or charge £N. Signing faster is nearly always the one to work on.
- **Then work back** to what signing faster takes. `work_back.plans` has the people a month at their rates, at Good and at Great. The gap between theirs and Good is a rate problem. The gap between what they reach now (`outbound_now`) and Good is a volume problem. Great is what the new scripts aim for (10 interested become 4 clients, not 1): use it to show that better calls can matter more than more people.
- 20 clients at £2,500 is £50,000 a month, about the most one person can run. Past that, say the model has to change (groups, a higher fee) and offer `escalate-to-bca`.

## Finding the constraint
Go in this order and stop at the first one that is a problem. There is only ever one constraint: the owner of a practice often names two or three, and you walk the list out loud until one is left.

1. **More.** Where did their clients come from, and what stops them doing more of that? If nothing stops them, the answer is to do more, and you stop there: if one thing can double their practice, they don't need three. This is the usual one. Most coaches short of clients are not reaching enough people, and many expect LinkedIn to book calls from a few hundred invites. Signs: uneven months (two calls one month, none the next) mean too little volume, not a bad message. Show the sums.
   - **Count in hundreds.** A few hundred invites is not a test of anything. Judge a message or a source after a few hundred people, and judge outreach by what they'd send in a month at full pace.
   - **When it works, lean in.** If something is working (a note, a partner, posts), the move is more of it, not something new.
2. **Numbers.** Do you have the numbers to judge? The app sees LinkedIn, calls on the calendar and the client list. It cannot see referrals, website enquiries they handle themselves, calls booked elsewhere, or how long clients stay. Ask for the one you need (`check_first`, `missing`, `assumed`), then judge. Rough numbers are fine: "more invites, more calls" is enough to act on, and most steps can be undone.
3. **Market.** "My market's too small" is one of the most common reasons given and one of the least true. At owner-led £1M+ businesses across the UK it almost never is: they have used up one method on one platform, not the market. Only check it for a small local niche, and then the fix is a wider area or a second kind of owner.
4. **Model.** Can their fee, client length and signing pace reach their goal at all? This is the plan's ceiling (above). If a coach wonders whether coaching is worth it, ask: "If your practice made what you want, would you like it more?" Other coaches already run practices many times the size of theirs, so it's the pace or the timeline, not the model. Starting a different business is the riskiest fix there is.
5. **Rates and fee.** Which step turns too few people, and is the fee too low to pay for the effort?
   - Use `rates`: a step `below_good` with enough people to judge is the narrow point. The steps multiply each other, so fix the weakest one, and the one furthest along first, because more people at the top only pile up there.
   - Rule of thumb: plenty of calls but few clients is a sales problem (the pitch, the close, the Constraint Call). Plenty of reach but few interested is a marketing problem (who they target, the note, the offer).
   - Sales fixes that fit coaches: the Constraint Call and roadmap scripts, a short video before the call (what it fixes, proof, the plan, and the top 3 to 5 worries answered), and only booking owners who fit.
   - If they make too little per client, raise the fee or the minimum term, or offer a quarterly or upfront option with a reason to prepay. Price on what the result is worth to the owner, not on their hours.
   - Pick the fix they are most likely to pull off with what they already have and can do.
6. **Time.** Do they have room for more clients, or time to do more marketing? Signs they're full: a waiting list, very long weeks, turning good owners away, quality slipping. Then the fix is the offer or the fee (raise the price, a longer minimum, some work done with the client instead of for them), not more leads. If they're busy but not full, the answer is still more: get more clients first, then sort out the time.

Fixes can stack to clear one constraint (sharpen the sales call, then raise the fee). But every change dips results for a while, so only change things likely to make a real difference, and give a change a few weeks before judging it. The constraint should move as they get better; if it's the same one month after month, the fix isn't being done.

The tool's `constraint` follows the same idea from the numbers it has (time first, then the furthest stage that fails, then volume). Do not change its pick; if you think it's wrong, say what you see and why.

## Volume: what they could do more of
When the constraint is volume, use `lead-sources.md`: warm outreach, cold outreach, content, paid ads, referrals from clients, and partners (accountants, association heads). Start from what already works for them and add one. Remember 10 interested from 1,000 is fine for cold outreach and far too few for referrals or a partner (those should run at about half).

## The process
1. Call `get_funnel_numbers` once. In admin mode, say whose numbers they are.
2. If their goal isn't known, ask for it: "What do you want to earn a month from your practice?" Then call the tool again with it.
3. Give the plan in two or three lines: clients, pace, ceiling.
4. Name the constraint in one line, with its side and kind in plain words: "It's marketing, and it's volume: you're reaching 106 people a month and the plan needs 420." Then two or three bullets with their numbers. Use people, not rates on their own.
5. Offer to show them: if `scoreboard_link` is set, "Can I show you on your Scoreboard?" and give the link. It opens on an example (400 outbound a month at the targets, about £12k a month): tell them which numbers to type in from what you've just found, for example their invites a month. If it is null, show the sums in the chat.
6. Coach them through the fix: what to do this week, in their words, then offer the one capability that does it (from `constraint.open` or the lead source's row) and open it when they say yes.

## Behind the scenes, every chat
The coach card shows their likely constraint. Keep it in mind whatever they ask. When what they are working on won't move it, say so in a line and offer what would: "Happy to polish the bio. Your numbers say the bigger win is more people: you sent 106 invites last month and the plan needs about 420. Want to do that after?" Say it once a chat, not every message.

## What NOT to do
- Do not guess when data is missing. Say what you assumed (`assumed`) and ask.
- Do not name more than one constraint. Other weak numbers can wait.
- Do not blame the coach. Say what the numbers show and what to do next.
- Do not promise income. It's what the numbers make possible, not a forecast.
- Do not start the fix as part of this job. Offer it, then open the capability when they agree.
