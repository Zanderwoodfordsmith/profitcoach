/**
 * The sales call, step by step, for a coach selling to an owner. Discovery
 * follows Pam's value session (Value Session Mastery Workbook). The rest
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

export const STANDARD_BRIDGE =
  "So, {name}, you want help with {problem}, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.";

export const STANDARD_RECAP =
  "So, in the first month we get clear and you have a 90-day plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and a business that doesn't depend on you for everything. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.";

/** The phased pitch, in order, with the standard words for each phase. */
export const PITCH_PHASES = [
  {
    name: "Get clear",
    when: "The first month",
    text: "In the first month we meet every week. We score the business across every area and find what's really behind {problem}, because the obvious problem isn't always the real one. We agree where the business is going, then build a 90-day plan: what, who, when, and how we'll know. Which means you stop guessing, and you know your first move towards {result}.",
    check: "Does that make sense so far?",
  },
  {
    name: "Fix what matters",
    when: "Months two and three",
    text: "In months two and three we work the plan, starting with {problem}. Quick wins first, often profit and cash. We set up a weekly scoreboard, a few numbers your team fills in and you can read in under a minute. Every session asks the same three things: what got done, what's stuck, what's next. Which means things actually change, not another list of ideas.",
    check: "Can you see how that would work for you?",
  },
  {
    name: "Make it last",
    when: "From month four",
    text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We work on the numbers, the systems and the team, so the business doesn't depend on you for everything. Which means {result} sticks.",
    check: "Want me to show you how it all fits together?",
  },
];

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

const discovery: Block[] = [
  info(
    "How this call works",
    "This is Pam's value session: a free, pitch-free conversation built around your superpower and their main pain. You give real value first, and the sale follows from that.",
    "Your job in this part is to get the five facts in their words. Listen more than you talk. The notes panel shows what's still missing.",
  ),
  h("Warm rapport"),
  note("Two to three minutes."),
  say("Great to meet you, {name}. Thanks for making the time. I'd love to understand more about where you're at right now and where you'd like to go."),
  say("So what made you want to book this today?"),
  h("Set the frame"),
  say("Just so you know how this works: the point of today is for me to understand where the business is and where you want it to go. I'll ask you a few questions, I'll share a couple of things that should genuinely help, and if I think I can help further, I'll tell you how. Sound good?"),
  note("Wait for the yes."),
  h("Their biggest challenge"),
  note("Gets you: their priority, and what it's costing them."),
  say("What's the biggest challenge or opportunity you're facing right now that's stopping the business being where you want it to be?"),
  say("And what's that costing you at the moment? In money, in time, or in how you feel?"),
  info("Dig deeper", "How long has this been going on? What does it look like day to day? Who else does it affect? Use their words, and repeat them back."),
  h("Where they want to be"),
  note("Gets you: the result they want, and their numbers."),
  say("If we were having this same conversation 12 months from now, what would need to have changed in your business for you to feel genuinely happy with your progress?"),
  say("Is there a number on that? Revenue, profit, hours a week, team size?"),
  info("Why this matters", "This creates the gap between where they are and where they want to be. Everything you pitch later closes that gap."),
  h("Why it matters to them"),
  note("Gets you: their personal why."),
  say("Why is solving this important to you personally, beyond just the numbers?"),
  info("Listen for", "Family, freedom, pride, legacy, health. This is what you're really selling. Someone who wants systems so they can go away for two weeks without the phone ringing is buying those two weeks."),
  h("What they've tried"),
  say("What have you tried so far, and how has that worked out?"),
  note("Respect their journey. Repeat it back."),
  say("If nothing changed, and six months from now you were in exactly the same position, how would you feel about that?"),
  note("Let it land. This is the cost of standing still."),
  h("Give them value"),
  say("Based on what you've told me, would you like me to share a couple of insights and strategies that I think will make a real difference?"),
  info(
    "The audit",
    "On a value session, this is your 15-minute audit: your questions, scored red, amber or green. Don't just ask. Give them one or two things they can act on straight away. If there's a lot of red, frame it as opportunity.",
  ),
  h("The magic question"),
  note("After the aha moment."),
  say("Would you like to see how I help my clients solve exactly this, and get results faster?"),
  note("Wait for the yes. Then read it back."),
  h("Read it back"),
  live("readback"),
  say("Have I understood that correctly?"),
  note("Pause. Let them correct you."),
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
  { id: "discovery", title: "Discovery", goal: "Get the five facts in their words, then read them back.", blocks: discovery },
  { id: "pitch", title: "The Pitch", goal: "Take command, then nine steps or three phases. Every part tied to their problem.", blocks: [...transition, ...afterPitch] },
  { id: "investment", title: "Investment", goal: "Check they're a 9 or 10 on the approach, then share the investment once and stop talking.", blocks: investment },
  { id: "objections", title: "Objections", goal: "The first objection is rarely the real one. Find it, then handle it.", blocks: [] },
  { id: "closes", title: "Closes", goal: "Keep asking, calmly, until it's a clear yes or a clear no.", blocks: [] },
  { id: "next", title: "Next steps", goal: "Take payment on the call, or book the next one before you hang up.", blocks: [] },
];

export function phaseById(id: string): Phase | null {
  return PHASES.find((p) => p.id === id) ?? null;
}
