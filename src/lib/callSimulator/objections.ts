import type { Block } from "@/lib/salesCall/blocks";
import { OBJECTIONS_PARTS } from "@/lib/salesCall/library/objections";
import { OBJECTION_PAGES, type ObjectionId } from "@/lib/salesCall/objections";

import type { SimObjection, SimStage } from "./types";

/**
 * The objections a coach can practise, read from the Scripts: booking ones
 * from Booking objections (before the review, and rebooking), close ones
 * from the Profit Roadmap call's objection pages. Change the wording there
 * and the simulator follows.
 */

function says(blocks: Block[]): string[] {
  return blocks.flatMap((b) => (b.type === "say" ? [b.text] : b.type === "response" ? says(b.blocks) : []));
}

function fromScript(part: string, label: string, id: string, short: string): SimObjection | null {
  const found = OBJECTIONS_PARTS.find((p) => p.id === part)?.blocks.find(
    (b): b is Extract<Block, { type: "response" }> => b.type === "response" && b.label === label
  );
  if (!found) return null;
  const meaning = found.blocks.find((b): b is Extract<Block, { type: "note" }> => b.type === "note" && b.text.startsWith("What it usually means: "));
  return {
    id,
    label: short,
    says: label.replace(/\s*\(.*\)$/, "").replace(/^"|"$/g, "").split(/" or "/)[0],
    means: meaning ? meaning.text.replace("What it usually means: ", "") : "",
    lines: says(found.blocks).slice(0, 3),
    blocks: found.blocks,
  };
}

const BOOKING_PICKS: [part: string, label: string, id: string, short: string][] = [
  ["before", "\"I'm just having a look\"", "looking", "Just having a look"],
  ["before", "\"Just send me something\"", "send", "Send me something"],
  ["before", "\"What exactly do you do?\"", "what", "What do you do?"],
  ["before", "\"What's the catch?\"", "catch", "What's the catch?"],
  ["before", "\"How much is it?\"", "price", "How much is it?"],
  ["before", "\"I'm too busy\"", "busy", "Too busy"],
  ["before", "\"I need to think about it\"", "think", "Need to think"],
  ["before", "\"I'm not ready yet\" or \"The timing isn't right\"", "timing", "Not ready yet"],
  ["before", "\"Not interested\"", "not-interested", "Not interested"],
  ["before", "\"I've already got an accountant\"", "accountant", "Got an accountant"],
  ["before", "\"It's not for me\" (e.g. tried a consultant before)", "not-for-me", "Tried it before"],
  ["before", "\"I need to speak to my partner\"", "partner", "Ask my partner"],
];

const REBOOKING_PICKS: [part: string, label: string, id: string, short: string][] = [
  ["rebooking", "\"Something came up at work\"", "work", "Something came up"],
  ["rebooking", "\"Can we push it back a few weeks?\"", "push-back", "Push it back"],
  ["rebooking", "\"I'm not sure this is really for me\"", "unsure", "Not sure it's for me"],
  ["rebooking", "\"I'm worried about the cost\"", "cost", "Worried about cost"],
  ["rebooking", "\"Can we just do this over WhatsApp?\"", "whatsapp", "Do it on WhatsApp"],
  ["rebooking", "\"I don't think I'm interested anymore\"", "not-anymore", "Not interested now"],
];

export const BOOKING_OBJECTIONS: SimObjection[] = BOOKING_PICKS.map((p) => fromScript(...p)).filter((o): o is SimObjection => Boolean(o));
export const REBOOKING_OBJECTIONS: SimObjection[] = REBOOKING_PICKS.map((p) => fromScript(...p)).filter((o): o is SimObjection => Boolean(o));

/** What the owner says, where the page has no trigger line or its first one fits a call badly. */
const CLOSE_SAYS: Partial<Record<ObjectionId, string>> = {
  money: "It's a lot of money. I'm not sure we can stretch to that right now.",
  partner: "I'd need to speak to my business partner first.",
  timing: "Now's not a good time. We're flat out.",
  fear: "I tried a coach before and it didn't really work.",
};

const CLOSE_IDS: ObjectionId[] = ["think", "money", "partner", "timing", "fear", "decide", "cheaper"];

export const CLOSE_OBJECTIONS: SimObjection[] = CLOSE_IDS.map((id) => {
  const page = OBJECTION_PAGES.find((p) => p.id === id)!;
  const trigger = page.trigger?.match(/"([^"]+)"/)?.[1] ?? page.title;
  return {
    id,
    label: page.title,
    says: CLOSE_SAYS[id] ?? trigger,
    means: page.summary,
    // Most pages open with lines to say; Fear keeps them inside its two branches.
    blocks: page.blocks,
    lines: (says(page.blocks.filter((b) => b.type === "say")).length ? says(page.blocks.filter((b) => b.type === "say")) : says(page.blocks)).slice(0, 3),
  };
});

export function objectionList(kind: "booking" | "close"): SimObjection[] {
  return kind === "booking" ? BOOKING_OBJECTIONS : CLOSE_OBJECTIONS;
}

/** Fill a script line's {result} and {problem} with the prospect's own. */
export function fillLine(line: string, fill: { result: string; problem: string; name: string }): string {
  return line.replace(/\{result\}/g, fill.result).replace(/\{problem\}/g, fill.problem).replace(/\{name\}/g, fill.name);
}

/**
 * The four steps from "How to handle any objection" in Booking objections,
 * and the close's version of them from the Profit Roadmap call pages. Each
 * objection in a drill is scored 1 to 5 against these.
 */
const BOOKING_STEPS = {
  signs: [
    "Hear it: lets them finish and repeats the key part back",
    "Ask: one question to find the real reason, without assuming",
    "Answer short: two or three honest sentences on the real concern",
    "Move on: asks again for the booking with two set times, or sets a dated follow-up",
  ],
  misses: ["Jumps in with the answer", "Argues, or gives a speech", "Takes the first reason at face value", "Stacks two questions", "Leaves it hanging", "Adds pressure, guilt or false urgency"],
};

const CLOSE_STEPS = {
  signs: [
    "Stays calm and keeps the frame: no apology, no dropping the price",
    "Re-ties them to the result they said they want",
    "Finds the real objection behind the first one",
    "Uses the move that fits it (from the script) and answers in their terms",
    "Asks for the business again, or books a dated next step",
  ],
  misses: ["Breaks frame or sounds rattled", "Argues or lectures", "Accepts 'I'll think about it' and lets them go", "Offers a discount", "Agrees to email a proposal and ends the call"],
};

/** A drill's parts: one per objection the coach chose, in order. */
export function drillParts(kind: "booking" | "close", ids: string[]): SimStage[] {
  const steps = kind === "booking" ? BOOKING_STEPS : CLOSE_STEPS;
  return ids
    .map((id) => objectionList(kind).find((o) => o.id === id))
    .filter((o): o is SimObjection => Boolean(o))
    .map((o) => ({
      id: o.id,
      label: o.label,
      aim: `"${o.says}" ${o.means}`.trim(),
      signs: steps.signs,
      misses: steps.misses,
      questions: o.lines,
    }));
}

/** Surprise me: three or four at random, never the same twice in one drill. */
export function surpriseObjections(kind: "booking" | "close", count = Math.random() < 0.5 ? 3 : 4): string[] {
  const pool = objectionList(kind).map((o) => o.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export const MAX_OBJECTIONS = 4;
