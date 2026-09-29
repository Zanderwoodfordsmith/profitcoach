import type { BlueprintBlock } from "./types";

/**
 * Standard sections: the BCA default every coach gets, written once.
 * Short, imperative steps, condition before command, so a coach can follow
 * them on a call. Coaches will be able to keep their own copy later.
 */
export const STANDARD_SECTIONS: Record<string, BlueprintBlock[]> = {
  "voice:rules": [
    {
      type: "lede",
      text: "Everything we write for you follows the same rules, so it reads like a person talking to a busy owner, not like marketing and not like AI.",
    },
    {
      type: "steps",
      items: [
        { title: "Write like you talk", detail: "Short sentences. Plain words. Say it the way you would say it across a table." },
        { title: "Use their words", detail: "Jobs, sites, contracts, covers, fee earners. Industry nouns beat coaching language every time." },
        { title: "Lead with proof", detail: "A result with a from, a to and a timeframe does more than any adjective." },
        { title: "Say what to do", detail: "Tell the reader what to do, not what to avoid, unless the warning is the point." },
        { title: "Cut the filler", detail: "If a word can go without changing the meaning, it goes." },
        { title: "Never sell coaching", detail: "In outreach, sell interest in the outcome. The call does the rest." },
      ],
    },
    {
      type: "heading",
      text: "Words we cut on sight",
    },
    {
      type: "bullets",
      items: [
        "Let's unpack this, dive deep, in today's world, cut through the noise",
        "Leverage (as a verb), robust, seamless, crucial, elevate, empower, unlock",
        "It's not about X, it's about Y (just say Y)",
        "The em dash. Use a comma, a full stop or a hyphen.",
      ],
    },
    {
      type: "callout",
      tone: "note",
      text: "If something we write does not sound like you, change it or tell us. Your voice guide above wins over these rules.",
    },
  ],

  "offer:format": [
    {
      type: "lede",
      text: "Sell the outcome, not hours. Owners buy the gap between the business they have and the business they want closed.",
    },
    {
      type: "timeline",
      items: [
        { when: "Weeks 1 to 6", title: "Weekly sessions", detail: "Quick wins and momentum. The client sees early results and commits." },
        { when: "Month 2 onwards", title: "Two 90-minute sessions a month", detail: "Long-term plan plus short-term execution. Enough time to act between sessions." },
        { when: "Every 90 days", title: "Quarterly plan", detail: "Review the scorecard and set the next three priorities." },
      ],
    },
    {
      type: "heading",
      text: "Why this format works",
    },
    {
      type: "bullets",
      items: [
        "Weekly is too intense long term. Monthly gives only 12 chances a year to course-correct.",
        "Two sessions a month makes an hourly rate hard to work out, so the price is judged against the result.",
        "Stack clients on the same days, for example the 1st and 3rd Tuesday. The rest of the month is for marketing and your life.",
        "Paint the long-term picture from the first call: as long as you are in business, we work together.",
      ],
    },
    {
      type: "callout",
      tone: "tip",
      text: "Adapt it to your clients. Ashley Maile runs one half day a month plus a short call because it suits engineering owners.",
    },
  ],

  "sales:howto": [
    {
      type: "lede",
      text: "A value session is a free, pitch-free 30 minutes that gives an owner real value. It gets more people on calls, and many of them ask to keep working with you.",
    },
    {
      type: "steps",
      items: [
        { title: "Warm rapport (2 to 3 minutes)", detail: "\"Great to meet you, thanks for making the time. I'd love to understand where you're at right now and where you'd like to go.\" Ask what made them book." },
        { title: "The current challenge", detail: "\"What's the biggest challenge or opportunity you're facing right now that's stopping your business from being where you want it to be?\"" },
        { title: "The desired future", detail: "\"If we were having this same conversation 12 months from now, what would need to have changed for you to feel genuinely happy with your progress?\" This creates the gap." },
        { title: "The personal driver", detail: "\"Why is solving this important to you personally, beyond just the numbers?\" Family, freedom, pride, legacy." },
        { title: "What they have tried", detail: "\"What have you tried so far, and how has that worked out?\" Respect the effort. Repeat it back." },
        { title: "Deliver the value (15 minutes)", detail: "Ask your audit questions and score each area red, amber or green. Coach, do not just ask. Give one or two things they can act on this week. If there is a lot of red, reframe it: look how far they got without these fixed." },
        { title: "The magic question", detail: "\"Would you like to see how I help my clients solve exactly this and get results faster?\" Wait for the yes." },
        { title: "Bridge into the offer", detail: "\"Based on what you told me about {their challenge} and your vision for {their outcome}, here is how I work with clients in your situation.\" Three things, tied to their pain, their goal and their personal driver. Add proof. Then: \"Does that sound like the support that would make a real difference?\"" },
        { title: "If not now, stop", detail: "No objection handling. You promised no pitch. \"The important thing is you've got clarity on your next steps.\" Send a short report and offer a check-in in two weeks." },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Keep the promise",
      text: "If you say pitch-free, be pitch-free. The trust you earn is the reason people come back.",
    },
  ],
};
