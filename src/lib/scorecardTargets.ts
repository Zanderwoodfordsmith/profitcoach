import { defaultMonthlyIncomeForLevelId } from "@/lib/ladderIncomeGoal";

export const DEFAULT_SCORECARD_CLIENT_PRICE = 2000;
const WEEKS_PER_MONTH = 4.3;
const WEEKS_ON_CARD = 13;

/** Funnel ratios anchored to “new clients won” = 1 (from spreadsheet model). */
const RATIOS = {
  salesOpportunities: 4,
  connectionRequestsSent: 500,
  newConnections: 100,
  otherOutreach: 50,
  replied: 25,
  interested: 10,
  valueSessionsAdded: 5,
  valueSessionsScheduled: 5,
  valueSessionsShowed: 4,
  followUpAdded: 3,
  followUpScheduled: 3,
  followUpShowed: 2,
  overlappingCalls: 2,
} as const;

export type ScorecardRowId =
  | "cashNew"
  | "cashOld"
  | "cashIn"
  | "cashOut"
  | "netCash"
  | "newClientsWon"
  | "salesOpportunities"
  | "closeRate"
  | "connectionRequestsSent"
  | "newConnections"
  | "otherOutreach"
  | "replied"
  | "interested"
  | "connectionRate"
  | "interestRate"
  | "interestedToValueSession"
  | "valueSessionsAdded"
  | "valueSessionsScheduled"
  | "valueSessionsShowed"
  | "valueShowRate"
  | "followUpAdded"
  | "followUpScheduled"
  | "followUpShowed"
  | "followUpShowRate"
  | "overlappingCalls";

export type ScorecardTargetDirection = "higher" | "lower";

export const SCORECARD_ROW_DIRECTION: Record<
  ScorecardRowId,
  ScorecardTargetDirection
> = {
  cashNew: "higher",
  cashOld: "higher",
  cashIn: "higher",
  cashOut: "lower",
  netCash: "higher",
  newClientsWon: "higher",
  salesOpportunities: "higher",
  closeRate: "higher",
  connectionRequestsSent: "higher",
  newConnections: "higher",
  otherOutreach: "higher",
  replied: "higher",
  interested: "higher",
  connectionRate: "higher",
  interestRate: "higher",
  interestedToValueSession: "higher",
  valueSessionsAdded: "higher",
  valueSessionsScheduled: "higher",
  valueSessionsShowed: "higher",
  valueShowRate: "higher",
  followUpAdded: "higher",
  followUpScheduled: "higher",
  followUpShowed: "higher",
  followUpShowRate: "higher",
  overlappingCalls: "lower",
};

/** Rows available in the trend chart (values are computed per week). */
export const SCORECARD_CHART_METRICS: Array<{
  id: ScorecardRowId;
  label: string;
  defaultOn: boolean;
}> = [
  { id: "newClientsWon", label: "New clients won", defaultOn: true },
  { id: "cashIn", label: "Cash in (new + old)", defaultOn: true },
  { id: "netCash", label: "Net cash", defaultOn: false },
  { id: "cashNew", label: "Cash from new clients", defaultOn: false },
  { id: "cashOld", label: "Cash from old clients", defaultOn: false },
  { id: "salesOpportunities", label: "Sales opportunities", defaultOn: false },
  { id: "closeRate", label: "Close rate %", defaultOn: false },
  { id: "connectionRequestsSent", label: "Connection requests sent", defaultOn: false },
  { id: "newConnections", label: "New connections", defaultOn: false },
  { id: "interested", label: "Interested", defaultOn: false },
  { id: "valueSessionsShowed", label: "Value sessions showed", defaultOn: false },
  { id: "followUpShowed", label: "Follow-up calls showed", defaultOn: false },
];

export type ScorecardTargets = Record<
  ScorecardRowId,
  { weekly: number; quarterly: number }
>;

function roundCount(n: number) {
  return Math.max(0, Math.round(n * 100) / 100);
}

/**
 * Weekly / quarterly (13× weekly) targets from ladder monthly income goal
 * and default per-client price, using spreadsheet-style funnel ratios.
 */
export function buildScorecardTargets(params: {
  ladderGoalLevel: string | null;
  pricePerClientMonth?: number;
}): { targets: ScorecardTargets; monthlyIncomeGoal: number | null } {
  const price =
    typeof params.pricePerClientMonth === "number" &&
    Number.isFinite(params.pricePerClientMonth) &&
    params.pricePerClientMonth > 0
      ? params.pricePerClientMonth
      : DEFAULT_SCORECARD_CLIENT_PRICE;

  let monthly = defaultMonthlyIncomeForLevelId(params.ladderGoalLevel);
  if (
    monthly === null &&
    params.ladderGoalLevel &&
    params.ladderGoalLevel.length > 0
  ) {
    monthly = 5_000;
  }

  if (monthly === null || monthly <= 0) {
    return { targets: emptyTargets(), monthlyIncomeGoal: null };
  }

  const weeklyNew = monthly / price / WEEKS_PER_MONTH;
  const weeklyCashIn = monthly / WEEKS_PER_MONTH;

  const t = {} as ScorecardTargets;

  const set = (
    id: ScorecardRowId,
    weekly: number,
    quarterly = weekly * WEEKS_ON_CARD
  ) => {
    t[id] = { weekly, quarterly };
  };

  set("newClientsWon", weeklyNew);
  set(
    "salesOpportunities",
    roundCount(weeklyNew * RATIOS.salesOpportunities)
  );
  set(
    "connectionRequestsSent",
    roundCount(weeklyNew * RATIOS.connectionRequestsSent)
  );
  set("newConnections", roundCount(weeklyNew * RATIOS.newConnections));
  set("otherOutreach", roundCount(weeklyNew * RATIOS.otherOutreach));
  set("replied", roundCount(weeklyNew * RATIOS.replied));
  set("interested", roundCount(weeklyNew * RATIOS.interested));
  set(
    "valueSessionsAdded",
    roundCount(weeklyNew * RATIOS.valueSessionsAdded)
  );
  set(
    "valueSessionsScheduled",
    roundCount(weeklyNew * RATIOS.valueSessionsScheduled)
  );
  set(
    "valueSessionsShowed",
    roundCount(weeklyNew * RATIOS.valueSessionsShowed)
  );
  set("followUpAdded", roundCount(weeklyNew * RATIOS.followUpAdded));
  set(
    "followUpScheduled",
    roundCount(weeklyNew * RATIOS.followUpScheduled)
  );
  set("followUpShowed", roundCount(weeklyNew * RATIOS.followUpShowed));
  set(
    "overlappingCalls",
    roundCount(weeklyNew * RATIOS.overlappingCalls)
  );

  set("cashNew", weeklyCashIn * 0.75);
  set("cashOld", weeklyCashIn * 0.25);
  set("cashIn", weeklyCashIn);
  set("cashOut", weeklyCashIn * 0.2);
  set("netCash", weeklyCashIn * 0.8);

  const oppsW = t.salesOpportunities.weekly;
  const newW = t.newClientsWon.weekly;
  set(
    "closeRate",
    oppsW > 0 ? newW / oppsW : 0,
    oppsW > 0 ? (newW / oppsW) * WEEKS_ON_CARD : 0
  );

  const reqW = t.connectionRequestsSent.weekly;
  const ncW = t.newConnections.weekly;
  set(
    "connectionRate",
    reqW > 0 ? ncW / reqW : 0,
    reqW > 0 ? (ncW / reqW) * WEEKS_ON_CARD : 0
  );

  const outreachW = reqW + t.otherOutreach.weekly;
  const intW = t.interested.weekly;
  set(
    "interestRate",
    outreachW > 0 ? intW / outreachW : 0,
    outreachW > 0 ? (intW / outreachW) * WEEKS_ON_CARD : 0
  );

  const vsAddW = t.valueSessionsAdded.weekly;
  set(
    "interestedToValueSession",
    intW > 0 ? vsAddW / intW : 0,
    intW > 0 ? (vsAddW / intW) * WEEKS_ON_CARD : 0
  );

  const vsSchW = t.valueSessionsScheduled.weekly;
  const vsShowW = t.valueSessionsShowed.weekly;
  set(
    "valueShowRate",
    vsSchW > 0 ? vsShowW / vsSchW : 0,
    vsSchW > 0 ? (vsShowW / vsSchW) * WEEKS_ON_CARD : 0
  );

  const fuSchW = t.followUpScheduled.weekly;
  const fuShowW = t.followUpShowed.weekly;
  set(
    "followUpShowRate",
    fuSchW > 0 ? fuShowW / fuSchW : 0,
    fuSchW > 0 ? (fuShowW / fuSchW) * WEEKS_ON_CARD : 0
  );

  return { targets: t, monthlyIncomeGoal: monthly };
}

function emptyTargets(): ScorecardTargets {
  const z = { weekly: 0, quarterly: 0 };
  return {
    cashNew: z,
    cashOld: z,
    cashIn: z,
    cashOut: z,
    netCash: z,
    newClientsWon: z,
    salesOpportunities: z,
    closeRate: z,
    connectionRequestsSent: z,
    newConnections: z,
    otherOutreach: z,
    replied: z,
    interested: z,
    connectionRate: z,
    interestRate: z,
    interestedToValueSession: z,
    valueSessionsAdded: z,
    valueSessionsScheduled: z,
    valueSessionsShowed: z,
    valueShowRate: z,
    followUpAdded: z,
    followUpScheduled: z,
    followUpShowed: z,
    followUpShowRate: z,
    overlappingCalls: z,
  };
}

export type ScorecardChartUnit = "money" | "count" | "ratio";

export function chartUnitForRow(rowId: ScorecardRowId): ScorecardChartUnit {
  if (
    rowId === "cashNew" ||
    rowId === "cashOld" ||
    rowId === "cashIn" ||
    rowId === "cashOut" ||
    rowId === "netCash"
  ) {
    return "money";
  }
  if (
    rowId === "closeRate" ||
    rowId === "connectionRate" ||
    rowId === "interestRate" ||
    rowId === "interestedToValueSession" ||
    rowId === "valueShowRate" ||
    rowId === "followUpShowRate"
  ) {
    return "ratio";
  }
  return "count";
}

export type TrafficLight = "green" | "yellow" | "red" | "neutral";

const NEAR_BAND = 0.1;

/**
 * Compare 13-week average actual to weekly pace target (same semantics as the
 * spreadsheet’s `T = R − S` with a 10% band).
 */
export function scorecardTrafficLight(params: {
  actualAvg: number | null;
  weeklyTarget: number | null;
  direction: ScorecardTargetDirection;
}): TrafficLight {
  const { actualAvg, weeklyTarget, direction } = params;
  if (
    actualAvg === null ||
    weeklyTarget === null ||
    !Number.isFinite(actualAvg) ||
    !Number.isFinite(weeklyTarget) ||
    weeklyTarget <= 0
  ) {
    return "neutral";
  }

  if (direction === "higher") {
    if (actualAvg >= weeklyTarget) return "green";
    if (actualAvg >= weeklyTarget * (1 - NEAR_BAND)) return "yellow";
    return "red";
  }

  if (actualAvg <= weeklyTarget) return "green";
  if (actualAvg <= weeklyTarget * (1 + NEAR_BAND)) return "yellow";
  return "red";
}
