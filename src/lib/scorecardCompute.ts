import {
  num,
  type ScorecardManualWeek,
} from "@/lib/scorecardManual";
import type { ScorecardRowId } from "@/lib/scorecardTargets";

export function cashIn(m: Partial<ScorecardManualWeek>): number {
  return num(m, "cashNew") + num(m, "cashOld");
}

export function netCash(m: Partial<ScorecardManualWeek>): number {
  return cashIn(m) - num(m, "cashOut");
}

export function salesOpportunities(m: Partial<ScorecardManualWeek>): number {
  const vs = num(m, "valueSessionsShowed");
  const fu = num(m, "followUpShowed");
  const ov = num(m, "overlappingCalls");
  return Math.max(0, vs + fu - ov);
}

export function closeRate(m: Partial<ScorecardManualWeek>): number | null {
  const op = salesOpportunities(m);
  if (op <= 0) return null;
  const won = num(m, "newClientsWon");
  return won / op;
}

export function connectionRate(m: Partial<ScorecardManualWeek>): number | null {
  const req = num(m, "connectionRequestsSent");
  if (req <= 0) return null;
  return num(m, "newConnections") / req;
}

export function interestRate(m: Partial<ScorecardManualWeek>): number | null {
  const den =
    num(m, "connectionRequestsSent") + num(m, "otherOutreach");
  if (den <= 0) return null;
  return num(m, "interested") / den;
}

export function interestedToValueSession(
  m: Partial<ScorecardManualWeek>
): number | null {
  const added = num(m, "valueSessionsAdded");
  const int = num(m, "interested");
  if (added === 0) return 0;
  if (int <= 0) return null;
  return added / int;
}

export function valueShowRate(m: Partial<ScorecardManualWeek>): number | null {
  const sch = num(m, "valueSessionsScheduled");
  if (sch <= 0) return null;
  return num(m, "valueSessionsShowed") / sch;
}

export function discoveryShowRate(
  m: Partial<ScorecardManualWeek>
): number | null {
  const sch = num(m, "discoveryCallsScheduled");
  if (sch <= 0) return null;
  return num(m, "discoveryCallsShowed") / sch;
}

export function followUpShowRate(
  m: Partial<ScorecardManualWeek>
): number | null {
  const sch = num(m, "followUpScheduled");
  if (sch <= 0) return null;
  return num(m, "followUpShowed") / sch;
}

export function rowWeeklyValue(
  rowId: ScorecardRowId,
  m: Partial<ScorecardManualWeek>
): number | null {
  switch (rowId) {
    case "cashNew":
      return num(m, "cashNew");
    case "cashOld":
      return num(m, "cashOld");
    case "cashIn":
      return cashIn(m);
    case "cashOut":
      return num(m, "cashOut");
    case "netCash":
      return netCash(m);
    case "newClientsWon":
      return num(m, "newClientsWon");
    case "oldClients":
      return num(m, "oldClients");
    case "salesOpportunities":
      return salesOpportunities(m);
    case "closeRate":
      return closeRate(m);
    case "connectionRequestsSent":
      return num(m, "connectionRequestsSent");
    case "newConnections":
      return num(m, "newConnections");
    case "otherOutreach":
      return num(m, "otherOutreach");
    case "replied":
      return num(m, "replied");
    case "interested":
      return num(m, "interested");
    case "connectionRate":
      return connectionRate(m);
    case "interestRate":
      return interestRate(m);
    case "interestedToValueSession":
      return interestedToValueSession(m);
    case "discoveryCallsAdded":
      return num(m, "discoveryCallsAdded");
    case "discoveryCallsScheduled":
      return num(m, "discoveryCallsScheduled");
    case "discoveryCallsShowed":
      return num(m, "discoveryCallsShowed");
    case "discoveryShowRate":
      return discoveryShowRate(m);
    case "valueSessionsAdded":
      return num(m, "valueSessionsAdded");
    case "valueSessionsScheduled":
      return num(m, "valueSessionsScheduled");
    case "valueSessionsShowed":
      return num(m, "valueSessionsShowed");
    case "valueShowRate":
      return valueShowRate(m);
    case "followUpAdded":
      return num(m, "followUpAdded");
    case "followUpScheduled":
      return num(m, "followUpScheduled");
    case "followUpShowed":
      return num(m, "followUpShowed");
    case "followUpShowRate":
      return followUpShowRate(m);
    case "overlappingCalls":
      return num(m, "overlappingCalls");
    default:
      return null;
  }
}

export function averageWeeklyActual(
  rowId: ScorecardRowId,
  weeks: Partial<ScorecardManualWeek>[]
): number | null {
  const vals: number[] = [];
  for (const w of weeks) {
    const v = rowWeeklyValue(rowId, w);
    if (v !== null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return null;
  let s = 0;
  for (const v of vals) s += v;
  return s / vals.length;
}

export function sumWeeklyActual(
  rowId: ScorecardRowId,
  weeks: Partial<ScorecardManualWeek>[]
): number | null {
  const vals: number[] = [];
  for (const w of weeks) {
    const v = rowWeeklyValue(rowId, w);
    if (v !== null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return null;
  let s = 0;
  for (const v of vals) s += v;
  return s;
}
