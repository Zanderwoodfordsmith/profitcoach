/**
 * The Profit Roadmap call (call 2), step by step, for a coach selling to an
 * owner. Discovery follows Pam's Discovery Call script, building on the BOSS
 * Score Review (her value session now runs as the review). The rest
 * follows BCA's ClickUp call script (doc 2cq3b-23195: Transition & Pitch,
 * Committing / Temp Check, Investment, Taking Payment, Book A Next Steps),
 * reworded for an owner. The read-back and the pitch are also written live
 * from the coach's notes. Placeholders: {name} {result} {price_line}.
 */

import { AREAS } from "@/lib/bossData";

import { type Block, go, h, info, live, note, points, r, say, they } from "./blocks";

export type FactKey = "priority" | "pain" | "result" | "number" | "why";

/** The nine Profit System steps, in pitch order, from the live model so they never drift. */
export const STEP_NAMES = AREAS.filter((a) => a.pillar !== "foundation")
  .sort((a, b) => a.id - b.id)
  .map((a) => a.name);

/**
 * Two ways to pitch, both written from the same five facts. Steps shows what
 * we fix (Pam's workshop). Phases shows what happens when (the BCA Trusted
 * Advisor pitch, turned round for an owner). On a follow-up call, use the other.
 */
export type PitchKind = "steps" | "phases";

export const PITCH_KINDS: { id: PitchKind; title: string; line: string; when: string }[] = [
  { id: "steps", title: "Nine steps", line: "What you'll fix for them, one step at a time.", when: "Best when they have one clear, urgent problem." },
  { id: "phases", title: "Three phases", line: "What happens after they say yes, and their part in it.", when: "Best when they're cautious or have been burned before." },
];

/**
 * The standard pitches the coach sees before pressing Personalise. The nine
 * steps are Pam's generic pitch from her workshop ("Turning the Profit System
 * Into a No-Brainer Pitch", Oct 2026), word for word apart from: new step
 * names, "we" for "we would", her bullet lists as sentences, Step 8 adding
 * systems, and her [TAILORED ...] lines left to Personalise.
 * Fill-ins ({name}, {problem}, {result}) come from the call details.
 */
export const STEPS_INTRO =
  "Perfect. So what I'd like to show you now is exactly how we would use the Profit System to help you achieve that. There are three pillars, Vision, Velocity and Value, and within those is our nine-step roadmap. What I want to do, rather than just give you a generic overview, is show you how every part specifically helps you solve {problem} and achieve {result}. Sound good?";

export const STANDARD_STEPS = [
  "The first thing we do is establish exactly where you are now and what's really causing {problem}, because the obvious problem isn't always the real problem. We identify what's working, what isn't, where the biggest blockage sits, and which issue will make the greatest difference when you fix it. That means you're not guessing or jumping into random solutions. You know exactly what needs fixing first to get you to {result}.",
  "Once we've established where you are, we get really clear on where you're going. We build the longer-term strategy around getting you to {result}. Instead of continuing to react to whatever lands on your desk, we're designing the business you need for the future you want.",
  "Then we turn that strategy into action. We create your 90-day plan, with the priorities built around {problem}. We set what needs doing, who's responsible, when it's happening and what success looks like. So you don't leave with another list of good ideas. You know exactly what needs to happen over the next 90 days.",
  "Whatever your main challenge is, solving it needs to create a healthier, more profitable business. So we look at how {problem} is affecting your profit, margin, cash, costs, capacity and lost opportunity. We then make sure the changes we're introducing improve the financial performance of the business, because there's very little point fixing it if you don't have more profit and cash to show for the effort.",
  "We look at the right customers, revenue opportunities, sales activity, marketing, conversion, repeat business and any other revenue drivers relevant to your situation. The aim is to make sure the business has the revenue engine needed to get you to {result}.",
  "This is about making sure the business can actually deliver what it sells, efficiently, consistently and profitably. That could mean improving processes, handovers, customer delivery, capacity, workflow, quality or how the service or product is structured. The purpose is to make your results sustainable, rather than creating another problem somewhere else in the business.",
  "We identify the critical drivers behind {result}. Rather than managing on gut feel, you know exactly which numbers tell you: are we improving, where are we slipping, what's working, and where should I focus next? That gives you control and visibility over the problem you've told me you want solved.",
  "We don't just fix the problem once. We put management processes and systems in place so the business continues to improve, and we automate what we can. We look at what needs to be reviewed, improved, delegated or managed differently, so the problem doesn't simply come back six months later. That creates a stronger business that keeps moving forward.",
  "Ultimately, getting to {result} can't depend entirely on you. You need the right people taking responsibility for the right things. We create clarity around responsibility, accountability, decision-making, leadership and performance. So the team helps get you there, rather than everything continuing to land back on your desk.",
];

/**
 * The read-back before the AI has written one from the notes, so the coach
 * always has something to say. Same shape as the written one; the fill-ins
 * come from the call details. "Have I understood that correctly?" follows in
 * the script.
 */
export const READ_BACK =
  "Okay {name}, based on everything you've shared, the main thing you want to achieve is {result}. At the moment, {problem} is getting in the way, and you've said it's costing you {pain}. And for you personally, that would mean {why}.";

/** Pam's "Bringing it together", with her outcome line for an angle when there is one. Her closing question opens After the pitch, so it is asked once. */
export function togetherLine(outcome = ""): string {
  return `So, {name}, if you look at the whole roadmap, we're not treating {problem} as one isolated issue. We're making sure the entire business supports the result you want. We get clear on where you're going. We create the plan. We improve the commercial engine. We make sure the operation can support it. We put the numbers in place. We strengthen management and systems. And we develop the team and leadership needed to make it last. ${outcome ? `${outcome} ` : ""}That's how we get you to {result}.`;
}

export const STANDARD_TOGETHER = togetherLine();

/** The three phases, in order. The words come from phasedPitch. */
export const PITCH_PHASES = [
  { name: "Get clear", when: "The first month" },
  { name: "Fix what matters", when: "Months two and three" },
  { name: "Make it last", when: "From month four" },
];

/**
 * What one ready-made three-phase pitch says that another doesn't. The rest
 * is shared, so every angle keeps the same shape and length.
 */
export type PhasedAngle = {
  /** Bridge: what the problem looks like day to day, or "" for the standard pitch. */
  looksLike: string;
  /** Phase 1: what the scores find. */
  find: string;
  /** Phase 2: where the quick wins usually are. */
  quickWins: string;
  /** Phase 2: what the weekly scoreboard tracks. */
  scoreboard: string;
  /** Phase 2: what changes, after "So for you, that means". */
  change: string;
  /** Phase 2's check-in. */
  check: string;
  /** Phase 3's last point: what keeps this fix in place. */
  keep: string;
  /** Recap: what Phase 3 leaves them with. */
  lasts: string;
};

/**
 * The three-phase pitch, in the shape and near the length of the BCA Trusted
 * Advisor pitch (bridge, three phases with what we do and what it means,
 * support, recap), turned round for a coach talking to an owner. Points are
 * lines starting "• " so they read as a list. Fill-ins: {name} {problem}
 * {pain} {result} {why}.
 */
export function phasedPitch(a: PhasedAngle): { bridge: string; phases: { text: string; check: string }[]; recap: string } {
  return {
    bridge: [
      `So, {name}, you know how you said {problem} is what's holding the business back?${a.looksLike ? ` ${a.looksLike}` : ""} And it's costing you {pain}.`,
      "So here's what we're going to do.",
      "We bring the Profit System into your business, and I work alongside you as your trusted advisor. Someone in your corner every month, who helps you see clearly, make better decisions and follow through on them.",
      "And the part that matters most is this. We do the thinking, the planning and the follow-up together, so it leaves just three things for you to do:",
      "1. Turn up and be honest about what's really going on.\n2. Make the decisions.\n3. Do what we agree, or get it done through your team.",
      "My job is to make sure you always know the next move, and that it happens.",
      "That's what takes you from where you are today to {result}. And there are three phases to it. We get clear, we fix what matters, then we make it last.",
      "Let me take you through each one.",
    ].join("\n\n"),
    phases: [
      {
        text: [
          "So as you'll know, when you're running a business it's hard to step back and see what's really going on. You're busy keeping everything moving, and everyone has a view on what's wrong. That's nobody's fault, it's just what happens when you're in it every day. But it means the real problem can stay hidden, and a year later it's still there.",
          "So Phase 1 is where we get clear. That's the first month, and we meet every week.",
          [
            `• First, we score the business across all nine areas of the Profit System, so you see in one picture what's strong and what's weak. And we find ${a.find}, because the obvious problem isn't always the real one.`,
            "• From there, we agree where the business is going. Where you want it in three years, and what has to be true for you to get to {result}.",
            "• And finally, we build your 90-day plan. The few things that matter most, who does each one, by when, and how we'll know it's working.",
          ].join("\n"),
          "And we don't wait for the plan to start. We start on {problem} from the first or second session, so you feel a difference straight away.",
          "And just to stress, we build all of this together, around your business and your numbers. Nothing comes off the shelf.",
          "So what that means for you is that by the end of the first month you stop guessing. You know what's really going on, you've got your plan, and you're already working on {problem}.",
        ].join("\n\n"),
        check: "Does that make sense so far?",
      },
      {
        text: [
          "So now you've got the plan. You know what's really going on and what comes first, so we move on to the next phase.",
          "Phase 2 is where we fix what matters. That's months two and three.",
          "You know how you said {problem} is the first thing you want fixed? By now you've already made a start on it. Phase 2 is where we finish the job, and make sure it stays fixed.",
          [
            "• We get to what's really causing {problem}, and you and your team fix it at the root, so it doesn't come back.",
            `• We keep the quick wins coming, ${a.quickWins}.`,
            `• We set up a weekly scoreboard. ${a.scoreboard}, which your team fills in and you can read in under a minute, so you know straight away if things are on track.`,
            "• And every session asks the same three questions. What got done, what's stuck, and what's next. Every job has an owner and a date, so nothing drifts.",
          ].join("\n"),
          "And the reason it works is simple. We do a few things properly, in the right order, and I make sure they happen. That's the difference between this and another list of good ideas.",
          "And you're not doing it on your own. Each week we look at the scoreboard together, and if something's stuck, we work out why and what to do next, before it costs you.",
          "Your part in this phase is to make the decisions, and do what we agree or get your team to. And to give you an idea of your time, it's our sessions plus the work you'd be doing anyway. Just now it's the right work.",
          `So for you, that means ${a.change}.`,
        ].join("\n\n"),
        check: a.check,
      },
      {
        text: [
          "So by now things are moving. The plan's working, and the numbers are heading the right way.",
          "The next phase is about making it last, so the business keeps getting better without everything depending on you.",
          "You know how you said you want {result}? And that for you, it really comes down to {why}? Phase 3 is where we make that stick. From month four, we meet twice a month.",
          [
            "• Every 90 days we score the business again, see what's moved, and set the next 90-day plan. So you're always working on what matters most right now.",
            "• We put the right numbers in front of you, so you can see how the business is doing at a glance.",
            "• We work out the systems the business needs, and your team puts them in, so the work gets done the same way every time.",
            `• ${a.keep}`,
          ].join("\n"),
          "And as the business changes, the plan changes with it. A key person leaves, a big customer lands, a bad month. We deal with it in the session, so it doesn't knock you off course.",
          "And the biggest shift from where you are now is that the business stops needing you for everything. You lead it, and your team runs it. I'm there as your trusted advisor, to help you make better decisions and make sure they happen. That's what gets the result, and it's why this takes a few hours a month of your time, not more of your week.",
          "So with all three phases in place, you get to {result}, and it lasts.",
        ].join("\n\n"),
        check: "Does all of that make sense?",
      },
    ],
    recap: [
      "So, to recap.",
      [
        "Phase 1, we get clear and start on {problem} straight away. We find what's really going on, agree where the business is going, and build your 90-day plan.",
        "Phase 2, we fix what matters. We finish the job on {problem} and make sure it stays fixed, with the scoreboard and our sessions keeping it moving.",
        `Phase 3, we make it last, with a new plan every 90 days and ${a.lasts}.`,
      ].join("\n"),
      "And I'm with you the whole way through.",
      "The only parts on you are being honest, making the decisions, and doing what we agree. My job is to make sure you always know the next move, and that it happens.",
      "So that's how we get you from {problem} to {result}, so you don't have to deal with {pain} again.",
    ].join("\n\n"),
  };
}

export const STANDARD_PHASED = phasedPitch({
  looksLike: "",
  find: "what's really behind {problem}",
  quickWins: "often in profit and cash, because more money in the bank gives you room to fix everything else",
  scoreboard: "A handful of numbers",
  change: "{problem} stops being something you live with, and becomes something you're fixing week by week",
  check: "Can you see how that would work for you?",
  keep: "And we get the right people owning the right things, so decisions stop landing on your desk.",
  lasts: "a business that doesn't depend on you for everything",
});

/** Optional, after the bridge, when they want to know who they'd be working with. The gaps are the coach's own. */
export const PHASED_ABOUT =
  "And so you know who you'd be working with, here's a bit about me. [your background in a line or two]. [a result you got for an owner like them].";

/** After Phase 3, before the recap. Same for every angle. */
export const PHASED_SUPPORT =
  "And from day one, you're not on your own. If something comes up between sessions, you message me and we talk it through. And your scores, your plan and your scoreboard are always there, so you can see exactly where things stand.\n\nSo you've always got someone by your side while the business grows.";

export const FACTS: { key: FactKey; label: string; ask: string }[] = [
  {
    key: "priority",
    label: "Their priority",
    ask: "What's the biggest challenge or opportunity right now that's stopping the business being where you want it?",
  },
  {
    key: "pain",
    label: "What it's costing them",
    ask: "And what's that costing you at the moment, in money, time or how you feel?",
  },
  {
    key: "result",
    label: "The result they want",
    ask: "If we were having this conversation 12 months from now, what would need to have changed for you to be genuinely happy?",
  },
  {
    key: "number",
    label: "Their numbers",
    ask: "Is there a number on that? Revenue, profit, hours a week, team size?",
  },
  {
    key: "why",
    label: "Why it matters to them",
    ask: "Why does solving this matter to you personally, beyond the numbers?",
  },
];

export type PhaseId = "discovery" | "pitch" | "investment" | "objections" | "closes" | "next";

export type Phase = {
  id: PhaseId;
  title: string;
  /** One line under the title: what this part of the call does. */
  goal: string;
  blocks: Block[];
};

/**
 * Discovery on the Profit Roadmap call (call 2). Pam's BCA Discovery Call
 * script (Oct 2026), turned round for a coach and an owner: where hers builds
 * on the setter's notes, this builds on the BOSS Score Review. The action
 * check and the admission question come from the review doc (20 Oct).
 */
const discovery: Block[] = [
  info(
    "How this call works",
    "This is the second call. The review gave them value. This call goes deeper, then shows them how you'd help and what it costs, and they decide.",
    "Your job in this part is to get the five facts in their words, building on your notes from the review. Listen more than you talk. The notes panel shows what's still missing.",
    "If you're running the review and this call back to back, skip the rapport and the action check, and start at Current situation.",
  ),
  h("Intro"),
  say("Hey {name}, good to have you back. How've you been since the review?"),
  say("So I've got my notes from the review. You're looking to [their goal], and [their constraint] is what's holding the business back most. Is that still right?"),
  r(
    "blue",
    "You gave them something to do, and they've had time to do it",
    say("And how did you get on with [the action from the review]?"),
    r("green", "They did it", say("Great. What did you notice?"), note("Build on the win.")),
    r("yellow", "They didn't", say("That's normal. Most owners don't act on standalone advice, even good advice. That's exactly what I'm there for.")),
  ),
  note("Skip the action if the review was yesterday, or back to back with this call."),
  h("Agenda"),
  say("So for today, I just want to start by asking you some questions about you and where you want the business to go. Then if it sounds like I can help, I'll show you how I'd get {business} there, over the next few years and not just the next few months, how the work runs and what it costs, and we take it from there. Sound good?"),
  say("And just before we get into it, aside from the review, what were you hoping to get out of today? Just so I make sure we cover what's relevant to you."),
  h("Current situation"),
  note("You already know this from the review: how the business runs, their week and their numbers. Don't ask it again. Check what's changed, and only ask what your notes don't have."),
  say("Has anything changed since we spoke?"),
  r(
    "blue",
    "Your notes are thin on it",
    say("Just to give me some context, talk me through a normal week for you in the business at the moment."),
    say("How long have you been running it? And what took you into it in the first place?"),
  ),
  h("Goal and current position"),
  note("Gets you: the result they want, and their numbers."),
  say("So what's the goal? Where do you want the business to be in 12 months?"),
  say("Is there a number on that? Turnover, profit, hours a week?"),
  say("And where is it now?"),
  say("And looking further ahead, say three to five years, where do you want it to be? Bigger, easier to run, ready to sell, or something else?"),
  say("And where are you in that picture? Still running it day to day, stepping back, or out of it altogether?"),
  note("The long-term goal is what the plan builds towards. The 12 months is the first stretch of it."),
  h("Problem isolation"),
  note("Gets you: their priority."),
  say("So how's it going in the business at the moment?"),
  say("What would you say is the biggest thing stopping you getting to {result} right now, if anything?"),
  r(
    "blue",
    "They're not sure what's holding them back",
    say("In your BOSS Score, [your lowest area] came out lowest. When you look at that, does it feel like the real problem, or a sign of something else?"),
  ),
  r(
    "blue",
    "What they say doesn't match their score",
    say("That's interesting. Your score had [the area] lower than [what they just said]. Why do you think that is?"),
  ),
  r(
    "blue",
    "They name something big and vague, like growth",
    say("You came out at level [their level], [the level name]. What do you think it would take to get to the next level?"),
  ),
  note("Vague? Use the problem audit at the bottom of this page."),
  h("Dig deeper"),
  note("Keep going until you hear the real problem, not the first answer. Use as many of these as you need."),
  say("Tell me more about that."),
  say("What does that look like day to day? Give me a recent example."),
  say("Why do you think that keeps happening?"),
  say("And why's that?"),
  say("If you had to put a number on what it costs you in a year, what would it be?"),
  say("And how long has this been an issue for?"),
  say("And besides speaking to me today, what are you actively doing to move towards this right now? How's that working out for you?"),
  h("Summarise the problem and pain"),
  note("Gets you: what it's costing them."),
  say("Got it. So it sounds like the biggest thing here is {problem}, and that's costing you {pain}. Would you agree with me on that?"),
  h("Impact"),
  say("And how's that been for you over the last [months or years]?"),
  say("And if nothing changes, what does it cost you over the next 12 months? In money, in time, in the work you have to turn down?"),
  say("And what kind of effect has that had at home?"),
  note("Only if they've brought home or family into it themselves."),
  h("What they've tried"),
  say("Have you done anything before now to try and fix this? An accountant, a consultant, a coach, a course, anything like that?"),
  r("blue", "Yes", say("How did that go? What worked, what didn't?")),
  r("blue", "No", say("What's stopped you getting help with it before now?")),
  say("Can I ask you an honest question? What do you think has kept you from fixing this on your own?"),
  info(
    "The admission",
    "Listen for one of three answers: they can't do it alone, they want it faster, or they want a way that's proven. Each one is a reason to work with you, in their words.",
    "If they say they could do it themselves: \"Then you may not need me. What would stop you starting tomorrow?\"",
  ),
  h("Reason and trigger point"),
  r("blue", "They've never had help", say("So given you've never worked with anyone on this before, what's prompted you to look at getting help with it now?")),
  r(
    "blue",
    "They tried before and it didn't work",
    say("So given you tried [what they tried] before and it didn't quite work out, what made you feel this time might be different?"),
    say("And what's prompted you to look at getting help with it now?"),
  ),
  h("Ideal criteria"),
  say("So in terms of potentially working with someone to help you with this, what are you ideally looking for? Just to see if we're on the same page."),
  note("A partner or co-owner comes up? Use the partner questions at the bottom of this page."),
  h("Desired situation"),
  note("Gets you: their personal why."),
  say("Okay. So let's imagine for a second you've got all of that. You're at {result}, and {problem} is sorted. What does that allow you to do that you can't do now?"),
  say("And once you're there, is that you sorted, or is that just the start?"),
  say("And what would that mean for you personally?"),
  say("And how would that feel, finally having [what they just said]?"),
  h("Consequence and commitment"),
  say("And with things as they are right now, how close do you honestly feel you are to getting to {result}?"),
  say("And how much longer do you want to stay where you are?"),
  say("And for you, what does it look like moving forward if you keep things the way they are? [The thing they're most afraid of, in their words: another year of the same, the same conversation next year.]"),
  say("So is now the time to do something about this?"),
  h("Pinpoint specifics"),
  say("Okay, so just to really nail this. If we had to dial it right down, what specifically do you feel you need help with to get you to {result}?"),
  h("Read it back"),
  live("readback"),
  say("Have I understood that correctly?"),
  note("Pause. Let them correct you. They must agree with the diagnosis before you show the plan."),
  h("Transition to the pitch"),
  say("Got it. I think that's me done on the questions. I've got a solid understanding of you, where the business is now, and more importantly where you want it to go. And from what you've told me, I'm very confident I can help you with this. So with your permission, I'd like to walk you through exactly how I'd do that, my process for getting you from where you are now to where you want to be. How does that sound?"),
  h("If they're vague: problem audit"),
  note("Only if they're vague or just want information."),
  say("Okay, got it. Usually the owners I speak to know the business could be doing better, but they're not sure exactly what's holding it back, or what to fix first."),
  say("But it sounds like things are going fairly well for you. So is there anything you'd change, if you could?"),
  say("Why would you change that? And why is that important to you now?"),
  note("If still nothing clear:"),
  say("Do you mind if I ask you something, and this might seem direct? From what you've said, things seem to be going fine. But the fact you took time out of a full week for a second call tells me there has to be something missing, something you want that you haven't got yet. So what's really going on?"),
  note("Then back to the main script."),
  h("If a partner comes up"),
  note("Only if a partner or co-owner has come up."),
  say("You mentioned [person]. What part do they play in a decision like this?"),
  say("What would they need to see to be comfortable with it?"),
  note("Then back to the main script."),
];

const transition: Block[] = [
  h("Transition"),
  info("Take command", "Don't be approval-seeking here. Be definite and take command. Bring more energy."),
  say("Thank you for sharing that. I'm excited to dive into this, because you're exactly the kind of owner I help, {name}."),
  say("I can only imagine how it feels to keep dealing with [two of their pains, in their words], when you could be in a position where [two of their goals, in their words]. And those goals are very achievable."),
  say("But there are a few things in the way that need sorting if you're going to get there. I can help you fix all of them. So, as you can probably tell, I'm pretty excited to show you how. Are you happy for me to share my screen?"),
  h("Walk them through it"),
  info(
    "Two ways to pitch",
    "Nine steps shows what you'll fix, step by step. Use it when they have one clear, urgent problem and want to know how you'd solve it.",
    "Three phases shows what happens after they say yes, and what's left for them to do. Use it when they're cautious, have been burned before, or keep asking how it works.",
    "On a follow-up call, use the one you didn't use last time, so you're not repeating yourself.",
  ),
  live("pitch"),
];

const afterPitch: Block[] = [
  h("After the pitch"),
  say("How do you feel about the structure and approach specifically?"),
  info(
    "Purpose",
    "After the pitch, the only thing you want them focused on is the process. That way you know you're not jumping to the investment too early, which makes any objections worse.",
    "You're not in objection handling yet. Objections rarely come up until they've heard the investment. Here they're just looking for clarity, so don't mistake questions for objections. After every answer, confidence loop and ask a clarifying question.",
  ),
  r("green", "They're bought in", say("Okay, and what about the process and the structure specifically makes you say that?")),
  r("yellow", "They like one thing, not sold yet", say("Besides [that], what else about the process and the structure gives you confidence this would work?")),
  they("\"Oh I like [this], I think that could be helpful.\""),
  say("Okay, and what about [that] specifically stands out to you?"),
  note("Confidence loop when you answer questions."),
  say("Got it. And besides [that], what else about the process and the structure makes you feel this would work for you?"),
  say("Okay, and what questions do you have for me about the process and the structure specifically, that you might not have asked already?"),
  note("Paraphrase and loop until they have no more questions."),
  r("blue", "They ask how much", say("More than happy to go through the investment with you in a moment. I just want to focus on the process first, because that's the most important thing. So what questions do you have about the process itself?")),
  r("blue", "An unclear question (e.g. \"how does coaching work?\")", say("Okay, and in terms of the coaching, what specifically do you need more clarity on?"), note("So you answer what's relevant to them, not everything.")),
  r("blue", "A clear question (e.g. \"how long does it take?\")", note("Answer it, then ask one of these:"), points("Does that give you a little more confidence?", "Does that give you a little more clarity?")),
  r(
    "orange",
    "Pushback, or they're not being open",
    note("Answer concisely and link it back to what they want."),
    say("I may be wrong here, but you don't seem too sure. Honestly, I'm more than happy to explain this in more detail, because you clearly understanding how we get you to {result} is the most important thing to me. Especially after you explained why it matters to you. So how can I give you more clarity on this?"),
  ),
  r("green", "Good tonality, not confused", note("Move on to the temperature check.")),
  say("Any other questions?"),
  info(
    "When to move on",
    "Once they've asked what they need to, move to the temperature check. It's another way to surface concerns before the investment.",
    "You don't always need every question. You'll know from how they respond: closed off or open, excited or sceptical. When you feel confident they feel confident, move on. They don't need to be 100% bought in, you just want to have moved the needle.",
  ),
];

const temp: Block[] = [
  info(
    "Why the temperature check matters",
    "The temperature check tells you how bought into the process they are. Not how sold they are overall, but how much they believe in the approach for the problems they told you about. They need to be a solid 9, or ideally a 10, before you go to the investment. This is a must.",
    "It can feel uncomfortable not to push ahead, but the more you handle here, the easier it is later. Listen closely to their tone and whether it matches their words. Some people will say whatever they need to to placate you. Don't buy into it. If you know you can help, level with them.",
    "Don't get caught up in the exact words. Be ruthless about the outcome: raise their certainty to meet yours.",
  ),
  say("Okay {name}, I've got a quick question for you, just so I'm clear on where you are with the process itself. On a scale of 1 to 10:"),
  points("10 being 'this has surpassed my expectations, I love it'", "1 being 'actually, I don't think this is the right thing for me'"),
  say("Where would you say you land on the process and the structure specifically?"),
  r("green", "Convincing 10", say("Okay, and what makes you say a 10 instead of a 1 or a 2?")),
  r(
    "green",
    "Convincing 9",
    say("Nine, okay, beautiful. Anything stopping you from being a solid 10 out of 10?"),
    note("If they give a strong reason, answer it, then:"),
    say("Does that bump you up to a 9.5?"),
  ),
  r(
    "orange",
    "Honest 8 or less",
    say("Okay, and what about the process makes you say an 8 instead of a solid 9 or 10?"),
    say("Or: What makes you say an 8? Do you feel there's something missing right now?"),
    note("Find the core hesitation before you move on. If they don't reveal it, keep looping into it."),
    r(
      "blue",
      "\"I can't be a 9 or 10 without knowing the price\"",
      say("Okay, got it, completely appreciate that, and I'm more than happy to go through the investment in a moment. I'm just trying to understand where you are with the process itself, because that's what gets you to {result}, right? So just on the process, where would you land?"),
    ),
    r("blue", "\"There's still a lot I don't know\"", say("Okay, I completely understand. What specifically do you feel is missing that makes you an 8 at the moment?")),
    r(
      "blue",
      "\"I can't say without actually doing it\"",
      say("Yeah, fair enough. Besides that, do you feel this covers everything you need to get to {result}, or are there any gaps that might worry you?"),
    ),
    say("Okay, so is there anything missing that's stopping you being a 9?"),
  ),
  r(
    "red",
    "Unconvincing score",
    say("Really? I could be wrong here, but you sound more like a 5 out of 10, which is fine by the way if that's the case. I've done enough of these calls to know when someone's really excited about this. So, so I can genuinely be of best service to you, do you mind being honest with me, one person to another? Where's the hesitation coming from?"),
    note("Don't be afraid to challenge them. If they say 7 but sound like a 5, call it out. It's in their interest that you're both honest."),
  ),
  note("Sometimes you won't get them to a 9 or 10. Take them as far as you can without annoying them, then go to the investment."),
];

const investment: Block[] = [
  h("Temperature check"),
  ...temp,
  h("The investment"),
  say("Okay {name}, any final questions before we talk about the investment?"),
  note("If they have questions, answer them and confidence loop."),
  say("{price_line}"),
  say("For that, you're getting [what working with you includes, in two or three lines]."),
  note("Then stop talking. Stay quiet for five to seven seconds."),
  info(
    "Why five to seven seconds",
    "A big number takes a moment to sink in, so give them that moment. But don't sit in silence until they speak first. It's a pressure move, it feels pushy, and some people hang up or think the line has dropped.",
  ),
  r("blue", "If they ask \"Are you still there?\"", say("Yes, I'm still here. Just giving you a bit of space to think.")),
  say("So how does that land with you?"),
  note("If they haven't said anything after five to seven seconds."),
  info(
    "Listen first",
    "Let them react before you ask for the business. If they raise a worry here, handle it first. If it lands well, ask.",
  ),
  h("Ask for the business"),
  say("Given everything we've mapped out for the next 6 to 12 months, do you want to move forward and do this together?"),
  r("green", "Clear yes", say("Brilliant, let's get you started."), go("Take payment", "payment")),
  r(
    "red",
    "Anything else",
    go("", "think"),
    go("", "money"),
    go("", "partner"),
    go("", "timing"),
    go("", "fear"),
    go("", "decide"),
    go("", "cheaper"),
    go("", "unclear"),
    go("Universal closes", "loops"),
    go("", "score"),
  ),
];

export const PHASES: Phase[] = [
  { id: "discovery", title: "Discovery", goal: "Build on the review. Get the five facts in their words, then read them back.", blocks: discovery },
  { id: "pitch", title: "The Pitch", goal: "Take command, then nine steps or three phases. Every part tied to their problem.", blocks: [...transition, ...afterPitch] },
  { id: "investment", title: "Investment", goal: "Check they're a 9 or 10 on the approach, then share the investment once and stop talking.", blocks: investment },
  { id: "objections", title: "Objections", goal: "The first objection is rarely the real one. Find it, then handle it.", blocks: [] },
  { id: "closes", title: "Closes", goal: "Keep asking, calmly, until it's a clear yes or a clear no.", blocks: [] },
  { id: "next", title: "Next steps", goal: "Take payment on the call, or book the next one before you hang up.", blocks: [] },
];

export function phaseById(id: string): Phase | null {
  return PHASES.find((p) => p.id === id) ?? null;
}
