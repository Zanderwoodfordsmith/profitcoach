import type { DecisionRecordPayload } from "./types";

export function emptyDecision(): DecisionRecordPayload {
  return {
    target_market: "",
    buyer: "",
    problem: "",
    offer: "",
    price: "",
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
