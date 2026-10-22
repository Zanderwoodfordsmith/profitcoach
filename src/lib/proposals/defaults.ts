import { investment, PHASES, questions, timing, yourCall, type ExplainerLength } from "@/lib/coachExplainer/copy";
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
