import { textValue } from "./sourced";
import type { DecisionRecordPayload, PracticeKnowledgeRow } from "./types";

export function emptyDecision(): DecisionRecordPayload {
  return {
    target_market: "",
    buyer: "",
    problem: "",
    offer: "",
    price: "",
    guarantee: "",
    delivery_model: "",
    geography: "",
    campaign_angle: "",
    prospect_criteria: "",
    launch_date: "",
    customer_responsibilities: "",
    bca_responsibilities: "",
    open_risks: "",
    next_milestone: "",
  };
}

export type DecisionKey = keyof DecisionRecordPayload;

export type DecisionField = { key: DecisionKey; label: string; example: string; help: string };

/** The Decision Record in the order the Decision Call works through it. */
export const DECISION_GROUPS: { label: string; fields: DecisionField[] }[] = [
  {
    label: "Who you help",
    fields: [
      { key: "target_market", label: "Market", example: "Owner-led building services firms, £2M to £15M", help: "One market for the first campaign. Others can come later." },
      { key: "buyer", label: "Buyer", example: "The owner or managing director", help: "The person who says yes." },
      { key: "problem", label: "Problem", example: "Busy all year, but cash is always tight", help: "The one problem your first campaign talks about." },
      { key: "geography", label: "Where", example: "Yorkshire and the North East", help: "Local, national or international." },
    ],
  },
  {
    label: "What you sell",
    fields: [
      { key: "offer", label: "Offer", example: "Profit and cash coaching for building services owners", help: "What you sell, in a line. The three lengths are on Your Offer." },
      { key: "price", label: "Price", example: "£1,500 a month, six-month minimum, or six months upfront", help: "The price and terms you will quote." },
      { key: "guarantee", label: "Guarantee", example: "Try it for 60 days, stop if it is not right", help: "Or none. Never a promise of income." },
      { key: "delivery_model", label: "How you deliver", example: "One-to-one coaching, weekly then twice a month", help: "Coaching, consulting or advisory, and the rhythm." },
    ],
  },
  {
    label: "How we start",
    fields: [
      { key: "campaign_angle", label: "Campaign angle", example: "Find the cash you are already owed", help: "The idea your first messages lead with." },
      { key: "prospect_criteria", label: "Prospect list", example: "Owners and MDs, 10 to 50 staff, building services, Yorkshire", help: "Who goes on the first list." },
      { key: "launch_date", label: "Launch date", example: "Monday 2 November", help: "When the first campaign goes live." },
    ],
  },
  {
    label: "Who does what",
    fields: [
      { key: "customer_responsibilities", label: "Your part", example: "Reply to messages within a day. Take calls on Tuesdays and Thursdays.", help: "What you do each week once it is live." },
      { key: "bca_responsibilities", label: "BCA's part", example: "LinkedIn rewrite, first campaign and booking page by day 10", help: "What BCA builds and by when." },
      { key: "open_risks", label: "Open risks", example: "The proof needs one more number", help: "Anything that could slow the launch." },
      { key: "next_milestone", label: "Next milestone", example: "First campaign live", help: "The next thing we are working towards together." },
    ],
  },
];

export const DECISION_FIELDS: DecisionField[] = DECISION_GROUPS.flatMap((g) => g.fields);

const DELIVERY_LABEL: Record<string, string> = {
  coaching: "Coaching",
  consulting: "Consulting",
  advisory: "Advisory",
  hybrid: "A mix of coaching and consulting",
};

const GEOGRAPHY_LABEL: Record<string, string> = {
  local: "Local",
  national: "National",
  international: "International",
};

/**
 * What BCA proposes before the Decision Call, from the pre-read and what the
 * coach told us. The call replaces it with the locked record.
 */
export function proposedDecision(row: PracticeKnowledgeRow): DecisionRecordPayload {
  const out = emptyDecision();
  const report = row.report_payload;
  const top = report?.market_hypotheses?.[0];
  const practice = row.payload.practice;
  out.target_market = top?.industry ?? "";
  out.buyer = top?.buyer ?? "";
  out.problem = top?.problem ?? "";
  // The short line from "Your offer in three lengths" is the offer in a line, when it is written.
  const shortLine = row.built_sections["offer:lines"]?.blocks.find(
    (b) => b.type === "message" && /short/i.test(b.label)
  );
  out.offer =
    (shortLine?.type === "message" ? shortLine.body : "") || report?.offer_direction || report?.positioning || "";
  out.campaign_angle = report?.campaign_angle ?? "";
  const criteria = row.built_sections["market:criteria"]?.blocks.find((b) => b.type === "lede");
  out.prospect_criteria = criteria?.type === "lede" ? criteria.text : "";
  const fee = textValue(practice.min_fee);
  out.price = [fee ? `From ${fee}` : "", textValue(practice.payment_terms)].filter(Boolean).join(", ");
  const guarantee = practice.guarantee?.value;
  out.guarantee = guarantee === "none" ? "No guarantee" : textValue(practice.guarantee_terms);
  const model = practice.delivery_model?.value;
  out.delivery_model = [model ? DELIVERY_LABEL[model] ?? model : "", textValue(practice.session_rhythm)]
    .filter(Boolean)
    .join(", ");
  const geo = row.payload.market.geography_pref?.value;
  out.geography = geo ? GEOGRAPHY_LABEL[geo] ?? geo : "";
  // Older pre-reads can carry em dashes. The writing rules never allow them.
  for (const key of Object.keys(out) as DecisionKey[]) out[key] = out[key].replace(/\s*—\s*/g, ", ").trim();
  return out;
}
