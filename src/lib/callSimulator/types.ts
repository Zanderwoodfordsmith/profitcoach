/**
 * Call simulator: practise the Scripts out loud. Every practice call is one
 * prospect (the Client simulator's six owners), one kind of call, one level,
 * and optionally a part to start at or the objections to face.
 */

import type { Difficulty, LiveState, ScoredArea, SimMoment, SimNote, SimStage, TranscriptLine } from "@/lib/simulator/types";
import type { Block } from "@/lib/salesCall/blocks";
import type { ScriptId } from "@/lib/salesCall/library";

export type { Difficulty, LiveState, ScoredArea, SimStage, TranscriptLine };

export type CallId =
  | "cold"
  | "new-lead"
  | "booking-objections"
  | "review"
  | "roadmap"
  | "close-objections"
  | "no-show"
  | "reschedule";

export type CallGroup = "book" | "review" | "roadmap" | "rebook";

/** Things the prospect knows about themselves that a good call gets out of them. */
export type FactKey = "business" | "whyNow" | "problem" | "cost" | "goal" | "personal" | "tried" | "decider" | "worry" | "reason" | "time";

export type SimCallType = {
  id: CallId;
  group: CallGroup;
  title: string;
  /** One line for the picker. */
  line: string;
  minutes: number;
  /** What the coach should achieve, for the scorer. */
  coachAim: string;
  /** A good result, said plainly. */
  win: string;
  /** The parts of the call, in order. A drill's parts are the objections the coach chose. */
  parts: SimStage[];
  /** The coach can start at any part. */
  startable?: boolean;
  /** An objection drill, and which list its objections come from. */
  drill?: "booking" | "close";
  /** What the coach should find out, shown as tiles. */
  facts: FactKey[];
  /** The script this call practises. */
  script: ScriptId;
};

/** One objection to practise, read from the Scripts so the two never drift. */
export type SimObjection = {
  id: string;
  /** Short, for the chip and the stage pill. */
  label: string;
  /** What the owner says. */
  says: string;
  /** What it usually means. */
  means: string;
  /** Lines from the script that work. */
  lines: string[];
  /** The script's answer to it, for the script panel on the call. */
  blocks: Block[];
};

/** What one owner is like as a buyer. Each pair is a tile label and the full detail for the prompt. */
export type ProspectFact = { label: string; detail: string };

export type ProspectProfile = Record<Exclude<FactKey, "time">, ProspectFact> & {
  /** When they're free, for booking. Found once a day and time is agreed. */
  diary: string;
  /** For a cold call: what they say when they pick up. */
  hello: string;
};

export type CallOutcome = {
  /** won: the call's win happened. step: a dated next step short of it. lost: neither. */
  result: "won" | "step" | "lost";
  /** "Booked for Tuesday at 10", in a few words. */
  label: string;
};

export type CallReport = {
  summary: string;
  parts: ScoredArea[];
  skills: ScoredArea[];
  strongest: string;
  focus: { label: string; why: string; try: string }[];
  moments: SimMoment[];
  notes: SimNote[];
  oneThing: string;
  outcome: CallOutcome;
  found: string[];
};

export type CallSessionRow = {
  id: string;
  coach_id: string;
  prospect_id: string;
  call_id: CallId;
  start_part: string | null;
  objections: string[];
  difficulty: Difficulty;
  tips: boolean;
  status: "live" | "scoring" | "scored" | "abandoned";
  transcript: TranscriptLine[];
  live: Partial<LiveState>;
  conversation_ids: string[];
  time_outs: number;
  report: CallReport | null;
  score: number | null;
  outcome: CallOutcome["result"] | null;
  started_at: string;
  ended_at: string | null;
};

export type CallSessionSummary = Omit<CallSessionRow, "transcript" | "live" | "conversation_ids" | "report">;
