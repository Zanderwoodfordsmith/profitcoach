import type { Difficulty, TranscriptLine } from "@/lib/simulator/types";

import { BOOKING_OBJECTIONS, REBOOKING_OBJECTIONS, objectionList } from "./objections";
import type { Prospect } from "./prospects";
import { callScript, expectedReplies } from "./script";
import type { SimCallType } from "./types";

/**
 * The words the voice agent runs on for a sales call. Same agent as the
 * Client simulator: ElevenLabs takes this prompt, an opening line and a
 * voice for each call.
 */

function levelSplit(difficulty: Difficulty, easy: string, medium: string, hard: string): string {
  return difficulty === "easy" ? easy : difficulty === "medium" ? medium : hard;
}

/** How hard the owner is to sell to. Shared by every call; the call adds its own objections. */
const BUYER_LEVELS: Record<Difficulty, { label: string; rules: string }> = {
  easy: {
    label: "Easy",
    rules: `You're warm and open. Your personality shows only lightly.
- Answer clearly, and give information as soon as a question gets near it.
- Raise at most one gentle concern. A decent answer settles it.
- Say yes to a clear next step.`,
  },
  medium: {
    label: "Medium",
    rules: `You're interested but careful, and busy. Your personality shows regularly.
- Give a fact only when a question is specific. A general question gets a general answer.
- Raise the concerns below, one at a time. The first thing you say isn't the whole story; a good question gets the real reason.
- Agree to a next step only once your concern is answered and the coach offers a specific time.`,
  },
  hard: {
    label: "Hard",
    rules: `You're guarded, short of time and sceptical of anyone selling. Your personality shows strongly.
- Short answers until the coach earns more with good questions or real interest in you.
- Raise the concerns below, and push back again if the coach argues, pitches, talks too long or sounds scripted.
- The first concern you give hides the real one. Only share the real one if the coach asks well and stays calm.
- Pressure, guilt or hype makes you colder. Calm honesty, like "it might not make sense for you", earns respect.
- You can say no. Only agree if the coach really handles you well.`,
  },
};

function said(ids: string[], list = [...BOOKING_OBJECTIONS, ...REBOOKING_OBJECTIONS]): string {
  return ids
    .map((id) => list.find((o) => o.id === id)?.says)
    .filter(Boolean)
    .map((s) => `"${s}"`)
    .join(", then ");
}

/** What's going on for the owner in this call. */
function callFrame(call: SimCallType, p: Prospect, difficulty: Difficulty, objections: string[]): string {
  const f = p.profile;
  switch (call.id) {
    case "cold":
      return `Your phone rings. It's a business coach you've never heard of, calling out of the blue. You're in the middle of something. ${levelSplit(
        difficulty,
        `You're friendly. If they're quick and honest, you give them a minute. When they ask what's on your mind, it's this: ${f.problem.detail} If they offer something useful and free, book it. You might ask "${said(["catch"])}" once.`,
        `You're polite but busy. If they ask what's on your mind, mention the problem: ${f.problem.detail} Push back with ${said(["send", "busy"])} before you agree to book.`,
        `You're irritated by cold calls. Start with "How did you get my number?" or "${said(["not-interested"])}". If they stay calm and get to a real problem, you might soften: ${f.problem.detail} Push back with ${said(["send", "accountant", "price"])}. Only book if they keep it short and specific.`
      )}`;
    case "new-lead":
      return `Last night you took the BOSS Score online: level "${p.boss.level}", lowest areas ${p.boss.lowest[0]} and ${p.boss.lowest[1]}. You didn't book anything. Now the coach whose score it was is ringing you. ${levelSplit(
        difficulty,
        "You're pleased they called and happy to talk.",
        `You're a bit surprised they rang. Ask "${said(["what"])}" early, and say "${said(["busy"])}" when they suggest the review.`,
        `You took it out of curiosity and say "${said(["looking"])}". Later push back with ${said(["send", "price", "partner"])}.`
      )}`;
    case "review":
      return `You took the BOSS Score online and booked this free 30-minute BOSS Score Review. You scored at level "${p.boss.level}". Your lowest areas are ${p.boss.lowest[0]} and ${p.boss.lowest[1]}. If asked which one to fix first, you'd pick ${p.boss.constraint}. You don't know this coach. You're curious but busy, and wary of being sold to. If they ask about your numbers or what a problem costs, answer from what you know. At the end, if they offer to talk about working together: ${levelSplit(
        difficulty,
        "agree to book a time.",
        "agree, but ask what it costs first.",
        "say you were only after some free advice, ask them to just send you something, and only agree if they show it's worth another call."
      )}`;
    case "roadmap":
      return `This is your second call with the coach. Last week, in a free BOSS Score Review, you agreed your main constraint was ${p.boss.constraint}. You're interested in their help but careful with money and time. When they name a price, treat it as their real price. ${levelSplit(
        difficulty,
        "Ask one question about how it works, then say yes.",
        `Say you need to think about it. The real reason is who else decides: ${f.decider.detail}`,
        `Raise several objections in turn: you need to think about it, it's a lot of money, you tried something like this before and it didn't work, the timing's bad. Your real worry: ${f.worry.detail} Only agree if they handle you well.`
      )}`;
    case "booking-objections":
    case "close-objections": {
      const list = objectionList(call.drill!);
      const picked = objections.map((id) => list.find((o) => o.id === id)).filter(Boolean);
      const where =
        call.id === "booking-objections"
          ? `You took the BOSS Score (level "${p.boss.level}") and the coach has rung you. They've just told you about a free 30-minute BOSS Score Review. You don't know them.`
          : `This is your second call with the coach, the Profit Roadmap call. They've asked about your business, read back what you told them, shown you their plan, and just told you their price. Treat whatever price they say as real.`;
      return `${where}
When the coach asks you to ${call.id === "booking-objections" ? "book the review" : "go ahead"}, push back with these concerns, in this order, one at a time. Say each in your own words, close to:
${picked.map((o, i) => `${i + 1}. "${o!.says}"`).join("\n")}
Stay on a concern until the coach has asked about it and answered it. When they ask again, raise the next one. Don't raise two at once, and don't repeat one they've handled well.
${levelSplit(
  difficulty,
  "Each concern is mild. A decent answer settles it.",
  "The first thing you say about each isn't the whole story. A good question gets the real reason.",
  `Each concern hides a deeper one. Your real worry underneath it all: ${f.worry.detail} Only admit it if the coach asks well and stays calm.`
)}
After the last one: if the coach handled them well, ${call.id === "booking-objections" ? `book the review. Your diary: ${p.profile.diary}` : "say yes and ask how you get started"}. If they only partly did, agree to ${call.id === "booking-objections" ? "a follow-up call on a set date" : "a small deposit or a second call on a set date, if they offer"}. If they argued, pushed or rambled, say you'll think about it.`;
    }
    case "no-show":
      return `You had a free BOSS Score Review booked with this coach at 10 this morning and didn't join. ${f.reason.detail} Your phone rings at about seven minutes past. ${levelSplit(
        difficulty,
        "You're embarrassed, apologise, and happily pick a new time.",
        `Apologise, then go vague: "${said(["work"])}" and "${said(["push-back"])}". Only pick a set time if they offer two.`,
        `You've cooled off. Say "${said(["unsure"])}", then "${said(["whatsapp"])}". Only rebook if they tie it back to what you wanted and stay calm.`
      )}`;
    case "reschedule":
      return `You have a free BOSS Score Review booked with this coach for Thursday at 2pm. ${f.reason.detail} You're ringing to move it. ${levelSplit(
        difficulty,
        "Take the first time they offer that fits your diary.",
        `When they offer times, go vague: "Can I get back to you?" then "${said(["push-back"])}". Pick a set time only if they offer two.`,
        `This is the second time you've moved it, and you feel a bit awkward about it. Go vague, then say "${said(["unsure"])}". Commit only if they name the pattern kindly and give you a reason to show up.`
      )}`;
  }
}

/** Earlier in the call, for a coach who starts partway or skips ahead. Index is the part they start at. */
function earlier(call: SimCallType, p: Prospect, upTo: number): string[] {
  const f = p.profile;
  const steps: Record<string, string> = {
    "review:open": `You told the coach your biggest challenge: ${f.problem.detail} What it costs: ${f.cost.detail} In 12 months: ${f.goal.detail} Why it matters: ${f.personal.detail}`,
    "review:score": `You went through your BOSS Score together: level "${p.boss.level}", lowest ${p.boss.lowest[0]} and ${p.boss.lowest[1]}. You agreed your constraint is ${p.boss.constraint}.`,
    "review:money": "The coach used your rough numbers to show what small improvements would be worth a year. It got your attention.",
    "review:coach": `The coach asked you good questions about ${p.boss.constraint} and you agreed one action for this week.`,
    "roadmap:discovery": `You told the coach: ${f.problem.detail} ${f.cost.detail} ${f.goal.detail} ${f.personal.detail} They read it back and you agreed.`,
    "roadmap:pitch": "The coach showed you their plan for fixing it, tied to what you told them. You liked most of it.",
    "roadmap:investment": "The coach asked how ready you were (you said about an 8 out of 10) and told you their price.",
    "roadmap:objections": "You raised your concerns, the coach handled them, and you've said yes.",
  };
  return call.parts.slice(0, upTo).map((part) => steps[`${call.id}:${part.id}`]).filter(Boolean);
}

/** What the coach needs to know before they start: who, what's happened, and anything from earlier in the call. */
export function callBrief(call: SimCallType, p: Prospect, difficulty: Difficulty, startPart: string | null): { setup: string; sofar: string[] } {
  const f = p.profile;
  const start = startPart ? call.parts.findIndex((x) => x.id === startPart) : 0;
  const setups: Record<SimCallType["id"], string> = {
    cold: `You're cold calling ${p.name}, ${p.role.toLowerCase()} of ${p.business} in ${p.place}. You found the business online.`,
    "new-lead": `${p.firstName} took your BOSS Score last night: ${p.boss.level}, lowest in ${p.boss.lowest[0]} and ${p.boss.lowest[1]}. No review booked yet. You're calling now.`,
    "booking-objections": `You're on the phone with ${p.firstName}, who took your BOSS Score. You've just told them about the free review. Ask to book it, then handle what comes.`,
    review: `${p.firstName} booked a BOSS Score Review: ${p.boss.level}, lowest in ${p.boss.lowest[0]} and ${p.boss.lowest[1]}. You haven't spoken before.`,
    roadmap: `Your second call with ${p.firstName}. In the review you agreed the constraint was ${p.boss.constraint}.`,
    "close-objections": `You've done discovery with ${p.firstName} and pitched your plan. You've just named your price. Ask for the business.`,
    "no-show": `${p.firstName} booked a BOSS Score Review for 10 this morning and didn't join. It's 10:07. You're ringing.`,
    reschedule: `${p.firstName} is calling about the review booked for Thursday at 2pm.${difficulty === "hard" ? " It's the second time they've moved it." : ""}`,
  };
  const sofar =
    call.id === "roadmap" || call.id === "close-objections"
      ? [`Priority: ${f.problem.label}`, `Cost: ${f.cost.label}`, `Result: ${f.goal.label}`, `Why: ${f.personal.label}`]
      : call.id === "review" && start > 0
        ? [`Challenge: ${f.problem.label}`, `Goal: ${f.goal.label}`, ...(start > 1 ? [`Constraint: ${p.boss.constraint}`] : [])]
        : call.id === "no-show" || call.id === "reschedule"
          ? [`They wanted: ${f.goal.label}`]
          : [];
  return { setup: setups[call.id], sofar };
}

export function prospectPrompt(input: {
  prospect: Prospect;
  call: SimCallType;
  difficulty: Difficulty;
  coachName: string | null;
  startPart: string | null;
  objections: string[];
  /** After a time out: the call so far. */
  sofar?: TranscriptLine[];
  /** The coach jumped ahead to this part. */
  skipTo?: string | null;
}): string {
  const { prospect: p, call, difficulty, coachName, startPart, objections, sofar, skipTo } = input;
  const level = BUYER_LEVELS[difficulty];
  const startIndex = startPart ? call.parts.findIndex((x) => x.id === startPart) : -1;
  const parts = [
    `You are ${p.name}. This is a voice role-play on a phone or video call. A business coach${coachName ? ` called ${coachName}` : ""} is practising a sales conversation, and you play the business owner they're talking to. Stay in character the whole time. Never say you are an AI, never mention the role-play, and never coach the coach.`,
    `# Who you are\n${p.character}\n${p.profile.business.detail}`,
    `# This call: ${call.title}\n${callFrame(call, p, difficulty, objections)}`,
    `# What you know about yourself (share only when asked)
Never volunteer these. Give one only when a question points at it. A vague question gets a vague answer.
- Why you're looking now: ${p.profile.whyNow.detail}
- What's in the way: ${p.profile.problem.detail}
- What it costs you: ${p.profile.cost.detail}
- Your goal: ${p.profile.goal.detail}
- Why it matters to you: ${p.profile.personal.detail}
- What you've tried: ${p.profile.tried.detail}
- Who else decides: ${p.profile.decider.detail}
- Your diary: ${p.profile.diary}
Your business numbers, if asked:
${p.facts.map((f) => `- ${f.detail}`).join("\n")}`,
    `# How you talk
- This is a quick spoken sales call, not a coaching session. Most answers are a few words or one short sentence: "Yeah, go on", "Not really", "Mornings are better". Never more than three sentences.
- Only an open question about your business, your goal or what a problem costs you gets two or three sentences, and even then keep it tight.
- Speak naturally in British English, with the odd "um" or "I mean", but not in every answer.
- The coach leads. Never run the call for them, never suggest what to talk about next, and never sum up for them.
- No lists, no stage directions, no asterisks, no emoji, and no sound cues in brackets like [laughs]. Show feeling in the words you choose.
- Say numbers the way a person would: "about two million", "eight per cent".
- If you didn't catch something, say so.
- If the coach goes quiet after a big question, think and say a little more, or stay quiet. Only check they're still there after a long silence.
- Your personality shows in how you talk: ${p.behaviours.slice(0, 2).join(" ")}`,
    `# How hard you are to sell to: ${level.label}\n${level.rules}`,
    `# Ending
If the coach wraps up, say goodbye briefly in character. If you agreed a time, repeat it back. Never give feedback on how they did.`,
  ];
  const replies = expectedReplies(callScript(call, { startPart, objections }));
  if (replies.length) {
    // Before the level, so the level decides which of them they reach for.
    parts.splice(
      parts.length - 2,
      0,
      `# Answers the script expects
At many points the coach's script expects a quick answer, like one of these. When a question fits one, answer in a few words, close to it, in your own voice. Pick the one that fits your level, your personality and what's just been said, not always the easiest.
${replies.map((r) => `- ${r}`).join("\n")}`
    );
  }
  if (startIndex > 0) {
    parts.push(
      `# Where this call starts
The coach is practising from "${call.parts[startIndex].label}". Earlier in this same call:
${earlier(call, p, startIndex).map((l) => `- ${l}`).join("\n")}
Wait for the coach to speak, then carry on from there as if all of that just happened.`
    );
  }
  if (sofar?.length) {
    parts.push(
      `# The call so far
The coach paused the call for a moment. Here is everything said so far. Carry on as if no time has passed. Wait for the coach to speak first.
${sofar.map((l) => `${l.role === "coach" ? "Coach" : "You"}: ${l.text}`).join("\n")}`
    );
  }
  const skipIndex = skipTo ? call.parts.findIndex((x) => x.id === skipTo) : -1;
  if (skipIndex > 0) {
    const between = earlier(call, p, skipIndex).slice(Math.max(0, startIndex));
    parts.push(
      `# The coach has skipped ahead
The coach jumped ahead to "${call.parts[skipIndex].label}". Act as if the parts in between happened and went fine${between.length ? `:\n${between.map((l) => `- ${l}`).join("\n")}` : "."}
Wait for the coach to speak, then answer as if you're now at that point in the call.`
    );
  }
  return parts.join("\n\n");
}

/** The owner's opening line. "" means they wait for the coach. */
export function prospectFirstMessage(call: SimCallType, p: Prospect, coachName: string | null, startPart: string | null): string {
  const hi = coachName ? `Hi ${coachName}` : "Hi";
  if (startPart && call.parts[0]?.id !== startPart) return "";
  switch (call.id) {
    case "cold":
    case "new-lead":
    case "no-show":
      return p.profile.hello;
    case "review":
      return `${hi}, it's ${p.firstName} from ${p.business}. I did the BOSS Score thing last week?`;
    case "roadmap":
      return `${hi}, good to speak again.`;
    case "reschedule":
      return `${hi}, it's ${p.firstName} from ${p.business}. Look, I'm really sorry, I need to move our call on Thursday.`;
    default:
      return "";
  }
}

/** Shown on the call screen when the coach speaks first. */
export function callCue(call: SimCallType, p: Prospect, startPart: string | null): string {
  if (call.id === "booking-objections") return `You start. Ask ${p.firstName} to book the review.`;
  if (call.id === "close-objections") return "You start. Ask for the business.";
  const part = startPart ? call.parts.find((x) => x.id === startPart) : null;
  return part && call.parts[0]?.id !== part.id ? `You start, at ${part.label}.` : "";
}
