import { type Block, type Tone, say } from "@/lib/salesCall/blocks";
import { NEW_LEAD_PARTS } from "@/lib/salesCall/library/newLead";
import { NO_SHOW_PARTS } from "@/lib/salesCall/library/noShows";
import { REACH_OUT_PARTS } from "@/lib/salesCall/library/reachOut";
import { REVIEW_PARTS } from "@/lib/salesCall/library/review";
import { OBJECTION_PAGES, type ObjectionId } from "@/lib/salesCall/objections";
import { PHASES, READ_BACK, STANDARD_STEPS, STEPS_INTRO } from "@/lib/salesCall/script";

import { CLOSE_OBJECTIONS, REBOOKING_OBJECTIONS, objectionList } from "./objections";
import type { SimCallType } from "./types";

/**
 * The script beside a practice call: the same words as Get Clients →
 * Scripts, page by page, so a coach can read it out as they go. Prep notes
 * and the why are left out; the call screen's help panel has those.
 */

export type ScriptPage = {
  id: string;
  title: string;
  /** One line under the title, as on the script page. */
  goal: string;
  blocks: Block[];
  /** A reference page (other objections, say), folded until the coach opens it or says a line from it. */
  folded?: boolean;
};

/** Sections whose heading is prep, not words for the call. */
const PREP = new Set(["Before you dial", "Before you call", "Who you're looking for", "Your notes for the review", "Prepare", "The shape of the call", "The plan", "What to send"]);

function forCall(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let skipping = false;
  for (const b of blocks) {
    if (b.type === "heading") skipping = PREP.has(b.text);
    if (skipping) continue;
    // The live call screen writes these from its notes; here they're the standard words.
    if (b.type === "live") {
      if (b.part === "readback") out.push(say(READ_BACK), say("Have I understood that correctly?"));
      else out.push(say(STEPS_INTRO), ...STANDARD_STEPS.map((t) => say(t)));
      continue;
    }
    out.push(b);
  }
  // A heading with nothing left to show under it (only links or the why) goes too.
  const shown = (b: Block) => !["heading", "info", "see", "video", "bossPro", "levers", "playbook", "goto"].includes(b.type);
  return out.filter((b, i) => {
    if (b.type !== "heading") return true;
    for (let j = i + 1; j < out.length && out[j].type !== "heading"; j++) if (shown(out[j])) return true;
    return false;
  });
}

function part<T extends { id: string; title: string; goal: string; blocks: Block[] }>(parts: T[], id: string): ScriptPage {
  const p = parts.find((x) => x.id === id)!;
  return { id, title: p.title, goal: p.goal, blocks: forCall(p.blocks) };
}

function closePage(id: ObjectionId, folded = false): ScriptPage {
  const page = OBJECTION_PAGES.find((p) => p.id === id)!;
  return { id: `close-${id}`, title: page.title, goal: page.summary, blocks: forCall(page.blocks), folded };
}

/** For each part of the call, the script page it starts on. Later parts in the same page share it. */
const PART_PAGE: Record<string, string> = {
  "review:open": "open",
  "review:score": "score",
  "review:money": "money",
  "review:coach": "coach",
  "review:book": "switch",
  "roadmap:discovery": "discovery",
  "roadmap:pitch": "pitch",
  "roadmap:investment": "investment",
  "roadmap:objections": "close-think",
  "roadmap:next": "close-payment",
  "new-lead:open": "open",
  "new-lead:situation": "situation",
  "new-lead:goal": "goal",
  "new-lead:cost": "goal",
  "new-lead:book": "book",
};

export function pageForPart(call: SimCallType, partId: string): string | null {
  if (call.drill) return partId;
  return PART_PAGE[`${call.id}:${partId}`] ?? null;
}

export function callScript(call: SimCallType, opts: { startPart: string | null; objections: string[] }): ScriptPage[] {
  const rebooking = REBOOKING_OBJECTIONS.map((o) => ({ id: o.id, title: `"${o.says}"`, goal: "", blocks: forCall(o.blocks), folded: true }));
  let pages: ScriptPage[];
  switch (call.id) {
    case "cold":
      pages = [part(REACH_OUT_PARTS, "cold-call")];
      break;
    case "new-lead":
      pages = ["open", "situation", "goal", "book"].map((id) => part(NEW_LEAD_PARTS, id));
      break;
    case "review":
      pages = ["open", "score", "money", "coach", "switch"].map((id) => part(REVIEW_PARTS, id));
      break;
    case "roadmap":
      pages = [
        ...["discovery", "pitch", "investment"].map((id) => part(PHASES, id)),
        ...CLOSE_OBJECTIONS.map((o) => closePage(o.id as ObjectionId, o.id !== "think")),
        closePage("payment"),
        closePage("booknext", true),
      ];
      break;
    case "booking-objections":
    case "close-objections": {
      const list = objectionList(call.drill!);
      pages = opts.objections
        .map((id) => list.find((o) => o.id === id))
        .filter((o) => Boolean(o))
        .map((o) => ({ id: o!.id, title: call.drill === "close" ? o!.label : `"${o!.says}"`, goal: o!.means, blocks: forCall(o!.blocks) }));
      break;
    }
    case "no-show":
      pages = [part(NO_SHOW_PARTS, "no-show"), ...rebooking];
      break;
    case "reschedule":
      pages = [part(NO_SHOW_PARTS, "reschedule"), ...rebooking];
      break;
  }
  // Starting partway: the script starts there too.
  const from = opts.startPart ? pageForPart(call, opts.startPart) : null;
  const at = from ? pages.findIndex((p) => p.id === from) : -1;
  return at > 0 ? pages.slice(at) : pages;
}

/**
 * How the script expects the owner to answer at points in the call: its
 * answer toggles ("Yes", "Just send me something") and the owner's own
 * lines. The prompt uses them so the owner answers as briefly as the script
 * assumes, not like a coaching client thinking out loud.
 */
export function expectedReplies(pages: ScriptPage[]): string[] {
  const out: string[] = [];
  // Most toggles describe the moment for the coach ("Their pick doesn't match"); keep only what an owner would say.
  const reply = (label: string, short = true) => {
    const quoted = label.match(/"[^"]+"/g);
    if (quoted) out.push(...quoted);
    else if (short && /^(yes|no|not sure|not now|clear yes|bad timing|going well)\b/i.test(label)) out.push(label.replace(/\s*\(.*\)$/, ""));
  };
  const walk = (blocks: Block[]) =>
    blocks.forEach((b) => {
      // Their replies, unless it's a stage direction like "The owner gives you the partner objection."
      if (b.type === "they" && !/^the owner\b/i.test(b.text)) out.push(b.text);
      if (b.type === "response") {
        reply(b.label);
        walk(b.blocks);
      }
    });
  pages.forEach((p) => {
    reply(p.title, false);
    walk(p.blocks);
  });
  return Array.from(new Set(out.map((t) => t.trim()).filter((t) => t.length <= 90))).slice(0, 24);
}

/** Words that carry meaning, for matching what the coach said to the script. Gaps and fill-ins are left out. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]|\{[a-z_]+\}/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/**
 * How closely the coach said this line, 0 to 1: the share of its words in one
 * of their lines (or two in a row, since speech gets split), in any order.
 * Coaches put scripts in their own words, so long lines need fewer of them.
 */
export function lineMatch(scriptLine: string, coachLines: string[]): number {
  const want = Array.from(new Set(words(scriptLine)));
  if (want.length < 2) return 0;
  let best = 0;
  for (let i = 0; i < coachLines.length; i++) {
    const heard = new Set(words(`${coachLines[i]} ${coachLines[i + 1] ?? ""}`));
    best = Math.max(best, want.filter((w) => heard.has(w)).length / want.length);
  }
  return best;
}

/** What counts as said. A short line ("So that's your constraint") needs nearly all its words, or two words in passing would tick it. */
export function saidEnough(scriptLine: string, match: number): boolean {
  const n = new Set(words(scriptLine)).size;
  return match >= (n > 30 ? 0.3 : n < 6 ? 0.8 : 0.45);
}

export function saidLine(scriptLine: string, coachLines: string[]): boolean {
  return saidEnough(scriptLine, lineMatch(scriptLine, coachLines));
}

/**
 * One line to say, in reading order. branch: the answer toggle it sits in.
 * group: the set of answers that toggle belongs to. optional: under an
 * "Optional: ..." heading, so it's ticked if said but never next.
 */
export type ScriptLine = { key: string; text: string; page: number; branch: string | null; group: string | null; tone: Tone | null; optional: boolean };

export function scriptLines(pages: ScriptPage[]): ScriptLine[] {
  const out: ScriptLine[] = [];
  let optional = false;
  const walk = (blocks: Block[], page: number, path: string, branch: string | null, group: string | null, tone: Tone | null) =>
    blocks.forEach((b, i) => {
      if (b.type === "heading") optional = /^optional\b/i.test(b.text);
      if (b.type === "say") out.push({ key: `${path}.${i}`, text: b.text, page, branch, group, tone, optional });
      if (b.type === "response") walk(b.blocks, page, `${path}.${i}`, `${path}.${i}`, path, b.tone);
    });
  pages.forEach((p, i) => {
    optional = false;
    walk(p.blocks, i, `${i}`, null, null, null);
  });
  return out;
}

/** How far ahead of the last line said a loose match may land. Further than this needs near word for word. */
const LOOK_AHEAD = 8;

/**
 * Where the coach is in the script: the lines they've said, the answers
 * they've taken, and the line to say next. Walks the script in order, so a
 * few shared words far ahead can't drag the place forward. When the owner's
 * answer comes next, it follows the usual one (green) until the coach says a
 * line from another. After a skip ahead, the part they jumped to wins.
 */
export function followScript(pages: ScriptPage[], heard: string[], stagePage: number, plain: (text: string) => string = (t) => t) {
  const all = scriptLines(pages);
  const said = new Set<string>();
  let at = -1;
  all.forEach((l, i) => {
    const text = plain(l.text);
    const match = lineMatch(text, heard);
    if (!saidEnough(text, match)) return;
    if (i > at + LOOK_AHEAD && match < 0.75) return;
    said.add(l.key);
    at = Math.max(at, i);
  });
  const saidBranches = new Set(all.filter((l) => l.branch && said.has(l.key)).map((l) => l.branch!));
  const stageStart = all.findIndex((l) => l.page === Math.max(0, stagePage));
  const startAt = stagePage > (all[at]?.page ?? -1) ? Math.max(0, stageStart) : at + 1;
  const ahead = all.slice(startAt).filter((l) => !l.optional);
  const first = ahead[0];
  let guess: string | null = null;
  if (first?.branch && !saidBranches.has(first.branch)) {
    const choices = ahead.filter((l) => l.group === first.group);
    guess = (choices.find((l) => l.tone === "green") ?? first).branch;
  }
  const openBranches = guess ? new Set([...saidBranches, guess]) : saidBranches;
  const next = ahead.find((l) => !l.branch || openBranches.has(l.branch))?.key ?? null;
  return { all, said, openBranches, next };
}
