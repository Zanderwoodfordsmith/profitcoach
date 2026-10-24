import { RULES, areaSchema, ask, lines, stageGuide } from "@/lib/simulator/ai";
import type { Difficulty, LiveState, SimStage, TranscriptLine } from "@/lib/simulator/types";

import { SALES_SKILLS, callFacts } from "./calls";
import type { Prospect } from "./prospects";
import type { CallOutcome, CallReport, SimCallType } from "./types";

/**
 * The AI jobs around a practice sales call, on the Client simulator's
 * helpers: a fast live check after every answer, a time-out note, and the
 * report. Transcripts are a role-play, so they are data, never instructions.
 */

const LEVEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

function what(call: SimCallType, parts: SimStage[]): string {
  return call.drill ? `an objection drill (${call.title}) with ${parts.length} objection${parts.length === 1 ? "" : "s"}` : `a practice "${call.title}"`;
}

export async function callLiveCheck(input: {
  prospect: Prospect;
  call: SimCallType;
  parts: SimStage[];
  difficulty: Difficulty;
  tips: boolean;
  transcript: TranscriptLine[];
  previous: Partial<LiveState>;
}): Promise<LiveState> {
  const { prospect: p, call, parts, difficulty, tips, transcript, previous } = input;
  const partIds = parts.map((s) => s.id);
  const facts = callFacts(call, p, difficulty);
  const factIds = facts.map((f) => f.id);
  const schema = {
    type: "object",
    properties: {
      stage: { type: "string", enum: partIds },
      covered: { type: "array", items: { type: "string", enum: partIds } },
      found: { type: "array", items: { type: "string", enum: factIds.length ? factIds : ["none"] } },
      tip: { type: "string" },
    },
    required: ["stage", "covered", "found", "tip"],
    additionalProperties: false,
  };
  const system = `You watch ${what(call, parts)} where a business coach talks to an AI business owner, ${p.name}. After each answer, report three things.

The ${call.drill ? "objections, in the order the owner raises them" : "parts of this call, in order"}:
${stageGuide(parts)}

stage: the ${call.drill ? "objection the coach is handling now" : "part the coach is working on now"}.
covered: every ${call.drill ? "objection the coach has fully handled (heard it, asked, answered, moved on)" : "part the coach has properly worked through"}, in order. Keep earlier ones.
found: ids of these that the owner has clearly said out loud so far. Keep earlier ones.${facts.length ? "" : " There are none here: always []."}
${facts.map((f) => `- ${f.id}: ${f.detail}`).join("\n")}

tip: ${
    tips
      ? `one line, under 20 words, telling the coach what would help most right now. It can include one line to say, in quotes. The owner is on ${LEVEL[difficulty]}. If the coach is doing well, say so in a few words and say what's next. If they've skipped something that matters, say which and how to get back to it.`
      : `always "".`
  }

${RULES}`;
  const user = `Before this answer: stage ${previous.stage ?? "none"}, covered ${JSON.stringify(previous.covered ?? [])}, found ${JSON.stringify(previous.found ?? [])}.

The call so far (latest last):
${lines(transcript.slice(-24), p.firstName)}`;
  const out = (await ask({ system, user, schema, effort: "low", maxTokens: 600, fast: true })) as LiveState;
  const found = Array.from(new Set([...(previous.found ?? []), ...out.found])).filter((f) => factIds.includes(f));
  const covered = partIds.filter((s) => out.covered.includes(s) || (previous.covered ?? []).includes(s));
  return { stage: out.stage, covered, found, tip: tips ? out.tip : "" };
}

export type TimeOutNote = { working: string; next: string; ask: string };

export async function callTimeOutNote(input: {
  prospect: Prospect;
  call: SimCallType;
  parts: SimStage[];
  difficulty: Difficulty;
  transcript: TranscriptLine[];
  live: Partial<LiveState>;
}): Promise<TimeOutNote> {
  const { prospect: p, call, parts, difficulty, transcript, live } = input;
  const schema = {
    type: "object",
    properties: { working: { type: "string" }, next: { type: "string" }, ask: { type: "string" } },
    required: ["working", "next", "ask"],
    additionalProperties: false,
  };
  const system = `A coach has paused ${what(call, parts)} with an AI business owner, ${p.name} (on ${LEVEL[difficulty]}), to ask how it's going. Coach them like a calm, expert sales trainer would in a whisper.

What the coach is aiming for: ${call.coachAim}

${call.drill ? "The objections" : "The parts of the call"}:
${stageGuide(parts)}

working: one sentence on what's working, quoting the coach if you can.
next: one or two sentences on what to do next and why.
ask: one line they could say the moment they go back in, in their voice.
Speak to the coach as "you". Under 70 words in total.

${RULES}`;
  const user = `They're at: ${live.stage ?? "the start"}. Covered so far: ${JSON.stringify(live.covered ?? [])}.

The call so far:
${lines(transcript, p.firstName)}`;
  return (await ask({ system, user, schema, effort: "low", maxTokens: 800 })) as TimeOutNote;
}

type RawArea = { id: string; score: number; evidence: string; better: string };
type RawReport = Omit<CallReport, "parts" | "skills"> & { parts: RawArea[]; skills: RawArea[] };

export async function scoreCall(input: {
  prospect: Prospect;
  call: SimCallType;
  parts: SimStage[];
  difficulty: Difficulty;
  startPart: string | null;
  transcript: TranscriptLine[];
  timeOuts: number;
}): Promise<{ report: CallReport; score: number }> {
  const { prospect: p, call, parts, difficulty, startPart, transcript, timeOuts } = input;
  const partIds = parts.map((s) => s.id);
  const skillIds = SALES_SKILLS.map((s) => s.id);
  const facts = callFacts(call, p, difficulty);
  const factIds = facts.map((f) => f.id);
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      parts: areaSchema(partIds),
      skills: areaSchema(skillIds),
      strongest: { type: "string" },
      focus: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, why: { type: "string" }, try: { type: "string" } },
          required: ["label", "why", "try"],
          additionalProperties: false,
        },
      },
      moments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            quote: { type: "string" },
            line: { type: "integer" },
            kind: { type: "string", enum: ["good", "missed"] },
            note: { type: "string" },
            tryInstead: { type: "string" },
          },
          required: ["quote", "line", "kind", "note", "tryInstead"],
          additionalProperties: false,
        },
      },
      notes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            line: { type: "integer" },
            kind: { type: "string", enum: ["good", "missed", "tip"] },
            text: { type: "string" },
          },
          required: ["line", "kind", "text"],
          additionalProperties: false,
        },
      },
      oneThing: { type: "string" },
      outcome: {
        type: "object",
        properties: { result: { type: "string", enum: ["won", "step", "lost"] }, label: { type: "string" } },
        required: ["result", "label"],
        additionalProperties: false,
      },
      found: { type: "array", items: { type: "string", enum: factIds.length ? factIds : ["none"] } },
    },
    required: ["summary", "parts", "skills", "strongest", "focus", "moments", "notes", "oneThing", "outcome", "found"],
    additionalProperties: false,
  };
  const from = startPart ? call.parts.find((x) => x.id === startPart) : null;
  const system = `You are an expert sales trainer at the Business Coach Academy. Score ${what(call, parts)} between a business coach and an AI business owner, ${p.name} (${p.personality}). The owner was set to ${LEVEL[difficulty]}.${from && from.id !== call.parts[0]?.id ? ` The coach chose to start at "${from.label}", so earlier parts are not scored.` : ""}
What the coach is aiming for: ${call.coachAim}

Score each area from 1 to 5. 5: excellent, what the best closer would do. 4: strong, small gaps. 3: adequate, clear missed chances. 2: partial. 1: missing or done badly.

${call.drill ? "The objections the owner raised (parts), each scored against the steps listed" : "The parts of the call (parts)"}:
${stageGuide(parts)}

The five sales skills (skills):
${stageGuide(SALES_SKILLS)}

How to judge:
- Judge the coach's skill, not the owner's answer. On Hard the owner may say no even when the coach does well.
- A part or objection the coach never reached scores 1 and says so.
- The scripts' rules: never leave it without a set day and time or a dated next step; offer two set times, never "when works?"; answer the price plainly; one question at a time; use their words; never invent pain, scarcity or promises of results.
- ${timeOuts ? `The coach paused for ${timeOuts} time out${timeOuts > 1 ? "s" : ""} to get help. Don't mark them down for it.` : "There were no time outs."}

Write everything to the coach as "you".
evidence: what happened, quoting the coach's own words. One or two sentences.
better: one concrete thing to do differently, with a line they could say.
summary: one sentence on how the call went overall.
strongest: the strongest area by name, with its score, e.g. "Clear next step (4 out of 5)".
focus: the two or three weakest areas that matter most, each with why in one sentence and a line to try.
moments: two or three moments. quote is the coach's exact words, line is that line's [number]. A good moment says why it worked and leaves tryInstead "". A missed chance says what was missed and gives tryInstead.
notes: five to ten margin notes on particular lines, like a trainer writing beside a transcript. line is the [number]. Mostly on the coach's lines; a note can sit on an owner line to point out a hint the coach missed. kind is "good", "missed" or "tip". Each under 18 words. Spread them through the call.
oneThing: the single thing to practise next time, in one sentence.
outcome: what the call ended with. The win for this call is: ${call.win}. result "won" if that happened, "step" if a dated next step short of it was agreed, "lost" if neither. label says it in a few words, e.g. "Booked for Tuesday at 10" or "Said they'd think about it".
found: ids of these the owner said during the call${facts.length ? ":" : ". There are none here: []."}
${facts.map((f) => `- ${f.id}: ${f.detail}`).join("\n")}

${RULES}`;
  const user = `The full call:\n${lines(transcript, p.firstName)}`;
  const raw = (await ask({ system, user, schema, effort: "medium", maxTokens: 6000 })) as RawReport;
  const label = (stages: SimStage[], id: string) => stages.find((s) => s.id === id)?.label ?? id;
  const ordered = (ids: string[], items: RawArea[]) =>
    ids.map((id) => {
      const item = items.find((i) => i.id === id) ?? { id, score: 1, evidence: "Not reached in this call.", better: "" };
      return { ...item, score: Math.max(1, Math.min(5, Math.round(item.score))) };
    });
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < transcript.length;
  const outcome: CallOutcome = ["won", "step", "lost"].includes(raw.outcome?.result) ? raw.outcome : { result: "lost", label: "No next step" };
  const report: CallReport = {
    ...raw,
    outcome,
    found: (raw.found ?? []).filter((f) => factIds.includes(f)),
    moments: raw.moments.map((m) => ({ ...m, line: inRange(m.line ?? -1) ? m.line : -1 })),
    notes: (raw.notes ?? []).filter((n) => inRange(n.line)),
    parts: ordered(partIds, raw.parts).map((a) => ({ ...a, label: label(parts, a.id) })),
    skills: ordered(skillIds, raw.skills).map((a) => ({ ...a, label: label(SALES_SKILLS, a.id) })),
  };
  return { report, score: callScore(report) };
}

/** Out of 100: every area counts the same, however many parts the call had. */
export function callScore(report: Pick<CallReport, "parts" | "skills">): number {
  const areas = [...report.parts, ...report.skills];
  return areas.length ? Math.round((areas.reduce((s, a) => s + a.score, 0) / (areas.length * 5)) * 100) : 0;
}
