import {
  investment,
  LEVELS,
  PHASES,
  phaseOne,
  questions,
  score,
  timing,
  yourCall,
  type ExplainerLength,
} from "@/lib/coachExplainer/copy";
import type { ExplainerCoach } from "@/lib/coachExplainer/fromBlueprint";
import type { ProposalSection } from "./types";

/**
 * A new proposal's starting sections, from the explainer's words and the
 * coach's Blueprint. The coach edits any of it before sending. The terms start
 * empty: the coach adds their own agreement (BCA's template is not
 * lawyer-checked yet).
 */
export function defaultProposalSections(input: {
  coach: ExplainerCoach | null;
  prospectName: string;
  prospectBusiness: string | null;
  length?: ExplainerLength;
}): ProposalSection[] {
  const length = input.length ?? "ongoing";
  const coach = input.coach;
  const first = input.prospectName.trim().split(/\s+/)[0] || "there";
  const business = input.prospectBusiness?.trim() || "the business";
  const t = timing(length);
  const inv = investment(length);

  const intro = [
    `${first}, thank you for your time on our call. You told me what's holding ${business} back, and where you want it to be.`,
    `This sets out how we'd get there together, what it costs, and what happens next. Read it in your own time, and ask me anything.`,
    coach?.site.shortLine ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const how = [
    "We work in three phases. I bring the questions, the tools and the plan. You make the changes. That's what makes them stick.",
    ...PHASES.map((p, i) => `## Phase ${p.n}: ${p.name} (${t.when[i]})\n${p.text}\n\nYour part: ${p.you}`),
    "Every 90 days we re-score the business and set the next plan.",
  ].join("\n\n");

  const fee = coach?.fee;
  const investmentBody = fee
    ? [
        fee,
        coach?.paymentTerms ?? inv.then,
        `## ${inv.includedHeading}\n${inv.included.map((line) => `- ${line}`).join("\n")}`,
        `## ${inv.paidHeading}\n${inv.paid}`,
        coach?.guarantee ? `## If it isn't right\n${coach.guarantee}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const next = [
    "- Sign this proposal at the bottom of the page.",
    ...yourCall.next.map((n) => `- ${n.title}: ${n.text}`),
  ].join("\n");

  const faq = questions({
    length,
    showFee: Boolean(fee),
    fee: fee ?? null,
    rhythm: coach?.rhythm ?? null,
    guarantee: coach?.guarantee ?? null,
    whoIHelp: coach?.site.whoIHelp ?? null,
  })
    .items.map((item) => `## ${item.q}\n${item.a}`)
    .join("\n\n");

  return [
    { key: "intro", title: `For ${input.prospectBusiness?.trim() || input.prospectName.trim()}`, body: intro },
    { key: "how", title: "How it works", body: how },
    { key: "investment", title: "Your investment", body: investmentBody },
    { key: "next", title: "Next steps", body: next },
    { key: "faq", title: "Your questions", body: faq },
    { key: "terms", title: "Terms", body: "" },
  ];
}

/**
 * A new client's welcome pack: what the first month holds, how the coaching
 * runs, what the coach needs from them, and the system behind it. The
 * welcome note can be rewritten by AI in the coach's voice.
 */
export function defaultWelcomeSections(input: {
  coach: ExplainerCoach | null;
  coachName: string;
  clientName: string;
}): ProposalSection[] {
  const first = input.clientName.trim().split(/\s+/)[0] || "there";
  const coachFirst = input.coachName.trim().split(/\s+/)[0] || input.coachName;
  const coach = input.coach;

  const note = [
    `${first}, welcome. I'm glad we're doing this together.`,
    "This pack sets out how our first month works, how we'll work together after that, and what I need from you to get started. Keep it to hand.",
    coachFirst,
  ].join("\n\n");

  const firstMonth = [
    phaseOne.lead,
    ...phaseOne.sessions.map((session, i) => `## Session ${i + 1}: ${session.title}\n${session.text}`),
    `## ${phaseOne.systemHeading}\n${phaseOne.system.map((item) => `- ${item}`).join("\n")}`,
  ].join("\n\n");

  const together = [
    coach?.rhythm ?? "Weekly sessions in the first month, then two 90-minute sessions a month.",
    "Between sessions you make the changes we agreed. Your scoreboard shows whether they're working before we next speak.",
    "Every 90 days we re-score the business, look at what moved, and set the next 90-day plan.",
  ].join("\n\n");

  const need = [
    "A few things make the first month count:",
    [
      "- Your numbers: last year's turnover and profit, and this year's so far",
      "- The full BOSS Diagnostic: 50 questions, about 10 minutes, before our first session",
      "- An hour or two a week between sessions to make the changes",
      "- Honest answers. The score only helps if it's true",
      "- Your team, once we reach the areas they run",
    ].join("\n"),
  ].join("\n\n");

  const reach = [
    "Message or email me any time between sessions. I reply within one working day.",
    coach?.website ? `My website: ${coach.website}` : "",
    "If something urgent comes up before a session, tell me straight away. We can change the plan.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = [
    `${score.lead} ${score.close}`,
    `## ${score.foundation.name}\n${score.foundation.text}`,
    ...score.pillars.map((pillar) => `## ${pillar.name}: ${pillar.text}\n${pillar.areas.map((area) => `- ${area}`).join("\n")}`),
    `## The five levels\n${LEVELS.map((level, i) => `- ${i + 1}. ${level.name}: ${level.text}`).join("\n")}`,
    "Your score places you on one level. The work is moving up, one level at a time.",
  ].join("\n\n");

  return [
    { key: "note", title: `Welcome, ${first}`, body: note },
    { key: "first", title: "Your first month", body: firstMonth },
    { key: "together", title: "How we work together", body: together },
    { key: "need", title: "What I need from you", body: need },
    { key: "reach", title: "How to reach me", body: reach },
    { key: "system", title: "The system behind it", body: system },
  ];
}
