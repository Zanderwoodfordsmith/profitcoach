/**
 * Seed the Client Closing section with objection-handling and closing guides.
 *
 * Source: internal sales playbook (ClickUp doc "Handle Objections with
 * Universal Closes" + subpages + "Closes"), generalised for coaches closing
 * their own clients. Adds 7 text-guide lessons to
 * `client-acquisition-step-6-sales-calls` in content/academy/classroom-hub.json
 * and upserts matching rows (body + guide markdown) into academy_lesson_content.
 *
 * Run: npx tsx scripts/seed-client-closing-guides.ts
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const HUB_PATH = path.join(process.cwd(), "content/academy/classroom-hub.json");
const SECTION_ID = "client-acquisition-step-6-sales-calls";
const COURSE_ID = "client-acquisition";

type SeedLesson = {
  id: string;
  title: string;
  body: string;
  guide: string;
};

const LESSONS: SeedLesson[] = [
  {
    id: "client-acquisition-client-closing-find-the-real-objection",
    title: "Find The Real Objection",
    body: `Most deals don't die because of the objection you hear — they die because of the one you never uncover. This guide gives you the map of the six real objections hiding behind "I need to think about it", and the exact questions that surface them without breaking rapport.`,
    guide: `## Why the objection you hear is rarely the real one

The most dangerous objection on any sales call is the one you don't know about. Prospects often don't feel comfortable being fully honest — so they reach for a polite smokescreen ("I need to think about it", "send me an email") instead of telling you what's actually in the way.

Your job at the close is not to argue with the smokescreen. It's to **root out the core objection** so you can give the prospect the targeted clarity or confidence they need to move forward. Randomly firing case studies or product features at them without knowing the real concern is ineffective — and it usually reads as pressure.

## The six real objections

Almost every stall maps to one of these:

**1. Process / product** — you didn't land the pitch, and they're still not clear on how your coaching actually works.

**2. Value** — they understand it, but don't see the value relative to the price.

**3. Money** — they don't have the full amount; or they have it but haven't reached their action threshold; or they need a payment structure; or this would be the last of their available cash, so it *has* to work.

**4. Partner** — they feel they need to speak to a spouse, business partner or mentor. Sometimes that's genuine respect, sometimes it's permission, and sometimes it's fear of being judged for deciding alone.

**5. Timing** — logistics in their head: workload, hiring, a holiday, a house move, projects to finish first.

**6. Fear** — burned before, never invested in themselves, scared of losing the money, or doubting *themselves* rather than your process.

## Hold your frame

Expect objections. Welcome them. Every objection is an opportunity to pour confidence into the prospect — if they didn't want to buy, they'd simply end the call. They want to buy; they just don't yet know how to find the confidence to do it, and they're looking to you to make sense of the thoughts in their head.

Know your own tells. When your tonality drops or your body language shifts, you've broken frame — you've silently accepted the deal is lost. Catch it, reset, and keep working from curiosity rather than combat: calm, slow, warm.

Watch for traps that end the call politely:

- *"Can you just send me over a proposal with everything we covered?"*
- *"Can you email me the price and details?"*

Don't fall into their frame and agree to homework. Instead:

> **"Sure, not a problem — and what specifically would you like me to include in that email, just so it's actually useful to you?"**

Their answer tells you exactly where the real concern lives.

## Can't find it? Give them the options

If you've dug and still can't isolate the concern, close the doors on where the conversation can hide. Step outside the sales frame and be completely human:

> **"Hey [NAME], do you mind if we step outside the sales call for a second and just talk person to person? I genuinely know I can help you — I mean that — but I get it, you want to make sure this is the right thing for you.**
>
> **Usually when someone says that to me, it's because they're concerned about one of four things: money, time, their partner, or they're just a little bit fearful. Out of those four, which one is coming up for you — just so I can genuinely help you with it?"**

By naming their likely objections for them, you make it safe to tell the truth — and most people will.

## "I never make decisions on the day"

Some prospects present a decision-making rule rather than an objection. Don't fight the rule; get curious about where it came from:

> **"Understood — and frankly, I don't have a problem with that. Your process is your process. My job isn't to force a decision; I couldn't even if I tried, there's a big red 'End Meeting' button at the bottom of your screen.**
>
> **I'm just curious — when you say you don't make fast decisions, is that something you've always done, or something you started doing after a decision in the past didn't work out?"**

Nine times out of ten this surfaces a fear-based objection you can now actually address.

## The one rule

You MUST actively listen. Not every prospect will serve the answer up on a plate — sometimes you'll have to infer it from tone, hesitation, and what they *don't* say. But you cannot close what you cannot see. Understand first; close second.`,
  },
  {
    id: "client-acquisition-client-closing-universal-closing-loops",
    title: "The Universal Closing Loops",
    body: `A calm, repeatable engine for the end of the call. When the answer isn't a clear yes, you don't argue the objection — you run the loops: re-open, isolate, reframe, and ask again. Memorise these and you'll never feel lost at the close.`,
    guide: `## When to use the loops

You've asked: **"So given everything we've covered, do you want to move forward and do this together?"**

If the answer is anything other than a clear "yes" — "I need to think about it", timing, spouse, money — you start Loop 0.

Tone rules for every loop:

- Calm, slow, warm.
- You're curious, not combative.
- Every loop ends in **another ask**.
- Never argue the specific objection — plug whatever they say into the next loop.
- Loop 3–4 times maximum, then release. No two-hour hostage situations.

## Loop 0 — "Do you think this can help?"

**Goal: re-open the door without pressure.** Tie back to their goal and their why.

> **"Totally get that. Do you mind if I ask you a quick question? Do you think this is something that can genuinely help you get closer to [their goal — e.g. £Xk a month working 20 hours a week so you can spend more time with your family]? Because at the end of the day, that's the most important thing."**

If they say **yes** and sound strong: **"Okay, great. In that case, shall we just get you started?"**

If they wobble or say anything else → Loop 1.

## Loop 1 — "What's your main concern?"

**Goal: get the real objection on the table.**

> **"Okay, that makes sense. So what would you say is your main concern about moving forward?"**

Then be quiet and let them talk. Whatever they say — money, time, spouse, fear — acknowledge it and go to Loop 2.

## Loop 2 — "That might be the perfect reason"

**Goal: flip the objection into the reason to act.**

> **"I completely understand. And honestly, that might be the perfect reason you should do this. You just said [repeat their words — 'you don't have time' / 'you're worried about money' / 'you keep putting this off']. That pattern is exactly what has kept you where you are now. If we don't change anything, do you honestly see the next 12 months looking any different?"**

Let them answer. Then:

> **"Given that, it feels like this is exactly the kind of structure and support you've been missing. Do you want to fix it now and get started?"**

Variations that fit inside Loop 2:

- **"I need to speak to my partner"** — "Big decisions are joint decisions, totally get that. The only risk I see is: you told me you want more control, but if every move waits on someone else's timeline, nothing really changes. What if we make the plan together now, so you take a clear, concrete proposal to your partner instead of another 'one day I might…' conversation?"
- **"I don't have time"** — "You've just said you're so busy building everyone else's agenda that you can't carve out a few hours a week for your own goals. That's the exact pattern that's kept you on the treadmill."
- **"It's a lot of money"** — "You've just told me an investment at this level feels scary — which tells me how exposed you feel right now. That's exactly the insecurity you said keeps you up at night. If nothing changes in 12 months, does that feel safer, or riskier?"
- **"I'm not sure it'll work for me"** — "You told me this isn't the first time you've looked at solving this. The pattern has been: think about it, life gets in the way, a year later nothing's changed. If we repeat that pattern, do you see the next 12 months looking different?"

If still not a yes → Loop 3.

## Loop 3 — "Hypothetically, if this were perfect…"

**Goal: separate fit from fear.**

> **"Totally fair. Let's do this hypothetically for a second. If this were a 10 out of 10 for you — absolutely perfect, exactly what you wanted — would you do it?"**

- If **no** → they don't really want the outcome. You can release.
- If **yes** → **"Okay, helpful. What's different about that perfect version in your head compared to what we've gone through today?"**

They'll tell you the gap. Address it simply — clarify, correct the misunderstanding, or explain "we actually do that, here's how" — then: **"Given that, does it now feel like enough of a fit to get started?"**

If still no → Loop 4.

## Loop 4 — "Zoom out"

**Goal: pull them out of the weeds and back to the big picture.**

> **"Got it. Let's just zoom out for a second. Big picture: you're trying to [restate their core goal]. All we do is help people like you get there in a structured way, without [their core constraint]. So big picture — what do you feel is really holding us back from getting started today?"**

Let them talk. Then:

> **"Okay, that makes sense. Given [restate their fear] — and that nothing changes if we don't act — do you want this next year to look different from the last one, or the same? … If you want it to look different, this is the plan. Shall we get you started?"**

If still no → Loop 5.

## Loop 5 — "1–10 — and why not a 1?"

**Goal: make them sell themselves.**

> **"On a scale of 1 to 10, where 1 is 'this is completely wrong for me' and 10 is 'this is exactly what I've been looking for' — where are you right now?"**

They answer, say a 7. **"Got it. What would make it a 10?"** — listen, address it if reasonable. Then the key question:

> **"And why didn't you say a 1?"**

They now list every reason it IS right for them. Then:

> **"Those all sound like really strong reasons TO do this, not to avoid it. Given everything you've just said, are you open to taking the step and getting started?"**

If still no → Loop 6.

## Loop 6 — "Best case / worst case"

**Goal: the final rational check.** (Adapt the worst case honestly to your own guarantee and refund terms.)

> **"Totally understand. Let's look at it logically for a second — best case, worst case.**
>
> **Best case: you put the hours in, follow the plan, and in the next 6–12 months you've [their target outcome].**
>
> **Worst case: you put real effort in, you learn a complete system, and you get a serious, structured attempt at this. Even if you stop, those skills stay with you for life.**
>
> **Looking at it that way — does it feel more like a smart, calculated risk, or a reckless one?"**

Let them answer. **"If it feels like a smart risk — and you've said you don't want another year like the last one — are you willing to back yourself and get started?"**

## Releasing well

If after this they're still a hard no or extremely wobbly, release gracefully:

> **"Totally okay. It sounds like the timing just isn't right. I'll send over a couple of case studies, and we can revisit if and when it makes sense."**

If it's a legitimate "need my partner / need a date" situation, book the follow-up call **before you hang up**. Otherwise, let it go — your confidence on the next call is worth more than a forced close on this one.

## The pattern to remember

If you forget everything else, remember the shape every good objection response takes:

1. **"I get it."** (Acknowledge)
2. **"What do you really mean?"** (Diagnose)
3. **"Here's the cost of staying where you are vs. where you said you want to go."** (Reframe)
4. **"Given that — is this actually a yes or a no?"** (Close)`,
  },
  {
    id: "client-acquisition-client-closing-time-to-think-objection",
    title: `Handling "I Need Time To Think About It"`,
    body: `The most common objection — and the biggest deal-killer, because it isn't real. "Time to think" is a smokescreen for money, partner, timing or fear. This guide shows you how to diffuse it, re-tie the prospect to their goal, and surface what they'll actually be "thinking about".`,
    guide: `## This objection doesn't exist

"I need time to think about it" is the most frequent objection you'll face — and technically the easiest to overcome. Yet it kills more deals than any other, because most people take it at face value.

It's a smokescreen. It masks the real objection, which is almost always **money, partner, timing, or fear/doubt in the process**. Your job is not to grant thinking time or fight it — it's to find out what's actually behind it. The most dangerous objection is always the one you don't know about.

## Don't come out swinging

If you respond with "What is there to think about?" or "Do you feel like you have all the information you need?", one of two things happens: you torch the trust you've built, or you back yourself into a corner when they say "nothing right now, I just need time." Prospects set traps too.

Instead, acknowledge that they're clearly not in the buying pocket yet (which is true), keep your frame, and re-open the conversation gently.

## Step 1 — Diffuse and re-tie

> **"That's absolutely fine, not a problem. And just before you do go away and have a think about things — just to check — do you genuinely believe this can actually get you to [their goal, e.g. £Xk per month]? Because at the end of the day, that's the most important thing."**

When people hear a price they panic about the investment and forget their pains, their desired outcome, and why they booked the call. This question re-ties them to all three.

## Step 2 — Make them tell you why it works

When they say "yes, I do believe it can":

> **"Okay — and why do you feel like this can get you to [goal]?"**

Now grade their answer:

- **Shallow answer that dodges their own situation** (e.g. "well, it worked for other people"): **"Okay, and what's the main thing that makes you feel like this could work for you specifically?"**
- **Shallow but on-topic answer** (e.g. names one feature): **"And what else makes you feel like this could fix [their problem] and get you to [goal]?"**
- **Very brief answer**: **"And what specifically about [the thing they named] makes you feel like it could get you to [goal]?"**
- **Detailed answer with good energy**: move on to Step 3.

The point: get them to **sell themselves** on why this works instead of retreating into their shell. You're rebuilding the emotional buy-in the price pitch knocked over.

## Step 3 — Ask what they'll actually be thinking about

> **"Okay, so you're happy with the process and you feel like it can get you to your goals. So — just so I can be of best service to you — when you do go away to have a think about it, what will you be thinking about? Just in case I can help you out with that."**

Asked warmly, this is the question that surfaces the real objection. Listen actively. It might come out as "I just want to check the finances" (money), "I'd want to run it past my other half" (partner), "things are manic until next month" (timing), or vague hedging (fear).

Once you know which one it is, switch to the matching guide — Money, Partner, or Timing — and work it properly.

## If they ask for an email or proposal instead

> **"Sure, not a problem — and what specifically would you like me to include in that email, so it's actually useful?"**

Their answer reveals the concern. An email that "covers everything" closes nothing; a call that addresses the one real concern closes deals.

## Mindset

Expect this objection on nearly every call, and welcome it. If you're surprised or deflated by it, your tonality shifts, your frame breaks, and the prospect feels the call die. If you expect it, it's simply the doorway to the real conversation — approach the prospect from a place of genuine understanding, and give them **targeted** clarity or confidence rather than a scattergun of case studies.`,
  },
  {
    id: "client-acquisition-client-closing-money-objection",
    title: "Handling The Money Objection",
    body: `The second most common objection — and the one you must fully resolve before touching anything else. This guide covers the immediate "that's expensive!" reaction, the re-tie, finding out what cash is really available, payment plans that close, and the deposit track for a two-call close.`,
    guide: `## First, know what you're dealing with

Money is the second most frequent objection — and like "time to think", it can't always be taken at face value. Sometimes it masks product doubts, partner, timing or fear. But unlike other objections, you **cannot progress the close until money is resolved**: there's no point spending twenty minutes dissolving someone's fears only to discover they don't have the capital to start at all.

The sequence is always: confirm they're bought into the process → confirm the money situation → agree a payment structure that would theoretically work → then handle whatever is left.

## The immediate reaction: "Wow, that's expensive!"

Used only right after you deliver the price:

> **"Okay — and in terms of thinking it's expensive, [NAME], are you comparing that to anything specifically?"**

This tells you whether they're talking to competitors (note it — you may need it later). If they say no, staircase down:

> **"Understood. So by 'expensive', do you mean it's just a little more than you thought — or do you mean it's a little more than you can afford right now?"**

Ask it exactly like that, with the "or" creating two clean paths. Either answer gives you new information: how bought-in they are, and whether pay-in-full is realistic.

Then park the money and re-tie:

> **"Okay, look — let's put money to the side for a second, because I can help you out with that. But just to check: do you feel like this can actually get you to [goal]? Because at the end of the day, that's the most important thing."**

Putting money aside diffuses the panic, re-opens the conversation, and reminds them why they're here. Don't dive into a payment plan without this — you'll miss the emotional commitment you need for them to commit financially.

## After the re-tie: isolate the logistics

> **"Okay, so from what it sounds like: you love the process, you see the value, you're 100% sure this is the right thing for you — it's just the logistics and the finances getting in the way, right?"**

This is a temp-check and a re-tie in one. A soft or uncertain "yes" means there's still doubt underneath — explore it before going further. A clear yes means you're genuinely dealing with money. Then:

> **"And is the [amount] just not liquid right now?"**

- **"Yes, but…"** — they can technically afford it, but fear is present (it's all their available cash, or it squeezes other commitments). Move towards a payment structure, and layer on real conviction that this will work.
- **"No"** — you need a clearer picture of cash on hand before offering anything.

> **"Got it — well, other than [their current income source], what are some other ways we might be able to come up with the funds to get you to [goal]?"**

You're prompting them to think wider — savings, support from family, credit. If they're willing to *discuss* options, they're usually willing to *use* them. Some prospects will ask for a payment plan outright here; good.

## Offering the payment plan

Trial-close it first — this builds reciprocity and flushes out any deeper objection:

> **"Okay — if you're 100% in and you definitely feel this is the right thing for you, I don't want money to be the thing that stops you. Would it help if I broke this down into something a little more manageable?"**

If they say "perhaps, but I'd need to speak to my wife first" — you've just found the real objection (partner). Handle that first.

If yes, present **two options** — the illusion of choice means either answer is a close:

> **"So what I can do is split this into [X] payments of [£A], or [X] payments of [£B]. Out of those two, which one would you like to do?"**

Two ways to pair the options: two close plans (e.g. 2-pay and 3-pay) optimises cash collected; a polarised pair (e.g. 2-pay and 6-pay) makes the smaller payment feel dramatically accessible. Avoid "this offer is only available on this call" pressure tactics unless it's genuinely true — dishonest urgency poisons the client relationship you're about to start.

**If they're happy — close:** *"With all of this in mind, does that mean let's do this?"*

## If they sound uncertain

> **"You sound a little uncertain — is that because you can make the first payment, but you're worried about the rest?"**

Dig gently. Then, if needed:

> **"Understandable. Look — I'm not willing to let money be the thing that stops you from reaching your goals. Do you mind being open with me about what's actually available right now cash-wise, and if I can, I'll create a custom plan for you?"**

> **"And do you have access to any credit that might help you out with that?"**

Final card — the case-study close:

> **"[NAME], this isn't something I normally do, but given that you're a perfect fit: I can split this into [X] payments of [£X] — on the basis that when we get you to [goal], you're willing to do a written or video testimonial for us. I'm happy to help you reach your goals if you're happy to help me reach mine. Does that work for you?"**

Then a low-pressure closing line: *"Does that mean we can welcome you aboard?"* If they still say no, there's another objection underneath — go find it.

## The deposit track (two-call close)

If you can't close on the call, aim for a deposit rather than a vague follow-up:

> **"Feel free to shoot straight with me — do you genuinely feel this will get you to [goal]? Because you obviously don't have to do this if it's not right for you."**

*"Yes, I just need to sleep on it."*

> **"Okay, given that you feel this is the right thing and you just don't want to rush the decision — the standard practice here is we'd process a small refundable deposit, so you can take a day or two to think it over. Nothing crazy — [small amount], for example. We do this for two reasons: one, you're making a meaningful commitment today towards [goal]; and two, it lets me send you exclusive resources so you can make a properly informed decision. If you're ready to get started on our next call, great. If you decide it's not right, we simply refund it. Either way there's nothing to lose — shall we get that processed for you?"**

Book the follow-up call before you hang up. A deposit plus a diary slot is a live deal; "I'll email you next week" is a dead one.`,
  },
  {
    id: "client-acquisition-client-closing-partner-objection",
    title: "Handling The Partner Objection",
    body: `"I need to speak to my partner first" — genuine respect, or a polite exit? This guide shows you how to tell permission from FYI, keep the deal alive with a deposit or live break, and — when trust is high — use the Responsibility Close.`,
    guide: `## Open the door gently

When a prospect says they need to talk to their spouse or business partner, never fight it. Explore it:

> **"Not a problem — and when you do go to have a chat with your partner, what do you think you'll be discussing?"**

*"I don't know, I just feel like I need to talk to them before deciding."*

> **"Okay — just to check, do you feel like your partner would want you to [achieve their goal — e.g. build this income for you and your family]?"**

*"Yes."*

> **"Understood — and why would they want that? How would it benefit them and the rest of the family?"**

Let them articulate it. They're now selling their partner's side of the deal for you. Then:

> **"So when you do speak with them — in the past, when you've made decisions like this, what were some of the things that might have stopped them from moving forward?"**

Summarise and set up the key question:

> **"So from what I understand: you feel this is the right thing for you, it'll get you to [goal], and you just want to explore it with your partner. But — what will you do if your partner doesn't want you to take the steps you need to reach [goal]? What happens then?"**

Their answer tells you everything. Then ask directly:

> **"So do you feel like this is more of a permission-based conversation, or an FYI conversation?"**

## Path A — Permission

If they genuinely need their partner's agreement, don't bulldoze it — qualify the conversation they're about to have:

- **"Are they involved in this side of things? What do they do?"**
- **"Are they aware that [the problem] is a problem? Are you both in agreement on that?"**
- **"Are they supportive of you getting help to fix it?"** (If not: *"Can you elaborate — why is that?"*)
- **"What do you think they'll say about this solution?"**
- **"And what do you think they'll say when they hear the investment?"**
- **"Do you have a budget you can spend without checking in first?"** — you MUST ask this one.
- **"Do they know about us?"**

Then keep commitment alive with the refundable deposit:

> **"Okay — given that you definitely want to do this and it's just a case of speaking with [partner], the standard practice here is we'd process a small refundable deposit. Nothing crazy. Two reasons: you're making a meaningful commitment today towards [goal], and it lets me send you exclusive resources so you can both make an informed decision. If you're ready to go on the next call, great; if you decide it's not right, we simply refund it. Nothing to lose — shall we get that processed?"**

If they refuse the deposit *and* earlier told you they'd happily spend a similar amount on something material without checking in, hold up the mirror — gently:

> **"You told me earlier you'd happily spend [£X] on [that thing] without touching base with anyone. But when it comes to a meaningful step towards [goal], you're not willing to do the same? I don't understand that — so can we forget we're on a sales call for a second and just have a normal conversation? Because I genuinely have your best interests at heart. What's actually going on?"**

## Path B — FYI

If it's genuinely just a courtesy conversation:

> **"Okay — if you're going to do this either way, how about this: why don't we just get you started, and if your partner turns around and says absolutely not, drop me a message and we'll give you a full refund. [NAME], you're perfect for this, and I don't want an FYI getting in the way — especially when a big part of the reason you want [goal] is for them. What do you say?"**

(Only offer this if your refund terms genuinely allow it.)

## Path C — Both decision-makers on the call

If both partners are present and want to "discuss privately":

> **"I was actually waiting for you to say that — it makes complete sense. To save us playing email tennis, how about this: I'm going to go make myself a coffee and come back in five or ten minutes. While I do, you two put yourselves on mute and talk it through. If you've got any final questions afterwards, we'll dive straight into them. Sound like a plan?"**

Never let both decision-makers leave the call to "discuss later" — that conversation happens without you, against a memory of the pitch instead of the pitch itself.

## The Responsibility Close (advanced)

Reserved for when you've built genuine trust and the prospect is stalling on partner approval from low confidence rather than real logistics. Delivered without empathy, this will kill the deal — delivered well, it's the most powerful close there is.

> **"[NAME] — will you get offended if I ask you a very blunt question?"** *("No.")*
>
> **"In your opinion, whose responsibility is it for you to get to [goal]?"** *("Mine.")*
>
> **"And the results you've had so far — the wins, the losses, the sweat — that's all been down to you, right?"** *("Yes.")*
>
> **"Bit of a curveball — what does your partner do?"** *("They're a [profession].")*
>
> **"Okay, and I mean this with all due respect: your partner doesn't come to you to figure out how to [do their job], right? Because that's not your world — in exactly the same way this isn't theirs. So why does it feel fair to ask them to make a decision for you on something they're not really involved in? They can lend an ear, but they don't understand this the way you and I do. And in [X] months, when you're at [goal] — how will they feel? Proud, I'm guessing. But whose responsibility is it to make that happen?"** *("Mine.")*
>
> **"So if this is on you and no one else — even if it's scary — what decision would the version of you that's already at [goal] make, right here and now?"** *("They'd do it.")*
>
> **"Precisely. And I'm not going to let you fail — we'll be with you every step of the way. So what do you say?"**

No "but" after "with all due respect" — ever. If the conversation starts to feel more like a coaching session than a sales call, you're doing it right.

## After the yes

Keep selling through and after the close. New clients are still nervous; encourage them, make them feel *good* about the decision, and don't leave them in fear or panic — the emotion they end the call with is the emotion they'll sit with for days. That's the difference between a solid start and a refund request.`,
  },
  {
    id: "client-acquisition-client-closing-timing-objection",
    title: "Handling The Timing Objection",
    body: `"I'm too busy" and "not right now" are the easiest objections to solve — once you split them into what they really are: a bandwidth worry or a calendar clash. This guide gives you the scripts for both, plus the practical structures (delayed start, deposit, follow-up) that stop good deals dying of drift.`,
    guide: `## Two different objections wearing the same coat

Timing is usually easier to overcome than money or partner — but check you're not being smokescreened first. People don't "find time" for things they don't believe will work, so make sure the prospect is genuinely sold before you solve logistics.

Real timing objections come in two types:

- **Bandwidth** — "I don't have enough hours in the week."
- **Timeframe** — "Bad timing: I'm on holiday / finishing a project / moving house."

## The bandwidth objection

Bandwidth is partly a fear objection — they're worried that with their schedule, they'll fail. So bring conviction, not just logic.

*"I don't have the time to do this at the moment between work and other commitments."*

> **"Okay, not a problem — and just hypothetically: if you did have the time, do you genuinely believe this would get you to [goal]?"**

Always re-tie first. A hesitant yes means they're not sold — go back and fix that before touching the calendar. A clear yes:

> **"So at the moment it's purely a bandwidth issue. Out of interest — how much time are you currently spending per week researching and actively trying to solve [problem]?"**

*"About [X] hours a week."*

> **"[X] hours?! You're already doing more than I expected — so I can tell you now, time isn't going to be the issue. We'd only need half of that to get you to [goal]. Would it help if I explained, step by step, exactly what you'd need to do?"**

Walk them through it concisely, then:

> **"Now — does [X] hours in total seem like a reasonable amount of time to invest to make sure you get to [goal]?"**

Yes → close.

**"Yes, but it's going to be difficult right now":**

> **"I hear you — but from what I understand, you're already losing [X] hours a week, [4X] hours a month, on trial and error. I admire the work ethic, but it's not just about working hard, it's about working smart, right? So do you want to keep losing [4X] hours a month without the results you want — or do we draw a line in the sand and dedicate half that time to getting you on track to [goal]?"**

If they still push back, raise the standard:

> **"Getting to [goal] is exceptional, right? If average effort achieved it, everyone would do it. So are you willing to make some short-term sacrifices to live an exceptional life long-term? … Think of anyone you admire in business. When they find the solution to the problem that's holding them back, do they wait for the perfect time — or do they seize the moment? So if the goal is to achieve exceptional things, what do you think we should do?"**

## The timeframe objection

Easier still. Get precision first:

- **"So when exactly would be the right time for you to get started?"**
- **"What do you feel is getting in the way of taking action sooner?"** (explore this properly — it's often something you can remove)
- **"And theoretically, if you did start today, how much time could you give this per week at a push?"**

Then pick a structure:

**Additional access.** Sign them today; compensate the "lost" time. E.g. they're away for two weeks:

> **"So you want to start, but you're on holiday for two weeks and don't want to lose that time — makes sense. Here's what I propose: we get you started today on the payment plan, but I'll make sure the next payment isn't taken for six weeks — so you get two weeks on the house. You'll have full access from today, and to make sure you don't feel hard done by, I'll also throw in a one-hour 1-1 session when you're back if you move forward today. How does that sound?"**

**Deposit + delayed payment.** If they won't start today, take a refundable deposit now and set up a delayed first payment for their chosen start date. A delayed payment *alone* is weak — it's too easy to cancel by email the day before. Deposit first, then delay.

**Follow-up.** The minimum outcome: book the follow-up call for their start window before you hang up, get their phone number, and keep them warm in between.

**Moving money around.** If they're in but need to shuffle funds: if it can be done there and then — even if it takes 30 minutes — stay on the call while they do it. If it's more complicated, use deposit + delayed payment, or book the earliest possible time-boxed follow-up (same day if you can).

## Useful pressure-test questions

- **"How many hours per week do you think is reasonable to dedicate to making sure you get to [goal]?"**
- **"To get to [goal], would it be worth rearranging your schedule for the next few weeks?"**

The theme in all of it: never accept "later" as an answer without a date, a structure, and some commitment attached. Drift is where good deals go to die.`,
  },
  {
    id: "client-acquisition-client-closing-universal-closes-final-moves",
    title: "Universal Closes & Final Moves",
    body: `The finishing moves: the "Why aren't you going with them?" price-comparison close, how to pitch your contract without losing the deal, and how to keep selling through — and after — the yes so it sticks.`,
    guide: `## The "Why aren't you going with them?" close

**The setup:** a prospect says, *"This other coach / programme is cheaper — half the price of yours."*

**The response:**

> **"Totally understand. Why aren't you going with them?"**

**What happens next:** they answer their own objection — *"Well… you have this thing, and that thing, and you do it this way…"*

**The close:**

> **"That's why we're more."**

**Another version:**

> **"If the prices were the same — which one would you do? Ours or theirs?"**

*"Yours."*

> **"Right — because ours is better. So let's get you started."**

**Why it works:** the prospect articulates the value difference themselves. Instead of you defending your price, they sell themselves on why the higher price is justified. Never argue about a competitor — make the prospect compare out loud.

## Pitching the contract

The contract is a make-or-break moment that should only happen if the **prospect** raises it. Ideally it isn't mentioned until payment is taken — because the moment it's offered "to read later", the deal drifts into email and often dies there. But refusing to share it looks like you're hiding something, which is just as fatal.

If they ask about the terms verbally, explain them verbally. If they explicitly ask you to email it:

*"Perfect, can you send it to my email? I'll read it later."*

> **"Sure, I'm happy to do that — and I've also got it right here [share screen]. In my experience, [NAME], it's a lot easier to walk you through it live in case you've got questions, so we don't end up playing email tennis. Can you see my screen?"**

Notice what's happening: you're giving them the contract (placating), providing an expert's reason why live is better, and **not asking permission** — you keep control of the close. Present it from your e-signature tool (not a Word doc dragged out of a drive folder) — it looks professional and builds trust.

Walking it through:

> **"This first section is basically legal jargon — it says we're entering an agreement with you and you with us, and these are the deliverables: X, Y and Z."**

Don't read every line or sit in silence while they study it. Move their attention to the one section that matters to them — your guarantee/terms:

> **"This section is the main thing we want to focus on — so feel free to stop me at any point if you have questions or want me to elaborate, okay?"**

Again — not asking permission, just keeping the door open for questions so they feel confident, while you keep the path to the close.

## Low-pressure closing lines

When the objection is handled and the energy is right, don't reach for a heavy close — reach for a warm one:

- **"Does that mean we can welcome you aboard?"**
- **"Does that mean — yes, [NAME], let's do this?"**
- **"So, shall we get you started?"**

## Sell through the close — and after it

Getting the yes is not the end of the call. In most situations you need to keep selling **through** the close and **after** it:

- New clients are still nervous. Don't oversell — encourage. Make them feel genuinely good about the decision they just made.
- The emotions they leave the call with are the emotions they'll sit with for the next several days. Leave them in confidence and excitement, not fear and buyer's panic.
- A rushed, cold end to the call is how you get a drop-out in the final minutes — or a refund request two days later.

And if the answer is finally, genuinely no: release well. *"Totally okay — sounds like the timing isn't right. I'll send over a couple of case studies and we can revisit when it makes sense."* Book the follow-up if it's real; let go if it isn't. The next call deserves you at full confidence.`,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const supabase = createClient(url, key);

  // 1. Add lessons to the hub JSON (idempotent).
  const raw = fs.readFileSync(HUB_PATH, "utf8");
  const hub = JSON.parse(raw) as {
    courses: Array<{
      id: string;
      sections: Array<{ id: string; lessons: Array<Record<string, unknown>> }>;
    }>;
  };
  const course = hub.courses.find((c) => c.id === COURSE_ID);
  if (!course) throw new Error(`course ${COURSE_ID} not found`);
  const section = course.sections.find((s) => s.id === SECTION_ID);
  if (!section) throw new Error(`section ${SECTION_ID} not found`);

  const existingIds = new Set(section.lessons.map((l) => l.id as string));
  let added = 0;
  for (const lesson of LESSONS) {
    if (existingIds.has(lesson.id)) continue;
    section.lessons.push({
      id: lesson.id,
      title: lesson.title,
      duration: "",
      hasVideo: false,
      academyUrl: "",
    });
    added++;
  }
  fs.writeFileSync(HUB_PATH, `${JSON.stringify(hub, null, 2)}\n`);
  console.log(`hub json: ${added} lessons added to ${SECTION_ID}`);

  // 2. Upsert lesson content rows.
  for (const lesson of LESSONS) {
    const { error } = await supabase.from("academy_lesson_content").upsert(
      {
        course_id: COURSE_ID,
        lesson_id: lesson.id,
        title: lesson.title,
        body_markdown: lesson.body,
        guide_markdown: lesson.guide,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,lesson_id" },
    );
    if (error) throw new Error(`upsert failed for ${lesson.id}: ${error.message}`);
    console.log(`content upserted: ${lesson.id}`);
  }
  console.log("done");
}

void main();
