import type { Difficulty, SimFact, SimStage } from "@/lib/simulator/types";

import { drillParts } from "./objections";
import type { Prospect } from "./prospects";
import type { CallGroup, CallId, FactKey, SimCallType } from "./types";

/**
 * What a coach can practise, in the Scripts' order. Every call has parts the
 * live bar tracks and the report scores 1 to 5; the five sales skills below
 * are scored on every call too. The score is a percentage, so a whole call,
 * a call started halfway and a three-objection drill all compare.
 *
 * The parts follow the Scripts (src/lib/salesCall/library and script.ts).
 * Version 1, 23 Oct 2026: Alex and Yan's setter and sales rubric will
 * sharpen the guides when it arrives.
 */

function part(id: string, label: string, aim: string, signs: string[], misses: string[], questions: string[]): SimStage {
  return { id, label, aim, signs, misses, questions };
}

/** Scored on every call. */
export const SALES_SKILLS: SimStage[] = [
  part(
    "lead",
    "Leads the call",
    "Sets up the call, asks permission, keeps it on track, and takes charge when it matters.",
    ["Says why they're calling and how the call will go", "Asks permission before moving on", "Brings them back when they drift"],
    ["Lets the owner run the call", "No frame, so the next step feels like a surprise", "Rambles before getting to the point"],
    ["Here's how I'd like to use our time. Sound fair?", "Is now a bad time to talk?"]
  ),
  part(
    "listen",
    "Questions and listening",
    "One question at a time, in their words, one level deeper, then quiet.",
    ["Asks one question, then stops", "Picks up their exact words", "Goes one layer deeper on what matters"],
    ["Stacks two or three questions", "Answers for them", "Moves on from a big answer too fast"],
    ["You said '...'. What does that mean for you?", "What makes you say that?", "What else?"]
  ),
  part(
    "theirs",
    "Their reasons",
    "Ties every step to what they said: their goal, their numbers, their words. Never makes up pain.",
    ["Reflects back their goal and problem", "Puts the next step in their terms", "Uses their numbers, not made-up ones"],
    ["Generic pitch that could be for anyone", "Creates pain that isn't there", "Talks about themselves more than the owner"],
    ["Based on what you've told me, ...", "So you're looking to ... because ... Have I got that right?"]
  ),
  part(
    "calm",
    "Calm confidence",
    "Warm, plain and unhurried. Says the price and the ask plainly. No pushing, guilt, false urgency or promises of results.",
    ["Says the price or the ask like it's normal", "Comfortable with a short silence", "Honest: 'it might not make sense for you'"],
    ["Apologises for the price or the call", "Pushy, or guilt about a missed call", "Promises results or invents scarcity"],
    ["It might not make sense for you. I can't work with everybody.", "Just giving you a bit of space to think."]
  ),
  part(
    "ask",
    "Clear next step",
    "Asks for the booking or the business, offers two set times, and never leaves it open.",
    ["Asks clearly for the next step", "Offers two set days and times", "Confirms the day, date and time and why it matters"],
    ["'When works for you?' with no options", "'I'll be in touch' with no date", "Never actually asks"],
    ["Would Tuesday at 10 or Thursday at 2 suit you better?", "Do you want to move forward and do this together?"]
  ),
];

/** On a tile before it's found: where to dig, never the answer. */
export const FACT_HINTS: Record<FactKey, string> = {
  business: "The business and its size",
  whyNow: "Why they're looking now",
  problem: "What's in the way",
  cost: "What it's costing them",
  goal: "Their goal and a number",
  personal: "Why it matters to them",
  tried: "What they've tried",
  decider: "Who else decides",
  worry: "The real worry",
  reason: "Why they missed or moved it",
  time: "A set day and time",
};

export const CALLS: SimCallType[] = [
  {
    id: "cold",
    group: "book",
    title: "Cold call",
    line: "Two to five minutes. Book the review and nothing else.",
    minutes: 5,
    script: "reach-out",
    coachAim: "Ask for 30 seconds, give the reason in a line, find which problem is on their mind, then book a BOSS Score Review for a set day and time.",
    win: "A BOSS Score Review booked for a set day and time",
    facts: ["problem", "time"],
    parts: [
      part("permission", "Permission", "Say who you are, admit it's out of the blue, and ask for 30 seconds.", ["Quick and honest: 'I'm calling out of the blue'", "Asks for 30 seconds"], ["Launches into a pitch", "Sounds like a script"], ["Can I take 30 seconds to tell you why, and then you can tell me if it's worth carrying on?"]),
      part("reason", "The reason", "Who you help and the three things that hold firms back, then one question.", ["Names three real problems in plain words", "Ends on 'Is any of those on your mind?'"], ["Talks about themselves", "No question at the end"], ["Is any of those on your mind at the moment?"]),
      part("listen", "Let them talk", "Ask which one, and let them talk for a minute.", ["Asks 'Which one?'", "Lets them talk, one follow-up"], ["Jumps straight to booking", "Interrupts"], ["Which one?", "Tell me a bit more about that."]),
      part("offer", "The offer", "The review in two lines: 30 minutes, ten areas, one constraint, one action, free, no pitch.", ["Clear and short", "Free and no pitch said plainly"], ["Vague about what it is", "Oversells"], ["That's exactly what a BOSS Score Review is for."]),
      part("book", "Book it", "Two set times, the email, and the 3-minute BOSS Score to do first.", ["Two set times", "Gets the email", "Mentions the BOSS Score first"], ["'When works?'", "No time agreed"], ["Would Tuesday at 10 or Thursday at 2 suit you better?", "Is this the best email for the invite?"]),
    ],
  },
  {
    id: "new-lead",
    group: "book",
    title: "New lead call",
    line: "They took your BOSS Score. Find out what they want and book the review.",
    minutes: 12,
    script: "new-lead",
    coachAim: "Open with the reason for calling, understand the business and why now, get the goal with a number and the reason behind it, the problem and the cost of waiting, then book a BOSS Score Review with two set times.",
    win: "A BOSS Score Review booked for a set day and time",
    facts: ["business", "whyNow", "goal", "personal", "problem", "tried", "decider", "time"],
    parts: [
      part("open", "Open the call", "Say why you're calling, check it's a good time, and a line of soft authority.", ["Gives the reason: they took the BOSS Score", "'Is now a bad time to talk?'", "One or two lines of context, not a pitch"], ["Launches into questions with no reason", "Long pitch about themselves"], ["Is now a bad time to talk?", "I don't work with every business that gets in touch."]),
      part("situation", "Business and why now", "Understand the business, then their reason for looking now, in their words.", ["Asks about the business and size", "Asks 'what made you take a look at this now?' then stops", "Goes one layer deeper"], ["Skips why now", "Accepts 'just curious' without turning it into a goal"], ["With everything you've built, what made you take a look at this now?"]),
      part("goal", "Goal and problem", "The goal and the reason behind it, then what's in the way. Don't deep dive.", ["Gets a number", "Gets the personal reason", "Reflects it back: 'Have I got that right?'", "Asks what they've tried"], ["Labels the problem for them", "Turns it into the review"], ["Is there a number on that?", "What's the biggest thing stopping you getting there on your own?"]),
      part("cost", "Cost of waiting", "Timing, and what happens if nothing changes in the next 12 months.", ["Asks 60 to 90 days or later", "Asks what another year the same looks like, then stays quiet"], ["Makes up urgency", "Answers for them"], ["And if nothing changes over the next 12 months, what does that look like for you?"]),
      part("book", "Book the review", "Tie the review to their problem and goal, two set times, and a commitment that they'll be there.", ["Links the review to what they said", "Two set times within two or three days", "Checks it's a solid yes"], ["Open-ended 'when works?'", "No commitment check"], ["Are you in front of your diary right now?", "I've got Tuesday or Thursday, which suits you better?"]),
    ],
  },
  {
    id: "booking-objections",
    group: "book",
    title: "Booking objections",
    line: "Pick the pushback to face, or let it surprise you.",
    minutes: 6,
    script: "objections",
    drill: "booking",
    coachAim: "Handle each objection with the four steps (hear it, ask one question, answer short, move on) and end with the review booked or a dated follow-up.",
    win: "A BOSS Score Review booked for a set day and time",
    facts: ["time"],
    parts: [],
  },
  {
    id: "review",
    group: "review",
    title: "BOSS Score Review",
    line: "The whole call, or start at any part.",
    minutes: 25,
    script: "review",
    startable: true,
    coachAim: "Give real value: set the frame, find where they are and want to be, go through their score, agree the one constraint, put a pound figure on it with their numbers, coach on it, give one action, then switch hats and book the Profit Roadmap call.",
    win: "The Profit Roadmap call booked for a set day and time",
    facts: ["problem", "cost", "goal", "personal", "tried", "time"],
    parts: [
      part("open", "Open and where they are", "Set the frame for the 30 minutes, then the challenge, what it costs, the 12-month goal with a number, and why it matters.", ["Frames the call and gets a yes", "Asks what it's costing", "Gets a goal with a number and the personal why"], ["No frame, so booking call 2 feels like a pitch", "Skips the cost", "Pitches early"], ["Here's how I'd like to use our 30 minutes... Sound fair?", "What's that costing you at the moment?", "Why does that matter to you personally?"]),
      part("score", "The score", "Their level and lowest areas, and they pick the one constraint.", ["Checks the level sounds right", "Links lowest areas to their challenge", "They name the constraint"], ["Reads the report at them", "Picks the constraint for them"], ["Does that sound right?", "If we fixed only one of these in the next 90 days, which would make the biggest difference?"]),
      part("money", "The money moment", "Put a pound figure on it with their own rough numbers. Small moves multiply.", ["Asks for their numbers", "Shows ten per cent on five numbers", "Says it's what's possible on paper, not a forecast"], ["Makes up the numbers", "Promises the figure"], ["Which of these five would be easiest to move in the next 90 days?"]),
      part("coach", "Coach on the constraint", "Two or three playbook questions, then one action they'll take this week.", ["Asks permission to share", "Asks rather than lectures", "One action with a day"], ["Gives a lecture", "No action, or five actions"], ["What would that mean for you?", "Can you do it before Friday?"]),
      part("book", "Switch hats and book", "Name their top three problems, ask if they'd like to see how you'd fix them, and book the Profit Roadmap call.", ["Says 'Can I switch hats?'", "Names three problems in their words", "Asks permission, then two set times"], ["Pitches without permission", "Handles objections on the review", "Forgets to book"], ["Would you like to see how I help owners fix all three properly, and faster?", "Would Tuesday at 10 or Thursday at 2 work?"]),
    ],
  },
  {
    id: "roadmap",
    group: "roadmap",
    title: "Profit Roadmap call",
    line: "The whole call, or practise one part: discovery, the pitch, the price.",
    minutes: 30,
    script: "roadmap",
    startable: true,
    coachAim: "Build on the review: get the five facts (priority, cost, result, numbers, personal why) and read them back, pitch the plan in their words, check they're a 9 or 10, name the price once and stop talking, handle objections by finding the real one, and take payment or book the next step.",
    win: "A yes, with payment taken or the first session booked",
    facts: ["problem", "cost", "goal", "personal", "decider", "worry"],
    parts: [
      part("discovery", "Discovery", "Build on the review. Get the five facts in their words, then read them back and check.", ["Checks the review notes are still right", "Gets priority, cost, result, number and personal why", "Reads it back: 'Have I understood that correctly?'"], ["Rushes to the pitch", "Doesn't read it back", "Accepts a vague goal"], ["Why does solving this matter to you personally, beyond the numbers?", "Have I understood that correctly?"]),
      part("pitch", "The pitch", "Take command, then nine steps or three phases, every part tied to their problem and result.", ["Asks permission to show the plan", "Each part tied to what they said", "Checks in as they go"], ["Generic pitch", "Talks for ten minutes without a check", "Features, not their result"], ["Because you told me ..., what we'll do is ...", "Does that make sense so far?"]),
      part("investment", "Investment", "Check they're a 9 or 10 on the approach, then share the investment once and stop talking.", ["Asks 'out of 10' first and challenges a soft score", "Says the price plainly, once", "Five to seven seconds of quiet, then 'how does that land?'"], ["Apologises or explains the price", "Fills the silence", "Skips the temperature check"], ["Out of 10, how confident are you this would get you there?", "So how does that land with you?"]),
      part("objections", "Objections", "Stay calm, re-tie them to their result, and find the real objection behind the first one.", ["Doesn't break frame", "Asks what's behind it", "Asks for the business again"], ["Argues", "Drops the price", "Agrees to email a proposal and ends there"], ["Do you genuinely believe this can get you there?", "When you go away to think, what will you be thinking about?"]),
      part("next", "Next steps", "Take payment on the call, or book the next one before you hang up.", ["Stays on while they pay", "Books the first session", "Asks for a referral"], ["Ends the call to 'send the details'", "No date for the next step"], ["Brilliant, let's get you started.", "Who else do you know who's in a similar position?"]),
    ],
  },
  {
    id: "close-objections",
    group: "roadmap",
    title: "Objections after the price",
    line: "Pick the objections to face, or let it surprise you.",
    minutes: 8,
    script: "roadmap",
    drill: "close",
    coachAim: "After the price, handle each objection the Profit Roadmap call's way: stay calm, re-tie them to their result, find the real objection, use the move that fits, and ask again until it's a clear yes or a clear no.",
    win: "A yes, or a deposit and the next call booked",
    facts: ["worry"],
    parts: [],
  },
  {
    id: "no-show",
    group: "rebook",
    title: "No-show",
    line: "They missed the call. Ring them and get a real new time.",
    minutes: 4,
    script: "no-shows",
    coachAim: "Ring 5 to 10 minutes after the start, stay calm with no guilt, tie the call back to what they said they wanted, offer two set times, and lock in a day, date and time.",
    win: "A new day and time booked",
    facts: ["reason", "time"],
    parts: [
      part("calm", "Calm start", "A missed call is normal. No guilt, no drama.", ["Light and friendly", "'No problem at all'"], ["Guilt or sarcasm", "Long explanation"], ["Think we might have just missed each other. No problem at all."]),
      part("diagnose", "Only if they hesitate", "Find out what's changed, but only if they go vague.", ["Asks once, only when they stall", "Uses the rebooking answer that fits"], ["Interrogates someone who's happy to rebook", "Pushes a second time"], ["Is it more that the timing's not working, or has something changed?"]),
      part("reason", "The reason to show up", "Tie the call back to what they said they wanted.", ["Names their goal or problem"], ["Generic 'it'll be useful'"], ["You mentioned ..., that's exactly what this call would help with."]),
      part("times", "Two set times", "Never 'when works?'. Two days, two times.", ["Two specific options"], ["Open-ended"], ["I've got Tuesday or Thursday, which works better?"]),
      part("lock", "Lock it in", "Day, date and time confirmed, and why it matters.", ["Repeats the slot back", "Ties it to their goal"], ["'I'll be in touch'"], ["Good, I've got you booked for Tuesday the 4th at 10."]),
    ],
  },
  {
    id: "reschedule",
    group: "rebook",
    title: "Reschedule",
    line: "They want to move the call. Keep it booked.",
    minutes: 4,
    script: "no-shows",
    coachAim: "Respond warmly, diagnose only if they hesitate, offer two set times, and rebuild the reason to show up. On a second reschedule, name the pattern honestly.",
    win: "A new day and time booked",
    facts: ["reason", "time"],
    parts: [
      part("warm", "Respond warmly", "No problem at all, life happens.", ["Warm and quick"], ["Sounds put out"], ["No problem at all, life happens."]),
      part("diagnose", "Only if they hesitate", "If they go vague, find out what's changed.", ["One honest question"], ["Skips it when they stall", "Asks when they're happy to rebook"], ["Is it more that the timing's just not working, or has something changed on your side?"]),
      part("times", "Two set times", "Two days, two times.", ["Specific options"], ["'When works for you?'"], ["I've got Tuesday or Thursday, which works better?"]),
      part("reason", "Reconfirm the reason", "Tie the new time to what they said matters.", ["Names their goal"], ["Just confirms the slot"], ["That'll still be all about ..."]),
      part("lock", "Lock it in", "Day, date and time confirmed. If it's their second move, name the pattern honestly.", ["Repeats the slot back", "On a second move, checks the new time is genuinely clear, without pressure"], ["'I'll be in touch'", "Guilt about moving it"], ["My diary for these is limited, so I want to make sure this next one actually works. Is Tuesday genuinely clear?"]),
    ],
  },
];

export const CALL_GROUPS: { id: CallGroup; title: string }[] = [
  { id: "book", title: "Book the review" },
  { id: "review", title: "Call 1" },
  { id: "roadmap", title: "Call 2" },
  { id: "rebook", title: "No-shows and reschedules" },
];

export function callById(id: string): SimCallType | null {
  return CALLS.find((c) => c.id === id) ?? null;
}

/** The parts this session covers: the drill's objections, or the call's parts from where it starts. */
export function sessionParts(call: SimCallType, opts: { startPart: string | null; objections: string[] }): SimStage[] {
  if (call.drill) return drillParts(call.drill, opts.objections);
  const from = opts.startPart ? Math.max(0, call.parts.findIndex((p) => p.id === opts.startPart)) : 0;
  return call.parts.slice(from);
}

export function isCallId(id: string): id is CallId {
  return CALLS.some((c) => c.id === id);
}

/** The tiles for "Found so far": what this call should get out of this owner. Only Hard owners hide a real worry. */
export function callFacts(call: SimCallType, p: Prospect, difficulty: Difficulty): SimFact[] {
  return call.facts.filter((key) => key !== "worry" || difficulty === "hard").map((key) =>
    key === "time"
      ? { id: key, label: "Day and time agreed", hint: FACT_HINTS.time, detail: `A set day and time is agreed for the next call. Their diary: ${p.profile.diary}` }
      : { id: key, label: p.profile[key].label, hint: FACT_HINTS[key], detail: p.profile[key].detail }
  );
}

/** The help box on the call screen: how to handle pushback, the way the scripts teach it. */
export function callHelp(call: SimCallType): { title: string; help: string; try: string[] } {
  if (call.group === "roadmap") {
    return {
      title: "When they push back after the price",
      help: "Stay calm and keep the price. Re-tie them to the result they want, find the real objection behind the first one, then ask again.",
      try: [
        "Do you genuinely believe this can get you there?",
        "When you go away to think about it, what will you be thinking about?",
        "Apart from that, is there anything else?",
      ],
    };
  }
  return {
    title: "When they push back",
    help: "Hear it, ask one question, answer short, move on. The first reason is rarely the real one, so ask before you answer.",
    try: ["What makes you say that?", "Is that more about the time, or more about the cost?", "What would need to be true for this to make sense for you?"],
  };
}
