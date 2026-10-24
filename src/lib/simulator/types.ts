/**
 * Client simulator: every practice call is one client, in one situation, at
 * one difficulty. Clients and situations are content; the difficulty dial is
 * shared by all of them.
 */

export type Difficulty = "easy" | "medium" | "hard";

export type SimMode = "practice" | "assessment";

/** Something the client knows and only says when the coach asks the right question. */
export type SimFact = {
  id: string;
  /** Short, for the "Found so far" tile. */
  label: string;
  /** Where to dig, shown on the tile until it's found. Never the answer. */
  hint: string;
  /** What the client knows, in full, for the prompt. */
  detail: string;
};

/** The kinds of pushback a client leans on, each with its own advice in the tips. */
export type PushbackKind =
  | "blaming-outside"
  | "overwhelm"
  | "legacy"
  | "controller"
  | "fix-everything"
  | "shiny-object"
  | "too-busy";

export type SimClient = {
  id: string;
  name: string;
  firstName: string;
  age: number;
  role: string;
  business: string;
  place: string;
  /** Portrait in /public. */
  face: string;
  /** ElevenLabs voice. */
  voiceId: string;
  /** Speaking speed for this voice (ElevenLabs takes 0.7 to 1.2), so every client talks at a similar, brisk pace. */
  speed: number;
  /** "The Sceptic". */
  personality: string;
  /** One line for the card: their problem, as a coach would say it. */
  line: string;
  /** The paragraph a coach reads before starting. Only what the owner would say in the first minute. */
  brief: string;
  /** Who they are, for the prompt. Written to the client ("You are ..."). */
  character: string;
  facts: SimFact[];
  /** How they come across, whatever the level. */
  behaviours: string[];
  pushback: { kind: PushbackKind; medium: string[]; hard: string[] };
  /** Lines when a coach is doing well: the client starts to open up. */
  openingUp: string[];
  /** Lines a coach earns with real skill. */
  breakthroughs: string[];
  /** For sales calls: how they scored on the BOSS Score. */
  boss: { level: string; lowest: [string, string]; constraint: string };
  /** For follow-ups and onboarding: something they would plausibly have agreed last time. */
  lastTime: string;
  /** Set on clients a coach made with "Create your own". */
  custom?: CustomInfo;
};

export type CustomInfo = {
  /** The sim_custom_clients row. The client's id is "c-" plus this. */
  rowId: string;
  ownerName: string | null;
  mine: boolean;
  isReal: boolean;
  shared: boolean;
  status: "draft" | "ready";
};

/** One of the five parts of a session the live bar tracks and the report scores. */
export type SimStage = {
  id: string;
  label: string;
  /** What the coach is trying to do in this part. */
  aim: string;
  /** What a 5 looks like. */
  signs: string[];
  /** Common misses. */
  misses: string[];
  /** Questions that work here. */
  questions: string[];
};

export type SituationGroup = "coaching" | "onboarding" | "moments" | "follow-up";

export type SimSituation = {
  id: string;
  group: SituationGroup;
  title: string;
  /** One line for the picker. */
  line: string;
  /** Rough length of a practice run. */
  minutes: number;
  /** What the coach should come away with, for the scorer and the brief. */
  coachAim: string;
  stages: [SimStage, SimStage, SimStage, SimStage, SimStage];
  /** Needs an earlier scored session with the same client. */
  needsPrevious?: boolean;
  /** Only certification uses these. */
  assessable?: boolean;
};

/**
 * at: seconds since the session started. part and t: which recording (calls
 * are split by time outs) and seconds into it, for the player.
 */
export type TranscriptLine = { role: "coach" | "client"; text: string; at?: number; part?: number; t?: number };

export type LiveState = {
  /** The stage the coach is in now. */
  stage: string;
  /** Stages the coach has covered so far, in order. */
  covered: string[];
  /** Fact ids the client has given so far. */
  found: string[];
  /** One line of advice, or "". */
  tip: string;
  /** The weak spot this practice session targets, if any. */
  focus?: string;
  /** The transcript's times have been matched to ElevenLabs' recording. */
  aligned?: boolean;
};

export type ScoredArea = {
  id: string;
  label: string;
  score: number;
  /** What happened, quoting the coach where possible. */
  evidence: string;
  /** One concrete thing to do better. */
  better: string;
};

export type SimMoment = {
  /** The coach's words. */
  quote: string;
  /** Where in the transcript, or -1. Older reports don't have it. */
  line?: number;
  /** Good moment or missed chance. */
  kind: "good" | "missed";
  note: string;
  /** What to say instead, for missed chances. */
  tryInstead: string;
};

export type SimReport = {
  summary: string;
  stages: ScoredArea[];
  power: ScoredArea[];
  strongest: string;
  focus: { label: string; why: string; try: string }[];
  moments: SimMoment[];
  oneThing: string;
  /** What the client agreed to do, for a follow-up session. */
  agreedActions: string[];
  /** Facts the coach got the client to share. */
  found: string[];
  /** Short comments beside particular lines of the call, like an examiner's margin notes. Older reports don't have them. */
  notes?: SimNote[];
  /** Where each part of the session starts in the transcript, for the player's chapters. */
  chapters?: { stage: string; line: number }[];
  /** Certification: each examiner's total, before averaging. */
  passes?: number[];
  /** Set on a moment replay instead of the usual report. */
  replay?: { verdict: "better" | "same" | "not-yet"; note: string; tryNext: string };
};

export type SimNote = { line: number; kind: "good" | "missed" | "tip"; text: string };

export type SimSessionRow = {
  id: string;
  coach_id: string;
  client_id: string;
  situation_id: string;
  difficulty: Difficulty;
  tips: boolean;
  mode: SimMode;
  assessment_id: string | null;
  follows_session_id: string | null;
  status: "live" | "scoring" | "scored" | "abandoned";
  transcript: TranscriptLine[];
  live: Partial<LiveState>;
  conversation_ids: string[];
  time_outs: number;
  report: SimReport | null;
  score: number | null;
  reviewed_score: number | null;
  started_at: string;
  ended_at: string | null;
  replay_of: string | null;
  replay_line: number | null;
  shared_at: string | null;
  share_score: boolean;
  scoring_passes: number;
};

export type SimAssessmentRow = {
  id: string;
  coach_id: string;
  status: "in_progress" | "submitted" | "reviewed";
  average: number | null;
  passed: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  submitted_at: string | null;
};

/** What the voice call needs to start: ElevenLabs takes the prompt, the opening line and the voice per call. */
export type CallStart = {
  signedUrl: string;
  prompt: string;
  firstMessage: string;
  voiceId: string;
  /** Speaking speed; the coach's Quick setting raises it in the browser. */
  speed: number;
};
