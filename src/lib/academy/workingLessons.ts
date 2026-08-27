export type WorkingLessonId =
  | "core-client"
  | "understand-ideal-client"
  | "buyer-avatar"
  | "linkedin-profile"
  | "outreach-messages";

export type WorkingLessonKind = "working" | "sketch";

export type WorkingLessonDef = {
  id: WorkingLessonId;
  title: string;
  /** Real classroom lesson this would replace, when one exists. */
  classroomLessonId?: string;
  overviewMarkdown: string;
  guideMarkdown: string;
  introTitle: string;
  introSeconds: number;
  kind: WorkingLessonKind;
};

export const WORKING_COURSE = {
  id: "working-get-calls",
  title: "Get Calls",
} as const;

export const WORKING_LESSONS: WorkingLessonDef[] = [
  {
    id: "core-client",
    title: "How To Choose Your Core Client",
    classroomLessonId: "get-calls-ideal-clients-how-to-choose-your-core-client",
    kind: "working",
    introTitle: "Why you pick one core client",
    introSeconds: 28,
    overviewMarkdown: `This lesson locks who you market to first. It does not limit who you can take as a client. It focuses the outreach so the message feels written for them.

You check a recommendation pulled from your LinkedIn, tweak what is off, and lock it. That lock is what every later Get Calls lesson uses.`,
    guideMarkdown: `## The five criteria

1. **Most value** — Who can you help and prove it from your career or past clients?
2. **Pain** — Is the gap urgent, or a nice-to-have?
3. **Growing** — Are you fighting a shrinking market?
4. **Easy to find** — Can you build a list on LinkedIn Sales Navigator?
5. **Purchasing power** — Can they pay? Avoid startups and charities until you are at £10–20k/mo.

Weight sits on value first. Pick the market that would be most impressed by your strongest proof.

Picking a core client is not forever. Stay with it for six months before you change.`,
  },
  {
    id: "understand-ideal-client",
    title: "Understand Your Ideal Client",
    classroomLessonId: "get-calls-ideal-clients-understand-your-ideal-client",
    kind: "sketch",
    introTitle: "Why their words matter more than yours",
    introSeconds: 24,
    overviewMarkdown: `Once the core client is locked, this lesson fills the language they actually use: pains, vocabulary, and hooks.

You confirm a draft written from your locked market and any client stories you already have.`,
    guideMarkdown: `Work section by section: who they are, the words they use, the frustrations they say out loud, then the openers that land.

Never invent proof. If a story is thin, add one real example before you lock the language.`,
  },
  {
    id: "buyer-avatar",
    title: "Your Buyer Avatar",
    kind: "sketch",
    introTitle: "Write to one person, not a market",
    introSeconds: 22,
    overviewMarkdown: `The avatar is the person inside the market: a day in their life, what they fear, what they want instead, and the phrases to mirror in copy.

You check a one-page draft and lock the lines you will reuse.`,
    guideMarkdown: `Snapshot, top three pains, what they have already tried, what they want instead, objections to coaching, phrases to use.

Write to them (you / your), not about them.`,
  },
  {
    id: "linkedin-profile",
    title: "Set Up Your LinkedIn Profile",
    classroomLessonId: "get-calls-linkedin-optimization-set-up-your-linkedin-profile",
    kind: "sketch",
    introTitle: "Your profile has to finish the sentence",
    introSeconds: 26,
    overviewMarkdown: `Headline and About, written to the locked core client. Someone who gets your connection request will open this. It has to say why you are for them.

You pick a recommended variant and lock it.`,
    guideMarkdown: `Headline names who you help. About is written to them: pain in their words, the mechanism, proof you already have, a clear next step.

Offer variants. Let them choose.`,
  },
  {
    id: "outreach-messages",
    title: "First Campaign Messages",
    classroomLessonId: "get-calls-connector-launch-your-connector-campaign",
    kind: "sketch",
    introTitle: "Five messages, one conversation",
    introSeconds: 20,
    overviewMarkdown: `Connection note and follow-ups for the people who match the locked core client.

You confirm a recommended set, tweak a line, and lock the campaign copy.`,
    guideMarkdown: `Connection request, then a short sequence. Personalised to the market, pain, then proof. No spam cadence. No invented results.`,
  },
];

export function findWorkingLesson(id: string): WorkingLessonDef | undefined {
  return WORKING_LESSONS.find((lesson) => lesson.id === id);
}

export function firstWorkingLesson(): WorkingLessonDef {
  return WORKING_LESSONS[0];
}
