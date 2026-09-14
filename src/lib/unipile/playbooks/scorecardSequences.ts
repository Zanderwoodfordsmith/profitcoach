import {
  emailStep,
  spaced,
  waitStep,
  type OutreachPlaybook,
} from "@/lib/unipile/playbookSteps";

const SIGN_OFF = `{{coach_name}}`;

const BOOK_LINE = `Book your {{review_name}}: {{boss_score_report_link}}`;

const EMAIL_1A = `Hi {{first_name}},

Your score is {{boss_score}}/100. That puts you at level 1: Overwhelmed.

If that landed heavy, I get it. Most owners in this range work flat out and still feel behind. Every day brings a new fire. There is no clear plan because there is no time to make one.

Your score is a starting point. Nothing more. Almost every owner I speak to has been in this range at some point. The ones who move out of it stop trying to fix everything at once.

Your top focus area right now is {{focus_area_1}}. Start there. Not because it is the loudest fire, but because fixing it gives you the breathing room to fix everything else.

Before you close this email, book a {{review_name}}. We look at your scorecard together and pick the one thing to fix this month. No selling, no pressure.

${BOOK_LINE}

${SIGN_OFF}

P.S. You can revisit your full scorecard any time here: {{boss_score_report_link}}`;

const EMAIL_1B = `Hi {{first_name}},

Your score is {{boss_score}}/100. That puts you at level 2: Overworked.

You are holding it together. The business runs. Clients get served. Bills get paid. You pay for all of it with your hours and your energy.

Most owners at this level have built something real. The thing they built relies on them being in it every day. Take the owner out for two weeks and the wheels come off.

You are closer to a real shift than you think. Your top focus area is {{focus_area_1}}. Fixing one area at a time is what moves you out of Overworked and into Organised.

Book a {{review_name}}. We look at your scorecard and decide your one priority for the next 90 days.

${BOOK_LINE}

${SIGN_OFF}`;

const EMAIL_1C = `Hi {{first_name}},

Your score is {{boss_score}}/100. That puts you at level 3: Organised.

You have a real business. Systems work. You have good people. You can take the odd weekend off without the place burning down.

The basic chaos is gone. The business still runs on you. You solve the hardest problems. You make the strategic calls. The business is good. It is not yet what you want it to be.

Your top focus area is {{focus_area_1}}. That is the next bottleneck to break.

Book a {{review_name}}. We look at your scorecard and figure out what holds you back from the next level.

${BOOK_LINE}

${SIGN_OFF}`;

const EMAIL_1D = `Hi {{first_name}},

Your score is {{boss_score}}/100. That puts you at level 4: Overseer.

You have built something most owners never reach. The business runs. You have a team that carries it. You spend more time on strategy than operations.

If you are reading this, you probably feel one of two things. You want to push to the final level where the business genuinely runs without you. Or you are asking what the business is for now that it works.

Your top focus area is {{focus_area_1}}. At this level, one weak area is often what stops the business from running fully without you.

I would like a {{review_name}}. Not to sell anything. Just to look at what you have built and what comes next.

${BOOK_LINE}

${SIGN_OFF}`;

const EMAIL_1E = `Hi {{first_name}},

Your score is {{boss_score}}/100. That puts you at level 5: Owner. The top range.

Most owners never get here. The business runs without you. The team is solid. The numbers work. You are the owner, not the operator.

You took this scorecard for a reason. Maybe the question of what comes next. Maybe a specific area you can feel is not as strong as the rest. Your top focus area is {{focus_area_1}}, which at this level is worth a closer look.

I would like a {{review_name}}. Not about fixing your business. About what you want to do next with it.

${BOOK_LINE}

${SIGN_OFF}`;

/** Started the scorecard, did not finish. Short nudges over 5 days. */
export const SCORECARD_INCOMPLETE_PLAYBOOK: OutreachPlaybook = {
  id: "scorecard-incomplete",
  name: "Scorecard · Started, not finished",
  channel: "email",
  description:
    "For people who started the BOSS Scorecard and left. Three nudges over 5 days.",
  northStar: "assessment_start",
  seedDefault: true,
  steps: spaced([
    emailStep(
      "{{first_name}}, you're part way through the BOSS Scorecard",
      "Three minutes from a score out of 100.",
      `Hi {{first_name}},

You started the BOSS Profit & Performance Scorecard.

It takes about three minutes. Your answers are saved, so you can pick up where you left off.

The useful bit is the number, and which area is actually capping the business.

Finish it here:
{{assessment_url}}

{{coach_name}}`
    ),
    waitStep(48),
    emailStep(
      "Three minutes to see what's capping the business",
      "Most owners start it. Fewer see the number.",
      `Hi {{first_name}},

Most owners start the scorecard, get interrupted, and never see the score.

The score is the useful bit. It names the expensive constraint, not the loudest one.

Three minutes:
{{assessment_url}}

{{coach_name}}`
    ),
    waitStep(72),
    emailStep(
      "Your scorecard is still waiting",
      "Last nudge. Your call.",
      `Hi {{first_name}},

Last note from me on this.

If you want the score and the focus areas, the link is here:
{{assessment_url}}

If not, no problem. It will be here when the timing is better.

{{coach_name}}`
    ),
  ]),
};

/** 11 emails over 22 days after they finish the scorecard. Email 1 branches on level. */
export const SCORECARD_COMPLETE_PLAYBOOK: OutreachPlaybook = {
  id: "scorecard-complete",
  name: "Scorecard · Completed (22 days)",
  channel: "email",
  description:
    "11 emails over 22 days after they finish. First email matches their BOSS level. Uses their score, focus areas and desired outcome.",
  northStar: "call_booked",
  seedDefault: true,
  steps: spaced([
    emailStep(
      "{{first_name}}, your BOSS Score is {{boss_score}}/100. Here is what it means.",
      "Your level, your top focus area, one next step.",
      EMAIL_1A
    ),
    waitStep(48),
    emailStep(
      "What got you here will not get you there",
      "A different move, not a louder version of the last one.",
      `Hi {{first_name}},

Most owners at the {{business_level_name}} level miss the same thing.

The move that gets you to this level is not the move that gets you out of it.

If you are Overwhelmed, you got here through hustle. More hustle will not move you up. If you are Overworked, you got here through grinding. More grinding will not move you up. If you are Organised, you got here through systems. Better systems will not move you up.

The pattern repeats at every level. You need a different move, not a louder version of the last one.

Your top three focus areas are:

- {{focus_area_1}}
- {{focus_area_2}}
- {{focus_area_3}}

One of those is your next move.

${SIGN_OFF}

P.S. If you want help picking which one to start with, that is what a {{review_name}} is for. ${BOOK_LINE}`
    ),
    waitStep(48),
    emailStep(
      "{{first_name}}, are you the bridge?",
      "Take you out. What stops first?",
      `Hi {{first_name}},

Quick thought experiment.

You disappear for a month tomorrow. No phone. No email. No calls.

What stops working first?

For most owners, the answer comes back quickly. Sales dry up. Or the work stops getting done to standard. Or the team grinds to a halt waiting for answers only you have.

That is what people call key man risk. You are the bridge. Take you out and the people on both sides fall in.

It shows up in four places in any business:

1. Marketing. You are the only one who can bring in leads.
2. Sales. You are the only one who can close.
3. Delivery. You are the only one who can do the work to the standard.
4. Operations. You are the glue. Without you, nothing holds.

Look at your scorecard. Your top focus area is {{focus_area_1}}. That is one of the places where you are most the bridge.

Here is the hard part. The better you get at your business, the more of a bridge you become. The more you know, the more people rely on you knowing it.

The fix is the same in every case. Someone else, or some system, needs to be able to do the thing.

If you want to map out how to stop being the bridge in your business, that is what a {{review_name}} is for.

${BOOK_LINE}

${SIGN_OFF}

P.S. The fastest test. Could you take two real weeks off, phone off, no email? If the answer is no, you are the bridge.`
    ),
    waitStep(24),
    emailStep(
      "The 5 levels of a business owner. Where are you?",
      "What life actually looks like at each level.",
      `Hi {{first_name}},

The scorecard placed you at one of 5 levels. Here is what life actually looks like at each one.

Level 1: Overwhelmed

You are buried. Every day is a fire. The to-do list grows faster than you can knock it down. You feel behind from the moment you open your eyes. The business is running you. There is no plan because there is no time to make one.

Most owners at this level work the longest hours and earn the least per hour. You are not lazy. You are stuck in firefighting.

Level 2: Overworked

The fires are smaller. You have built something that works. Clients pay. Bills get paid. The cost is you. Your hours, your weekends, your headspace.

You can see the business, but you cannot step out of it for more than a few days without things slipping. The business runs because you run.

Level 3: Organised

You have systems. Some of them work. You have hired people. Some of them are good. You can take the odd weekend off without the place burning down.

The chaos is gone. You are still the one solving the hardest problems. The strategic calls all come back to you. The business is good. It is not yet what you want it to be.

Level 4: Overseer

You have a real team. They carry the work. You spend most of your time on strategy. Profit is consistent. You know the numbers.

Two questions come up at this level. How do you push to the last level where the business runs without you at all? And the harder one: what is the business actually for, now that it works?

Level 5: Owner

The business works without you. The team is solid. The numbers work. You take real holidays. You come back and nothing has gone backwards. You spend your time on the things you choose.

This is what people mean when they say "owning a business" rather than "owning a job".

You scored {{boss_score}}/100. That puts you at level {{business_level_number}}: {{business_level_name}}.

The gap between any two levels is the same shape. It is not magic. It is a series of specific moves over time. The owners who close the gap have a clear next priority and someone holding them to it.

If you want to look at the moves that close your gap, that is what a {{review_name}} is for.

${BOOK_LINE}

${SIGN_OFF}

P.S. Most owners do not move levels by accident. They move by decision.`
    ),
    waitStep(48),
    emailStep(
      "It has been a week. Honest check.",
      "The guilt does not show up on the scorecard.",
      `Hi {{first_name}},

A week ago you took the scorecard.

Quick gut check.

Last weekend, were you with your family but checking your phone? Or working but feeling like you should have been with them?

That guilt does not show up on the scorecard. It shows up in your life.

It is the price you pay for where the business is right now.

The scorecard told you where you stand. The question this week is what you want to do about it.

If you want to make a move, the simplest one is a {{review_name}}. 30 minutes. We look at your numbers and pick the one thing to fix next.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(48),
    emailStep(
      "Want the playbook for {{focus_area_1}}?",
      "Reply SEND and I will email it across.",
      `Hi {{first_name}},

Your top focus area on the scorecard came back as {{focus_area_1}}.

I have a short playbook for that area. It walks through the three moves I see work most often. No fluff, no upsell, just the playbook.

Reply with the word SEND and I will email it across.

If you want to go further than a playbook and actually map out what to do in your business, a {{review_name}} will do that better than any document.

${BOOK_LINE}

${SIGN_OFF}

P.S. If a different area is more on your mind right now, just tell me which one. I have playbooks for all 10.`
    ),
    waitStep(72),
    emailStep(
      "An owner who was where you are now",
      "One priority. A weekly rhythm. Three things off the plate.",
      `Hi {{first_name}},

A colleague of mine uses the same system I use. She told me about an owner she worked with who scored almost exactly where you scored.

The business was a similar size to yours. Revenue was healthy on paper. From the outside, the business looked like it worked.

Inside the business, the owner was the bridge. Every decision came back to her. Every fire needed her to put it out. She worked 60-hour weeks and still felt behind. Her top focus area was one of the harder ones to crack on her own.

They did three things together. None of them were complicated.

First, they picked one priority for the next 90 days. One. Not five.

Second, they built a simple weekly rhythm around that priority. The same five questions she asked herself every Monday morning.

Third, they removed the three things that ate her time but did not move the business.

90 days later her score moved up a full level. She worked less. Her team made more decisions. She had room to think.

The work was not glamorous. It rarely is.

If you want a version of this for your business, book a {{review_name}}. We look at your scorecard, pick the one priority, and you leave with a plan for your next 90 days.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(48),
    emailStep(
      '"I\'ll do it when things calm down"',
      "They do not calm down.",
      `Hi {{first_name}},

One of the most common reasons owners give for not booking a call:

"I'll do it when things calm down."

Let me save you some time on that one. They do not calm down.

I have never met an owner who said this is the easy season. Not one. The shape of busy changes. The volume rarely does.

Here is the part most people miss. If you can fix something in your business during a busy season, the easy season looks after itself. The reverse is not true. Solving it when things are quiet does not prepare you for when they are loud.

The other thing. These problems do not stay where they are. They compound. Whatever is broken in your business this month is a bit worse next month if you do not move on it.

Think of it like a sore foot. "When should I see the doctor?" "When it stops being sore." That logic does not work. The longer you wait, the harder it is to walk.

You scored {{boss_score}}/100. Your top focus area is {{focus_area_1}}. That gets harder, not easier, the longer you leave it.

30 minutes. {{review_name}}. Worst case, you walk away with one move you can make in the next 30 days.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(48),
    emailStep(
      "{{first_name}}, where will you be in 12 months?",
      "Fixable does not mean it fixes itself.",
      `Hi {{first_name}},

A score of {{boss_score}}/100 is fine. It is also fixable. Fixable does not mean it fixes itself.

Most owners who take the scorecard close it, read the result, and carry on doing what they were already doing. A year later they take it again and the score is the same. Sometimes lower.

Here is the cost of that year. 12 months of weeks that look the same. 12 months of the same fires. 12 months where the business does not give you more of what you wanted from it.

You told us you want {{desired_outcome}}. Standing still moves you further from that, not closer.

The owners who move are the ones who decide to do something different. Usually that decision happens after a conversation.

If you want next year to look different, book a {{review_name}}. Even if you decide not to work with me, you walk away with a clear next move.

${BOOK_LINE}

${SIGN_OFF}`
    ),
    waitStep(72),
    emailStep(
      "A business that works for you, not because of you",
      "Owning a business vs owning a job that pays well.",
      `Hi {{first_name}},

There is a difference between owning a business and owning a job that pays well.

The owner of a job:

- Cannot take two real weeks off without something breaking
- Knows the business loses money if they get sick
- Is the only person who can solve the hardest problems
- Spends most of the week reacting

The owner of a business:

- Takes real holidays and the business runs
- Has a team that decides without them
- Spends most of the week thinking, not reacting
- Knows the numbers without having to ask anyone

You took the scorecard because something in your business is closer to the first list than the second. You scored {{boss_score}}/100. The gap is real. It is also fixable.

Three things make the difference for owners who close it:

1. They pick one focus area at a time. Not three. Not five. One.
2. They build a weekly rhythm that keeps that focus in front of them.
3. They get a second pair of eyes on the business so they stop being the only one seeing it.

That third one is the hardest to do on your own. It is also the one that compounds the fastest.

You can start the first two this week. The third is what a {{review_name}} gives you.

${BOOK_LINE}

${SIGN_OFF}

P.S. You can build an asset, or you can build a comfortable prison. Both look the same from the outside. They feel very different from the inside.`
    ),
    waitStep(72),
    emailStep(
      "Last note, {{first_name}}",
      "The scorecard is yours either way.",
      `Hi {{first_name}},

This is the last email I will send about your scorecard.

You took it for a reason. Something in your business is not working the way you want. The score told you where you stand. The question is what you do with that.

One offer. A {{review_name}}. We look at your scorecard, name the one move that matters most, and you leave with a clear next step.

If that sounds useful: ${BOOK_LINE}

If not, no problem. The scorecard is yours to use whenever it helps.

${SIGN_OFF}

P.S. If you replied to the playbook email and never heard back, hit reply to this one and I will sort it.`
    ),
  ]),
};

// Attach level-branched variants to email 1 (first message step).
const completeSteps = SCORECARD_COMPLETE_PLAYBOOK.steps;
const firstMessage = completeSteps.find((s) => s.step_type === "message");
if (firstMessage) {
  firstMessage.variants = [
    { key: "1", label: "Level 1 · Overwhelmed", body: firstMessage.body || EMAIL_1A },
    {
      key: "2",
      label: "Level 2 · Overworked",
      body: `Subject: {{first_name}}, your BOSS Score is {{boss_score}}/100. Here is what it means.\nPreview: Your level, your top focus area, one next step.\n\n${EMAIL_1B}`,
    },
    {
      key: "3",
      label: "Level 3 · Organised",
      body: `Subject: {{first_name}}, your BOSS Score is {{boss_score}}/100. Here is what it means.\nPreview: Your level, your top focus area, one next step.\n\n${EMAIL_1C}`,
    },
    {
      key: "4",
      label: "Level 4 · Overseer",
      body: `Subject: {{first_name}}, your BOSS Score is {{boss_score}}/100. Here is what it means.\nPreview: Your level, your top focus area, one next step.\n\n${EMAIL_1D}`,
    },
    {
      key: "5",
      label: "Level 5 · Owner",
      body: `Subject: {{first_name}}, your BOSS Score is {{boss_score}}/100. That is the top range.\nPreview: Your level, your top focus area, one next step.\n\n${EMAIL_1E}`,
    },
  ];
  // Variant 1 body should include subject/preview like the others.
  firstMessage.variants[0].body = firstMessage.body || EMAIL_1A;
}
