import type { ScorecardRowId } from "@/lib/scorecardTargets";

/** Every metric row that can be plotted or read from weekly values. */
export const SCORECARD_METRIC_OPTIONS: Array<{
  id: ScorecardRowId;
  label: string;
}> = [
  { id: "cashNew", label: "Cash from new clients" },
  { id: "cashOld", label: "Cash from old clients" },
  { id: "cashIn", label: "Cash in" },
  { id: "newClientsWon", label: "New clients" },
  { id: "oldClients", label: "Old clients" },
  { id: "salesOpportunities", label: "Sales opportunities" },
  { id: "closeRate", label: "Close rate %" },
  { id: "connectionRequestsSent", label: "Connection requests sent" },
  { id: "newConnections", label: "New connections" },
  { id: "otherOutreach", label: "Other outreach" },
  { id: "replied", label: "Replied" },
  { id: "interested", label: "Interested" },
  { id: "connectionRate", label: "Connection rate %" },
  { id: "interestRate", label: "Interest rate %" },
  { id: "interestedToValueSession", label: "Interested → Value session %" },
  { id: "discoveryCallsAdded", label: "Discovery calls — added" },
  { id: "discoveryCallsScheduled", label: "Discovery calls — scheduled" },
  { id: "discoveryCallsShowed", label: "Discovery calls — showed" },
  { id: "discoveryShowRate", label: "Discovery calls — show rate %" },
  { id: "valueSessionsAdded", label: "Value sessions — added" },
  { id: "valueSessionsScheduled", label: "Value sessions — scheduled" },
  { id: "valueSessionsShowed", label: "Value sessions — showed" },
  { id: "valueShowRate", label: "Value sessions — show rate %" },
  { id: "followUpAdded", label: "Follow-up — added" },
  { id: "followUpScheduled", label: "Follow-up — scheduled" },
  { id: "followUpShowed", label: "Follow-up — showed" },
  { id: "followUpShowRate", label: "Follow-up — show rate %" },
  { id: "overlappingCalls", label: "Overlapping calls" },
];
