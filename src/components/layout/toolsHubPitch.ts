/**
 * What each Client Engine section is for and why it helps, plus a longer line
 * per tab. Shown in the section guide that opens from the (i) next to the
 * section title.
 */
export type ToolsHubKey = "get-calls" | "win-clients" | "keep-clients";

export type ToolsHubPitch = { hub: ToolsHubKey; headline: string; body: string };

const PITCHES: Record<string, ToolsHubPitch> = {
  "Get Calls": {
    hub: "get-calls",
    headline: "Get owners to book a call with you.",
    body: "Pick who you want to reach, start the talk on LinkedIn, and stay in front of them with posts and a newsletter. Everything that turns a stranger into a booked call lives here.",
  },
  "Win Clients": {
    hub: "win-clients",
    headline: "Turn calls into paying clients.",
    body: "See every call and where each owner is up to. Use scripts that work, and practise until the close feels easy. Your Scoreboard shows how many calls it takes to hit your income.",
  },
  "Keep Clients": {
    hub: "keep-clients",
    headline: "Help clients win, so they stay.",
    body: "Track your clients, run their BOSS Scores and share playbooks that get results. Clients who see progress stay longer and send you referrals.",
  },
};

/** The longer "what it is and why it helps" for each tab, by tab label. */
export const TOOLS_HUB_TAB_DETAIL: Record<string, string> = {
  Prospects:
    "The owners your campaigns can reach. Build a list from a Sales Navigator search or a file, check who fits, and drop anyone already in a campaign. A good list is half the work.",
  Campaigns:
    "LinkedIn campaigns that send your invite and follow-ups for you, at a safe pace. You set it up once and the conversations come to you.",
  Conversations:
    "Every reply from LinkedIn, WhatsApp and email in one inbox, so no owner waits and no lead slips away.",
  Content:
    "Plan and write LinkedIn posts that keep you in front of owners, so they think of you when they are ready to talk.",
  Newsletter:
    "Write your newsletter issues in one place. A regular issue keeps you in the inbox of owners who are not ready yet, until they are.",
  "Lead Magnets":
    "Your BOSS Score and other pages people can sign up on. They give owners a reason to say yes, and give you a reason to follow up.",
  Toolkit:
    "Your links, your 90-day brochure from your Blueprint, and posts, banners and print files with your name and QR code. Ready to use, nothing to design.",
  Calls:
    "Every booked sales call in one calendar, so you walk in ready and can look back at what was said.",
  Pipeline:
    "Everyone you are talking to and where they are up to, so you know who to follow up next.",
  Scripts:
    "Every script for your talks with owners, from first message to the close. Use words that already work instead of making them up.",
  "Call Practice":
    "Practise your sales calls out loud with an AI owner, then get a score and a report. Get the nerves out here, not on a real call.",
  Scoreboard:
    "Set your income target and see how many messages, calls and clients it takes. Drag any number to see what changes.",
  Clients:
    "Everyone you coach, with their price and join date. Open a client to see their BOSS Score and your work together.",
  "BOSS Score":
    "Your clients' BOSS Scores and reports. Run it at the start and again later, so you and the client can see the progress.",
  Playbooks:
    "Ready-made guides to share with clients, with your link added for you. Give clients a clear next step without writing it yourself.",
  "Profit Levers":
    "Show an owner where the business is now and what it could be. Put in their numbers and three profit targets, then drag. Owners see the prize in pounds.",
  "Client Simulator":
    "Practise hard client talks out loud with an AI client, then get a score and a report. Get better before it counts.",
};

/** The Client Engine sections in tour order. */
export const TOOLS_HUB_ORDER: { title: string; hub: ToolsHubKey }[] = [
  { title: "Get Calls", hub: "get-calls" },
  { title: "Win Clients", hub: "win-clients" },
  { title: "Keep Clients", hub: "keep-clients" },
];

export function toolsHubPitch(title: unknown): ToolsHubPitch | null {
  return typeof title === "string" ? PITCHES[title] ?? null : null;
}
