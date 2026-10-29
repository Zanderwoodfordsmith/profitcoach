/** One coach's done-for-you drafts, written for Zander to check before anything reaches the coach or LinkedIn. */
export type DraftPart = { now?: string; draft: string; why: string };

export type CoachDrafts = {
  slug: string;
  name: string;
  /** One line: who they are to an owner, e.g. "Board adviser to manufacturing owners". */
  positioning: string;
  market: string;
  /** The real results the drafts use, as recorded in their Blueprint or calls. */
  proofUsed: string[];
  /** What's missing, and the one question that would fill it. Never invented. */
  gaps: { gap: string; ask: string }[];
  linkedin: {
    headline: DraftPart;
    about: DraftPart;
    /** The About in the older BCA layout (bold headers, emojis), as options beside the plain one until Zander picks. */
    aboutStyled?: { label: string; draft: string; why: string }[];
    featured: DraftPart;
    experience: DraftPart;
    banner?: DraftPart;
  };
  connection: { a: DraftPart; b: DraftPart };
  followUps: { step: string; timing: string; a: string; b?: string; why: string }[];
  openProfile: DraftPart;
  /** Things the writer is unsure of, for Zander to decide. */
  unsure: string[];
};

/** The rules every draft is written to, shown at the top of each coach's page. */
export const RULEBOOK: { rule: string; source: string }[] = [
  { rule: "Every message can be answered in a few seconds: a yes or no, or a choice of two.", source: "Pam's Starbucks rule" },
  { rule: "The coach's own result goes in the connection note, with a number and a timeframe. Fewer people accept, more of them meet.", source: "100k requests: 0.31 meetings per 100 with proof, 0.12 blank" },
  { rule: "Name a specific outcome the owner wants, prove it, and make the next step tiny.", source: "Hormozi: dream outcome, likelihood, time, effort" },
  { rule: "Lead with growth or time. Profit squeeze only as a test version.", source: "Our replies: growth 65% interested, too busy 45%" },
  { rule: "Short: notes under 200 characters, follow-ups under 300. Only the Open Profile message is long.", source: "Best practice" },
  { rule: "Never the BOSS Score link cold, \"Free Discovery Call\", \"just checking\", fake scarcity or a link in the note. The BOSS Score comes after a reply.", source: "Our data" },
  { rule: "Two versions of every step, so the replies pick the winner.", source: "Test, don't guess" },
  { rule: "Real facts only. A missing result is marked as a gap with the question to ask, never made up.", source: "BCA rule" },
  { rule: "Discreet coaches are never called a coach and never say \"book a call\".", source: "Mark, 28 Oct" },
  { rule: "Profiles build the buyer's beliefs in order: \"I do that\" (their pains), \"it wasn't my fault, because…\", a simple named system (what it is, not how), proof from people like them, and \"anyone can do this\".", source: "Jon Street, 12 buyer beliefs" },
  { rule: "Write for owner-led firms: a team and managers, not a board.", source: "Zander, 28 Oct" },
];

/** LinkedIn has no bold, so headers use Unicode sans-serif bold letters. Use it for short headers only: screen readers and search skip it. */
export function lnBold(text: string): string {
  return [...text]
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
      return ch;
    })
    .join("");
}
