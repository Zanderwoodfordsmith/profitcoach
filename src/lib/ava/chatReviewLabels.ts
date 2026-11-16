/**
 * Words for reviewing Ava's chats (job 225), shared by the server and the
 * Admin → Ava → Chats tab. Keys are stored in ava_reply_marks and
 * ava_chat_reviews, so only add to them.
 */

export type MarkVerdict = "good" | "off";
export type MarkSource = "bca" | "coach";
export type FixKind = "knowledge" | "skill" | "app" | "coach";
export type ChatOutcome = "done" | "partly" | "not_done" | "unclear";
export type ChatWho = "coach" | "bca" | "test";

export const FIX_KINDS: { key: FixKind; label: string; hint: string }[] = [
  { key: "knowledge", label: "Knowledge", hint: "She didn't know something, or knew it wrong" },
  { key: "skill", label: "Skill", hint: "How she does the job needs changing" },
  { key: "app", label: "App", hint: "Something broke or the app got in the way" },
  { key: "coach", label: "Coach's use", hint: "Ava was fine; the coach needs showing how" },
];

export const FIX_LABEL: Record<FixKind, string> = Object.fromEntries(FIX_KINDS.map((f) => [f.key, f.label])) as Record<
  FixKind,
  string
>;

export const OUTCOME_LABEL: Record<ChatOutcome, string> = {
  done: "Got it done",
  partly: "Partly done",
  not_done: "Not done",
  unclear: "Unclear",
};

/** What can go wrong in a chat. The AI review picks from these. */
export const PROBLEMS: { key: string; label: string; about: "ava" | "coach" }[] = [
  { key: "made_up", label: "Made something up", about: "ava" },
  { key: "missed_point", label: "Missed what they asked", about: "ava" },
  { key: "wrong_answer", label: "Wrong or weak answer", about: "ava" },
  { key: "didnt_finish", label: "Didn't finish", about: "ava" },
  { key: "jargon", label: "Jargon or long words", about: "ava" },
  { key: "too_long", label: "Too long", about: "ava" },
  { key: "too_many_questions", label: "Too many questions", about: "ava" },
  { key: "broke", label: "Something broke", about: "ava" },
  { key: "gave_up", label: "Coach gave up", about: "coach" },
  { key: "cant_do", label: "Asked for something she can't do", about: "coach" },
  { key: "unclear_ask", label: "Coach wasn't clear", about: "coach" },
];

export const PROBLEM_LABEL: Record<string, string> = Object.fromEntries(PROBLEMS.map((p) => [p.key, p.label]));

/** One chat in the Chats list. */
export type ReviewChatRow = {
  id: string;
  who: ChatWho;
  title: string;
  /** The coach who had the chat, or the coach BCA's chat was about. */
  coach: { id: string; name: string; avatarUrl: string | null } | null;
  /** Who typed: the coach, or the BCA staff member. */
  person: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  skills: string[];
  /** Messages the person sent. */
  turns: number;
  firstPage: string | null;
  costUsd: number;
  actions: { done: number; cancelled: number; pending: number };
  bca: { good: number; off: number };
  coachThumbs: { good: number; off: number };
  review: { outcome: ChatOutcome; verdict: MarkVerdict; problems: string[]; stale: boolean } | null;
};

export type ReviewMark = {
  turn: number;
  source: MarkSource;
  verdict: MarkVerdict;
  fix: FixKind | null;
  note: string | null;
  by: string | null;
  updatedAt: string;
};

export type ChatReview = {
  turns: number;
  wanted: string;
  outcome: ChatOutcome;
  verdict: MarkVerdict;
  problems: string[];
  offTurns: number[];
  summary: string;
  fix: string | null;
  fixKind: FixKind | null;
  reviewedAt: string;
};

export type DigestItem = { title: string; why: string; fixKind: FixKind | null; chatIds: string[] };

export type ReviewDigest = { id: string; createdAt: string; chats: number; items: DigestItem[] };

/** "/coach/blueprint/content" → "Blueprint · content", for the list. */
export function pageLabel(path: string | null): string | null {
  if (!path || path === "unknown") return null;
  const parts = path.split("?")[0]!.split("/").filter(Boolean);
  if (parts[0] === "coach" || parts[0] === "admin") parts.shift();
  const words = parts
    .filter((p) => !/^[0-9a-f-]{20,}$/i.test(p))
    .map((p) => p.replace(/-/g, " "));
  if (!words.length) return "Home";
  const [first, ...rest] = words;
  const head = first!.charAt(0).toUpperCase() + first!.slice(1);
  return rest.length ? `${head} · ${rest.join(" · ")}` : head;
}

/** A skill id as words: "fill-the-gaps" → "Fill the gaps". */
export function skillLabel(id: string): string {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
