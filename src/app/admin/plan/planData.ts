/**
 * Admin → Plan: what we recommend for done-for-you campaigns (28 Oct 2026).
 * Static on purpose: edit the words here. Evidence: our own campaign replies
 * (scratchpad owner-replies report) and published outreach studies.
 */
import type { BadgeTone } from "@/components/ui/Badge";

export const PLAN_DATE = "28 Oct";

/** The short version at the top of the page: what our own data proves, what is still a guess, and the plan. */
export const WE_KNOW: { title: string; detail: string }[] = [
  {
    title: "The coach's own result in the connection note works",
    detail: "About three times the interest: 1.4 interested per 100 invites, against 0.5 without. In the 100k requests, a proof note got fewer people to accept but more to meet: 0.31 meetings per 100, against 0.12 for a blank invite.",
  },
  {
    title: "A quick question about their business beats a pitch",
    detail: "Short questions got the most replies. Sending the BOSS Score link cold did worst of anything we sent.",
  },
  {
    title: "Our lists reach too many people who aren't owners",
    detail: "Only 405 of 2,156 people who replied were owners or directors. Lists must find owners and directors only.",
  },
];

export const STILL_A_GUESS = "Growth or time, the exact wording, and the industry first line. Nobody knows which wins until we send both and count.";

export const THE_PLAN: string[] = [
  "Use the structure that's already proven: industry line, the coach's own result, a quick question. It's already in our campaign method.",
  "Send two versions of each campaign, split in half, and let about two weeks of replies pick the winner.",
  "Start with Peter Buglass, then Paul Hamnett, Peter Fairley and Octave.",
];

export const YOUR_DECISION = "Turn on Peter Buglass's campaign with two versions (his margin one and a growth one), once you've OK'd his LinkedIn draft?";

export const IN_ONE_LINE =
  "One proven message for every coach: an industry first line, the coach's own result, and a question about the owner's business. Three follow-ups, each a new angle. Lead with growth and time, not profit leaks.";

export const BOSS_SCORE_NOTE = {
  text: "The BOSS Score itself is fine. What did badly was sending the link or the offer cold in messages. Use it after an owner replies (for \"not now\" or \"interested\"), not in the cold sequence.",
  numbers: [
    { label: "As a connection note", value: "0.1 interested per 100 invites" },
    { label: "As a follow-up", value: "0.7% interested (89 follow-ups, 6,393 sends)" },
  ],
};

export type TemplateStep = { step: string; timing?: string; wordings: string[] };

export const CURRENT_TEMPLATE: { name: string; note: string; steps: TemplateStep[] } = {
  name: "Connector",
  note: "Every coach gets this one when they join.",
  steps: [
    { step: "Invite", timing: "Wait 2 days", wordings: ["No note."] },
    {
      step: "Message 1",
      timing: "Wait 3 days",
      wordings: [
        "Hi {{first_name}}, Most owners running a {{company}} business your size tell me revenue is growing but profit isn't following it. The issue is rarely sales. It's that nobody has ever scored the nine areas underneath the business to find where the money is actually leaking. Worth a chat? I've got two ideas for a business your size.",
      ],
    },
    {
      step: "Message 2",
      timing: "Wait 3 days",
      wordings: [
        "Forgot to mention, the last {{company}} owner I did this with found £180K sitting in his pricing, not his pipeline. Would it help to see what we changed?",
      ],
    },
    { step: "Message 3", timing: "Wait 6 days", wordings: ["{{first_name}}?"] },
    {
      step: "Message 4",
      wordings: [
        "Totally get it if the timing's off. Just know that when getting profit to move without adding headcount does become the priority, I'd be glad to help. All the best either way, {{first_name}}.",
      ],
    },
  ],
};

export const RECOMMENDED_TEMPLATE: { name: string; note: string; steps: TemplateStep[]; footer: string } = {
  name: "Recommended",
  note: "Words in [square brackets] are written for each coach from their Blueprint. A is growth, B is time (the two things owners raised most). Every message passes Pam's Starbucks rule: an owner can answer it in a few seconds.",
  steps: [
    {
      step: "Invite with a note",
      timing: "Under 200 characters",
      wordings: [
        "Hi {{first_name}}, I work with [industry] owners. I helped [their result, e.g. a touchscreen maker go from £3m to £16m in 4 years]. Is growing {{company}} a priority this year?",
        "Hi {{first_name}}, I work with [industry] owners. I helped [their result]. Would you like {{company}} to grow without needing more of your hours?",
      ],
    },
    {
      step: "Message 1",
      timing: "1 day after they accept",
      wordings: [
        "Thanks for connecting, {{first_name}}.\n\nQuick one: is growing {{company}} a priority for you this year?",
        "Thanks for connecting, {{first_name}}.\n\nQuick one: would you like {{company}} to grow without it needing more of your time?",
      ],
    },
    {
      step: "Message 2",
      timing: "4 days later",
      wordings: [
        "{{first_name}}, most [industry] owners I speak to want to grow… but the business already needs them for everything.\n\nI help owners like you:\n\n1️⃣ Grow without adding more of your hours\n2️⃣ Build a team that runs the day-to-day\n\n[Client type]: [before] → [after] in [time].\n[Client type 2]: [result].\n\n✅ Interested?",
      ],
    },
    {
      step: "Message 3",
      timing: "5 days later",
      wordings: ["No rush, {{first_name}}. Is now just a bad time? A yes or no is fine."],
    },
  ],
  footer: "Sent in the morning. The BOSS Score only as a reply when they answer.",
};

/** For Open Profiles: a longer first message sent without connecting, in the style of Zander's LinkedIn ads. */
export const OPEN_PROFILE_TEMPLATE: { name: string; note: string; steps: TemplateStep[]; footer: string } = {
  name: "Open Profile message",
  note: "Open Profiles can be messaged without connecting, so the first message has room to do more. Same structure as Zander's LinkedIn ads: a hook, the offer in two numbered lines, named results, then a yes or no.",
  steps: [
    {
      step: "Message",
      timing: "No connection needed",
      wordings: [
        "{{first_name}}, you've built a strong [industry] business… have you ever felt it still needs you for everything?\n\nI help owners like you:\n\n1️⃣ Grow without adding more of your hours\n2️⃣ Build a team that runs the day-to-day\n\n[Client type]: [before] → [after] in [time].\n[Client type 2]: [result].\n\nThis isn't a course or a software pitch. I work with a few owners at a time, one to one.\n\nI've recorded a short private video showing how it works.\n\n✅ Interested?",
      ],
    },
  ],
  footer: "Only if the coach has a short video; otherwise end on \"✅ Interested?\" after the line about how they work.",
};

export type Evidence = "Our data" | "Best practice" | "Pam's rule";

export const CHANGES: { from: string; to: string; why: string; evidence: Evidence[] }[] = [
  {
    from: "Questions that need thought (\"Worth a chat?\", \"what should it look like in 12 months?\")",
    to: "Yes or no questions an owner can answer in seconds",
    why: "Pam's Starbucks rule: an owner standing in a queue should be able to reply before their coffee comes. Our data agrees: short questions about the business got the most replies.",
    evidence: ["Pam's rule", "Our data"],
  },
  {
    from: "No note",
    to: "A note with the coach's own result and a question",
    why: "1.4 interested per 100 invites with proof, 0.5 without. In the 100k requests, proof notes got 0.31 meetings per 100 against 0.12 blank. (Altaf's top note is left out: its numbers came from Nigerian law firms, and the same note to UK firms got 1 meeting from 993.)",
    evidence: ["Our data"],
  },
  {
    from: "\"Most owners running a {{company}} business\"",
    to: "A real industry line",
    why: "Today {{company}} puts the firm's name where the industry should go: \"running a Smith Engineering Ltd business\".",
    evidence: ["Our data"],
  },
  {
    from: "\"found £180K in his pricing\"",
    to: "The coach's own real result",
    why: "Today every coach sends the same claim, which isn't true for most of them.",
    evidence: ["Our data"],
  },
  {
    from: "\"Worth a chat?\"",
    to: "A question about their business",
    why: "Questions about the business did best in our replies. Studies say asking about interest beats asking for a meeting.",
    evidence: ["Our data", "Best practice"],
  },
  {
    from: "Profit leaks",
    to: "Growth and time",
    why: "Owners talking about growth plans: 65% interested, 25% booked a call. \"Too busy\": 45% interested. Squeezed profits, hard times and daily operations did least.",
    evidence: ["Our data"],
  },
  {
    from: "Four messages, including \"{{first_name}}?\"",
    to: "Three, each a new angle",
    why: "Three messages get the most replies, five or more the fewest. Message 2 gets the most replies of all.",
    evidence: ["Best practice"],
  },
  {
    from: "Waits of 2, 3, 3 and 6 days",
    to: "1, 4 and 5 days, in the morning",
    why: "Invites sent in the morning are accepted more: 32% against 24% in the evening.",
    evidence: ["Best practice"],
  },
  {
    from: "One wording for everyone",
    to: "Two per step, rotated",
    why: "The same text from many accounts is easy for LinkedIn to flag, and owners compare notes.",
    evidence: ["Best practice"],
  },
  {
    from: "Lists with anyone on them",
    to: "Owners and directors only",
    why: "Of 2,156 reply threads, only 405 were owners or directors. 645 were salespeople.",
    evidence: ["Our data"],
  },
];

export const SOURCES =
  "Our own campaign data (2,156 reply threads, 405 of them owners, read on 28 Oct for $0.87) and published outreach studies (mostly from outreach tool firms, not UK only).";

export const BUGLASS_CAMPAIGN = {
  intro:
    "His Manufacturing campaign (700 people loaded, wording approved by him on 14 Oct) already has an industry line, his own result (£3.1m to £16.2m in 4 years) and a question.",
  fixes: [
    "Cut 5 messages to 3.",
    "Waits of 1 hour and 1 day become 1, 4 and 5 days.",
    "Add a growth wording beside the margin one (owners respond less to profit squeeze).",
    "Move the BOSS Score message to a reply.",
    "Fix the typos in that message (\"we fine the owners\", \"shows tou\").",
    "Pull back old invites first: 470 are still waiting.",
  ],
};

export type Stage = "Get ready" | "We build it" | "Results";

export const STAGE_TONE: Record<Stage, BadgeTone> = {
  "Get ready": "amber",
  "We build it": "blue",
  Results: "green",
};

export type CoachGap = {
  name: string;
  slug: string;
  stage: Stage | null;
  waitsOn: string | null;
  have: string[];
  missing: string[];
  next: string;
};

export const COACHES: CoachGap[] = [
  {
    name: "Peter Buglass",
    slug: "directorschool",
    stage: "We build it",
    waitsOn: "Zander",
    have: [
      "About You done",
      "Market sections written today",
      "LinkedIn draft written today",
      "Strong proof: touchscreen maker £3m to £16m, training company £300k to £3m",
      "Sales Navigator",
      "700 people in a campaign",
    ],
    missing: ["Your OK on the LinkedIn draft", "The campaign fixes above"],
    next: "Approve the draft, he updates his profile, then we fix and turn on the campaign.",
  },
  {
    name: "Paul Hamnett",
    slug: "paul-hamnett",
    stage: "We build it",
    waitsOn: "BCA, then Paul",
    have: ["About You 100%", "Blueprint call 22 Oct", "7 sections written", "Sales Navigator"],
    missing: [
      "A business result with numbers (his proof is a £1.8m facility and league wins, with no name or date)",
      "LinkedIn rewrite",
      "1,000-person list of sports and fitness owners",
      "Campaign on the new template",
      "A reply to his ticket from 26 Oct",
    ],
    next: "Reply to him and ask for one result, then write his LinkedIn and build the list.",
  },
  {
    name: "Peter Fairley",
    slug: "romanroadsadvisory",
    stage: "Get ready",
    waitsOn: "BCA",
    have: ["About You 100%", "LinkedIn Premium", "Pam drafted his launch newsletter on 20 Oct", "Don't lead with \"business coach\""],
    missing: [
      "Blueprint call not recorded (tick it if it happened)",
      "Numbers on his results (Gilligan Engineering loss to profit; 0 to 4 businesses)",
      "Market sections",
      "LinkedIn",
      "List",
      "Campaign",
    ],
    next: "Tick the call, ask him for numbers, then write the sections.",
  },
  {
    name: "Octave Akoue",
    slug: "octave-akoue",
    stage: "Get ready",
    waitsOn: "BCA",
    have: ["About You 100%", "A result: a W5 store from £600k to £1m sales", "LinkedIn draft from 24 Oct (you said it was off)"],
    missing: [
      "His LinkedIn is the free kind, so only 3 notes a month: Premium, or the no-note version of the template",
      "A reply to his ticket from 21 Oct",
      "Blueprint call",
      "Market sections",
      "A new LinkedIn draft",
      "List",
      "Campaign",
    ],
    next: "Reply to him, then decide on Premium.",
  },
  {
    name: "Mark Hennessey",
    slug: "mark-hennessey",
    stage: "We build it",
    waitsOn: "Mark",
    have: [
      "Discreet positioning: an expert, not a coach, no \"book a call\"",
      "Pam's Signature call on 21 Oct",
      "Pam is writing his newsletter",
    ],
    missing: ["About You 75%", "LinkedIn not connected", "No result recorded"],
    next: "Pam's call today. Ask him to finish About You and connect LinkedIn, then do the system version to compare with Pam's.",
  },
  {
    name: "Maciej Pedziwiatr",
    slug: "maciej-pedziwiatrfatdiscoltd",
    stage: "Get ready",
    waitsOn: "Maciej",
    have: [],
    missing: ["About You 25%", "LinkedIn not connected", "No result yet"],
    next: "A nudge to finish About You and connect LinkedIn.",
  },
  {
    name: "Bruce Alexander",
    slug: "bruce-alexander",
    stage: "Get ready",
    waitsOn: "Bruce",
    have: ["Joined 27 Oct"],
    missing: ["About You not started", "LinkedIn not connected"],
    next: "A welcome nudge.",
  },
  {
    name: "Paul Swift",
    slug: "paul-swift",
    stage: null,
    waitsOn: null,
    have: [],
    missing: [],
    next: "His website is tomorrow's job.",
  },
];

export const ASKS: string[] = [
  "Approve the recommended template, or tell me what to change.",
  "Peter Buglass: OK his LinkedIn draft, then turn on his fixed campaign.",
  "Make the new template the default for every new coach?",
  "Octave: pay for Premium, or use the no-note version?",
  "Ask Paul Hamnett, Peter Fairley and Mark for one result each, with numbers and a timeframe (I can draft the asks).",
];
