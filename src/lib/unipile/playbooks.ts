/**
 * Canonical outreach playbooks (interest-first).
 * Sourced from VIP 200 / Pam 5-day nurture / reply playbooks copy provided for product.
 */

import type { CampaignStepInput } from "@/lib/unipile/campaigns";

export type PlaybookVariant = {
  key: string;
  label: string;
  body: string;
};

export type PlaybookStep = CampaignStepInput & {
  variants?: PlaybookVariant[];
};

export type OutreachPlaybook = {
  id: string;
  name: string;
  channel: "linkedin" | "email";
  description: string;
  northStar: string;
  steps: PlaybookStep[];
};

const VIP_MSG1_A = `Hi {{first_name}}, Most owners running a {{company}} business your size tell me revenue is growing but profit isn't following it. The issue is rarely sales. It's that nobody has ever scored the nine areas underneath the business to find where the money is actually leaking. Worth a chat? I've got two ideas for a business your size.`;

const VIP_MSG1_B = `Hi {{first_name}}, Most owners at your size aren't short of work. They're short of themselves. Everything still routes through you. That isn't a time management problem, it's a systems one, and it's usually three specific things. Want me to tell you which three?`;

const VIP_MSG1_C = `Hi {{first_name}}, Most owners I meet know something is capping their growth. Very few can name which thing, so they end up fixing the loudest problem instead of the most expensive one. I use a 13 question scorecard that names it and puts a number on the gap. Want the link?`;

const VIP_MSG2_A = `Forgot to mention, the last owner I did this with found £180K sitting in his pricing, not his pipeline. Would it help to see what we changed?`;

const VIP_MSG2_B = `Forgot to mention, we took a £900K owner from 58 hours a week to 41 in five months without dropping revenue. Want me to show you what came off his plate first?`;

const VIP_MSG2_C = `Forgot to mention, the average score on this is around 4 out of 10, and almost everyone guesses the wrong area. Would it make sense to send you yours?`;

const VIP_MSG4_A = `Totally get it if the timing's off. Just know that when getting profit to move without adding headcount does become the priority, I'd be glad to help. All the best either way, {{first_name}}.`;

const VIP_MSG4_B = `No worries if now isn't the moment. When getting the business to run without you does move up the list, I'm here. Wishing you a good quarter either way.`;

const VIP_MSG4_C = `Sounds like this isn't a priority right now and that's fair enough. If it changes, the 13 questions are yours — {{assessment_url}} — no charge and no call needed. All the best.`;

/** Four LinkedIn DMs over ~14 days. Ask for interest, not a calendar. */
export const VIP_GET_INTEREST_PLAYBOOK: OutreachPlaybook = {
  id: "vip-get-interest",
  name: "VIP get-interest (2 weeks)",
  channel: "linkedin",
  description:
    "Accept → problem opener (A/B/C) → proof → name nudge → loose breakup. North star: interested reply.",
  northStar: "interested_reply",
  steps: [
    { position: 0, step_type: "invite", body: "" },
    { position: 1, step_type: "wait", wait_hours: 48 },
    {
      position: 2,
      step_type: "message",
      body: VIP_MSG1_A,
      variants: [
        {
          key: "A",
          label: "Profit isn't following revenue",
          body: VIP_MSG1_A,
        },
        {
          key: "B",
          label: "Owner is the bottleneck",
          body: VIP_MSG1_B,
        },
        {
          key: "C",
          label: "Can't name what's broken",
          body: VIP_MSG1_C,
        },
      ],
    },
    { position: 3, step_type: "wait", wait_hours: 72 },
    {
      position: 4,
      step_type: "message",
      body: VIP_MSG2_A,
      variants: [
        { key: "A", label: "Pricing proof", body: VIP_MSG2_A },
        { key: "B", label: "Hours proof", body: VIP_MSG2_B },
        { key: "C", label: "Scorecard proof", body: VIP_MSG2_C },
      ],
    },
    { position: 5, step_type: "wait", wait_hours: 72 },
    {
      position: 6,
      step_type: "message",
      body: "{{first_name}}?",
    },
    { position: 7, step_type: "wait", wait_hours: 144 },
    {
      position: 8,
      step_type: "message",
      body: VIP_MSG4_A,
      variants: [
        { key: "A", label: "Profit priority", body: VIP_MSG4_A },
        { key: "B", label: "Run without you", body: VIP_MSG4_B },
        { key: "C", label: "Scorecard free", body: VIP_MSG4_C },
      ],
    },
  ],
};

function pamEmailSteps(
  angle: "owner" | "profit" | "marketing"
): PlaybookStep[] {
  const subjects =
    angle === "owner"
      ? [
          "Are you too needed in your business?",
          "Where is the business actually stuck?",
          "\"I haven't got time\"",
          "What is being indispensable costing you?",
          "One final nudge",
        ]
      : angle === "profit"
        ? [
            "More sales may not fix this",
            "Where is profit quietly leaking?",
            "Busy is not the goal",
            "This is why profit feels tight",
            "What is another year of profit leakage worth?",
          ]
        : [
            "Why is marketing so hit and miss?",
            "You may not have a lead problem",
            "More leads won't fix everything",
            "Inconsistent marketing is expensive",
            "Still guessing what to fix?",
          ];

  const bodies =
    angle === "owner"
      ? [
          `Hi {{first_name}},\n\nThere's a trap many successful business owners fall into.\n\nIt usually starts with being very good at what they do. Customers trust them. The team values their judgement. So whenever something important comes up, it finds its way back to them.\n\nIf you stepped away for two weeks with no calls and no checking in, what would happen?\n\nTomorrow I'll send you a simple way to find out where the biggest constraints are. It takes about three minutes.\n\nBest,\n{{coach_name}}`,
          `Hi {{first_name}},\n\nWhen a business feels hard to run, owners often start fixing symptoms — hire, change software, add meetings — and six months later the same problems are still there.\n\nThat's why I use the BOSS Profit & Performance Scorecard. Around three minutes, score out of 100 across the areas that drive profit, performance, control and growth.\n\nTake it here:\n{{assessment_url}}\n\nOnce you've completed it, you can book a 30-minute {{review_name}} to look at what I'd fix first.\n\nBest,\n{{coach_name}}`,
          `Hi {{first_name}},\n\n"I know I need to work on the business. I just haven't got time."\n\nThat is often the problem. If too many decisions depend on you, your diary fills itself — then you don't have time to fix why everything depends on you.\n\nThe BOSS Scorecard helps highlight the pressure points:\n{{assessment_url}}\n\nThen book your 30-minute {{review_name}} if it makes sense.\n\nBest,\n{{coach_name}}`,
          `Hi {{first_name}},\n\nOwner-dependence isn't just a time problem. The bigger cost is what doesn't happen because too much still depends on you — strategy pushed back, follow-up late, systems never built.\n\nStart with the BOSS Scorecard:\n{{assessment_url}}\n\nAfter that, book a 30-minute {{review_name}} and I'll help you interpret the results.\n\nBest,\n{{coach_name}}`,
          `Hi {{first_name}},\n\nOne final nudge.\n\nIf your business could make more profit, run more smoothly, grow in value, and rely less on you for every important decision — would three minutes be worth finding where things are stuck?\n\n{{assessment_url}}\n\nThen book a 30-minute {{review_name}} if you want help making sense of your results. No hard sell.\n\nBest,\n{{coach_name}}`,
        ]
      : angle === "profit"
        ? [
            `Hi {{first_name}},\n\nA lot of owners assume the answer is more sales. Sometimes yes — but not if the profit model underneath is leaking.\n\nIf margins are tight, pricing is wrong, or the wrong clients are attracted, more sales create more work without enough reward.\n\nTomorrow I'll send a simple way to see where profit, performance and control may be leaking. About three minutes.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nMost profit leaks are quiet: discounting, weak follow-up, creeping costs, unclear systems.\n\nThe BOSS Scorecard takes around three minutes and scores the areas that drive profit and growth:\n{{assessment_url}}\n\nThen you can book a 30-minute {{review_name}} to identify the first profit opportunities.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nBusy is not the same as profitable. A full diary can feel like progress while the business quietly underperforms.\n\nAre you getting enough profit for the effort going in?\n\nStart here:\n{{assessment_url}}\n\nThen book your 30-minute {{review_name}} if you want help identifying what to improve first.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nTurnover doesn't tell the whole story. Without visibility on profitable work, customers, costs and marketing, decisions become guesswork — and guesswork is expensive.\n\n{{assessment_url}}\n\nBook a 30-minute {{review_name}} after you have your score if you'd like help spotting the first practical actions.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nOne final thought. If the business is already working hard, the answer isn't always more leads or more hours — sometimes it's fixing what's already leaking.\n\n{{assessment_url}}\n\nThen book your 30-minute {{review_name}} if you want help working out what to fix first.\n\nBest,\n{{coach_name}}`,
          ]
        : [
            `Hi {{first_name}},\n\nA lot of owners are frustrated with marketing — posts, networking, campaigns — and results are still inconsistent.\n\nMore activity isn't always the answer if the message, audience, offer or follow-up is weak.\n\nTomorrow I'll send a simple way to see where marketing, sales and performance may be getting stuck.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nWhen marketing isn't working, people assume they need more leads. Sometimes they do — often the constraint is message, offer, follow-up or conversion.\n\nBOSS Scorecard (about three minutes):\n{{assessment_url}}\n\nThen book a 30-minute {{review_name}} to identify what I'd focus on first for lead flow and conversion.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nMore leads won't fix everything if the system behind them is weak — wrong enquiries, inconsistent follow-up, unclear pricing, owner-dependent delivery.\n\n{{assessment_url}}\n\nBook your 30-minute {{review_name}} if you'd like help interpreting results.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nInconsistent marketing makes the whole business feel it — unpredictable sales, cash pressure, reactive decisions.\n\n{{assessment_url}}\n\nOnce completed, book your 30-minute {{review_name}} and we'll identify the first practical moves for your pipeline.\n\nBest,\n{{coach_name}}`,
            `Hi {{first_name}},\n\nOne final nudge. Don't start by guessing — start with the diagnosis.\n\n{{assessment_url}}\n\nThen book a 30-minute {{review_name}} if you want support turning results into action. No hard sell — clarity on what to focus on next.\n\nBest,\n{{coach_name}}`,
          ];

  const steps: PlaybookStep[] = [];
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      steps.push({
        position: steps.length,
        step_type: "wait",
        wait_hours: 24,
      });
    }
    steps.push({
      position: steps.length,
      step_type: "message",
      body: `Subject: ${subjects[i]}\n\n${bodies[i]}`,
    });
  }
  return steps.map((s, i) => ({ ...s, position: i }));
}

export const PAM_OWNER_DEPENDENCE: OutreachPlaybook = {
  id: "pam-owner-dependence",
  name: "Pam 5-day: Owner dependence",
  channel: "email",
  description:
    "Email nurture → BOSS scorecard → optional review. Call ask only after interest or score.",
  northStar: "assessment_start",
  steps: pamEmailSteps("owner"),
};

export const PAM_PROFIT_LEAKAGE: OutreachPlaybook = {
  id: "pam-profit-leakage",
  name: "Pam 5-day: Profit leakage",
  channel: "email",
  description: "Profit-angle 5-day email → scorecard → review.",
  northStar: "assessment_start",
  steps: pamEmailSteps("profit"),
};

export const PAM_MARKETING: OutreachPlaybook = {
  id: "pam-marketing",
  name: "Pam 5-day: Marketing not working",
  channel: "email",
  description: "Marketing-angle 5-day email → scorecard → review.",
  northStar: "assessment_start",
  steps: pamEmailSteps("marketing"),
};

/** Shorter LinkedIn connector → discovery → scorecard interest (no calendar). */
export const CONNECTOR_INTEREST_PLAYBOOK: OutreachPlaybook = {
  id: "connector-interest",
  name: "Connector → interest → scorecard",
  channel: "linkedin",
  description:
    "Connect, soft discovery, then scorecard offer. A/B on the discovery ask.",
  northStar: "interested_reply",
  steps: [
    { position: 0, step_type: "invite", body: "" },
    { position: 1, step_type: "wait", wait_hours: 1 },
    {
      position: 2,
      step_type: "message",
      body: "Happy to share how if you're curious.",
    },
    { position: 3, step_type: "wait", wait_hours: 24 },
    {
      position: 4,
      step_type: "message",
      body: "Curious {{first_name}} – what would you most like to be even better:\n1. Your time – more flexibility and fun\n2. Your profit – pay yourself more\n3. Your team – things running without you\n1, 2, or 3?",
      variants: [
        {
          key: "A",
          label: "1/2/3 discovery",
          body: "Curious {{first_name}} – what would you most like to be even better:\n1. Your time – more flexibility and fun\n2. Your profit – pay yourself more\n3. Your team – things running without you\n1, 2, or 3?",
        },
        {
          key: "B",
          label: "Open interest ask",
          body: "Hi {{first_name}}, is getting more profit and control in the business without everything depending on you of interest right now — or is timing off?",
        },
      ],
    },
    { position: 5, step_type: "wait", wait_hours: 24 },
    {
      position: 6,
      step_type: "message",
      body: "{{first_name}} – would you be interested in a free BOSS Scorecard? It scores the business out of 100 and shows what to focus on next. I can send the link ({{assessment_url}}) or we can look at it together — interested?",
    },
  ],
};

export const OUTREACH_PLAYBOOKS: OutreachPlaybook[] = [
  VIP_GET_INTEREST_PLAYBOOK,
  CONNECTOR_INTEREST_PLAYBOOK,
  PAM_OWNER_DEPENDENCE,
  PAM_PROFIT_LEAKAGE,
  PAM_MARKETING,
];

export function getPlaybook(id: string): OutreachPlaybook | null {
  return OUTREACH_PLAYBOOKS.find((p) => p.id === id) ?? null;
}

/** Reply / objection snippets for Conversations (not automated steps). */
export const REPLY_PLAYBOOK_SNIPPETS: Array<{
  id: string;
  when: string;
  body: string;
}> = [
  {
    id: "interest-call-offer",
    when: "Shows interest (after logging positive)",
    body: "Hi {{first_name}},\nI saw your message about {{their_reply}}. I called and left you a message.\nThis is something I help clients with regularly. Would you be opposed to a short call?",
  },
  {
    id: "interest-softer",
    when: "Interest — softer open",
    body: "Hi {{first_name}},\nI saw your message about {{their_reply}}. Is it just something specific at the moment, or is it how it always is?",
  },
  {
    id: "not-yet",
    when: "Says not yet / maybe later",
    body: "Is it not yet because you've got something in particular that you're currently focused on?",
  },
  {
    id: "thumbs-up",
    when: "Thumbs up only",
    body: "Is the thumbs up that you would like to have a call / you're interested, or is it a thumbs up you're just agreeing with my comments?",
  },
  {
    id: "fine-for-now",
    when: "Fine for now / we're good",
    body: "It's great that you can say that. Not many business owners can.\nWhat I find is that every level has its devil, and usually there's something that you'd like to be even better in the business.",
  },
  {
    id: "no-thanks",
    when: "No thanks",
    body: "Is that no thanks to what I've written (like helping you make more profit)? Or no thanks you don't want to make more profit at the moment? Or no thanks you don't want to hear from me ever again?",
  },
  {
    id: "send-scorecard",
    when: "Interested → send assessment (before call)",
    body: "Brilliant — here's the 3-minute BOSS Scorecard:\n{{assessment_url}}\n\nTake it when you can and tell me what stands out. No call needed to start.",
  },
  {
    id: "scorecard-no-book",
    when: "Took scorecard, didn't book",
    body: "Hi {{first_name}},\nI saw you completed the BOSS Scorecard — well done for taking the first step.\nIf you'd like to go through it in more depth, I'm offering a 30-minute {{review_name}}. Would you like me to send a couple of times?",
  },
  {
    id: "final-ping-pong",
    when: "Final follow-up after interest",
    body: "Hi {{first_name}},\nRather than continue the answerphone ping pong, do let me know when's the best time to get hold of you, and I'll do my best to accommodate.",
  },
];
