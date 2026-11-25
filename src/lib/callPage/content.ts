/**
 * The words on a coach's first-call page (/call/[slug]). Stored in
 * coach_calendars.page.sales on the coach's discovery calendar. Anything left
 * out falls back to the default below, which follows Paul's Constraint Call page.
 */

export type CallPageItem = { title: string; text: string };
export type CallPageQuestion = { q: string; a: string };

export type CallPageContent = {
  hero: { light: string; strong: string; lede: string };
  why: { light: string; strong: string; body: string };
  book: { light: string; strong: string; line: string; points: string[] };
  done: { light: string; strong: string; intro: string; takeaways: CallPageItem[] };
  agenda: CallPageItem[];
  about: { light: string; strong: string; body: string; proof: string };
  fit: { light: string; strong: string; intro: string; forYou: string[]; notForYou: string[] };
  faq: CallPageQuestion[];
};

export type CallPageFacts = {
  /** "Hilary" */
  firstName: string;
  /** "Constraint Call" */
  callName: string;
  minutes: number;
};

export function defaultCallPage({ firstName, minutes }: CallPageFacts): CallPageContent {
  return {
    hero: {
      light: "Your business has one constraint.",
      strong: "Let's find it, and fix it first.",
      lede: `You and your team are putting in the work. Most of it is queuing up behind one thing. Find that, and the effort you already make starts to pay off. In ${minutes} minutes, I'll show you what it is.`,
    },
    why: {
      light: "Why more effort",
      strong: "hasn't moved it.",
      body: [
        "Another hire. A new system. A push on sales. Each one helped a bit, and still the business runs through you.",
        "Picture a line of work. One step is slower than the rest, and it sets the pace for all of it. Speed up any other step and the work just piles up in front of the slow one. An hour saved there is an hour saved everywhere.",
        "Every business has a slow step. It might be quoting, hiring, cash, a manager, or you.",
      ].join("\n\n"),
    },
    book: {
      light: `${minutes} minutes.`,
      strong: "One thing found.",
      line: "Every week the slow step stays, the work around it keeps piling up.",
      points: [`Free, one to one with ${firstName}`, "You keep the notes", "If I can't help, I'll tell you"],
    },
    done: {
      light: "The thinking's",
      strong: "already done for you.",
      intro: `You bring your numbers and an honest picture. The Profit System does the sorting. It checks the 10 areas of your business in a set order, from sales and cash to systems, your team and you, so we spend the ${minutes} minutes on the answer instead of guessing where to look.`,
      takeaways: [
        { title: "The one thing holding you back", text: "Named plainly, from your own numbers." },
        {
          title: "The one to three things to do next",
          text: "In the order to do them, so the first fix makes the next one easier.",
        },
        { title: "Notes you keep", text: "Yours whether we work together or not." },
      ],
    },
    agenda: [
      { title: "Where your business is now", text: "Your score and your numbers." },
      { title: "Where you want it to be", text: "The profit, the time and the team you want." },
      { title: "What's holding it back", text: "The one thing that sets the pace for the rest." },
      { title: "What to do next", text: "One to three things, whether we work together or not." },
    ],
    about: {
      light: "Why talk",
      strong: `to ${firstName}?`,
      body: "",
      proof: "",
    },
    fit: {
      light: "Is this for you?",
      strong: "Be honest, and we get further.",
      intro: `I ask one thing: tell me where the business really is. The more specific you are, the more useful the ${minutes} minutes.`,
      forYou: [
        "You own a UK business with a team",
        "Every decision and problem still lands on you",
        "You're busy, but the profit doesn't show it",
        "You'll do your part and want results you can measure",
      ],
      notForYou: [
        "You aren't willing to change how you work yourself",
        "You want someone to take the business off your hands",
        "You're looking for a quick fix with no work from the team",
      ],
    },
    faq: [
      {
        q: "Do I need to take the BOSS Score first?",
        a: "It helps. If you've taken it, we start with your scores. If not, bring your rough numbers and we work from those.",
      },
      {
        q: "What should I bring?",
        a: "Your rough numbers (sales, profit, team size) and the thing that bothers you most right now.",
      },
      {
        q: "Is it a sales pitch?",
        a: `It's ${minutes} minutes on your business. If there's a fit, we talk about working together at the end, and you'll know the full fee before you commit to anything. If there isn't, you keep the notes and the plan.`,
      },
      { q: "What if you can't help?", a: "I'll tell you, and where I can, I'll point you to someone who can." },
    ],
  };
}

const str = (v: unknown, max = 1200) => (typeof v === "string" ? v.slice(0, max) : undefined);

function strList(v: unknown, fallback: string[], max = 8): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((x): x is string => typeof x === "string").slice(0, max).map((x) => x.slice(0, 240));
}

function itemList<T extends Record<string, string>>(v: unknown, fallback: T[], keys: (keyof T)[], max = 8): T[] {
  if (!Array.isArray(v)) return fallback;
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .slice(0, max)
    .map((x) => Object.fromEntries(keys.map((k) => [k, str(x[k as string], 600) ?? ""])) as T);
}

/** Saved words over the defaults, one field at a time; anything malformed falls back. */
export function parseCallPage(raw: unknown, facts: CallPageFacts): CallPageContent {
  const d = defaultCallPage(facts);
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | unknown>;
  const o = (k: string) => (r[k] && typeof r[k] === "object" ? (r[k] as Record<string, unknown>) : {});
  const hero = o("hero");
  const why = o("why");
  const book = o("book");
  const done = o("done");
  const about = o("about");
  const fit = o("fit");
  return {
    hero: {
      light: str(hero.light) ?? d.hero.light,
      strong: str(hero.strong) ?? d.hero.strong,
      lede: str(hero.lede) ?? d.hero.lede,
    },
    why: {
      light: str(why.light) ?? d.why.light,
      strong: str(why.strong) ?? d.why.strong,
      body: str(why.body, 3000) ?? d.why.body,
    },
    book: {
      light: str(book.light) ?? d.book.light,
      strong: str(book.strong) ?? d.book.strong,
      line: str(book.line) ?? d.book.line,
      points: strList(book.points, d.book.points, 4),
    },
    done: {
      light: str(done.light) ?? d.done.light,
      strong: str(done.strong) ?? d.done.strong,
      intro: str(done.intro) ?? d.done.intro,
      takeaways: itemList<CallPageItem>(done.takeaways, d.done.takeaways, ["title", "text"], 4),
    },
    agenda: itemList<CallPageItem>(r.agenda, d.agenda, ["title", "text"], 6),
    about: {
      light: str(about.light) ?? d.about.light,
      strong: str(about.strong) ?? d.about.strong,
      body: str(about.body, 3000) ?? d.about.body,
      proof: str(about.proof, 1500) ?? d.about.proof,
    },
    fit: {
      light: str(fit.light) ?? d.fit.light,
      strong: str(fit.strong) ?? d.fit.strong,
      intro: str(fit.intro) ?? d.fit.intro,
      forYou: strList(fit.forYou, d.fit.forYou, 6),
      notForYou: strList(fit.notForYou, d.fit.notForYou, 6),
    },
    faq: itemList<CallPageQuestion>(r.faq, d.faq, ["q", "a"], 8),
  };
}
