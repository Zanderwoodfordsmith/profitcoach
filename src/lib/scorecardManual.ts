/**
 * Manual scorecard inputs per week (white cells in the spreadsheet model).
 * All optional; missing keys treated as 0 for sums.
 */
export type ScorecardManualWeek = {
  cashNew?: number;
  cashOld?: number;
  cashOut?: number;
  newClientsWon?: number;
  oldClients?: number;
  connectionRequestsSent?: number;
  newConnections?: number;
  otherOutreach?: number;
  replied?: number;
  interested?: number;
  discoveryCallsAdded?: number;
  discoveryCallsScheduled?: number;
  discoveryCallsShowed?: number;
  valueSessionsAdded?: number;
  valueSessionsScheduled?: number;
  valueSessionsShowed?: number;
  followUpAdded?: number;
  followUpScheduled?: number;
  followUpShowed?: number;
  overlappingCalls?: number;
};

export const SCORECARD_MANUAL_KEYS = [
  "cashNew",
  "cashOld",
  "cashOut",
  "newClientsWon",
  "oldClients",
  "connectionRequestsSent",
  "newConnections",
  "otherOutreach",
  "replied",
  "interested",
  "discoveryCallsAdded",
  "discoveryCallsScheduled",
  "discoveryCallsShowed",
  "valueSessionsAdded",
  "valueSessionsScheduled",
  "valueSessionsShowed",
  "followUpAdded",
  "followUpScheduled",
  "followUpShowed",
  "overlappingCalls",
] as const;

export type ScorecardManualKey = (typeof SCORECARD_MANUAL_KEYS)[number];

export function normalizeManualWeek(
  raw: unknown
): Partial<ScorecardManualWeek> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<ScorecardManualWeek> = {};
  for (const k of SCORECARD_MANUAL_KEYS) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = v;
    }
  }
  return out;
}

export function num(m: Partial<ScorecardManualWeek>, k: ScorecardManualKey) {
  const v = m[k];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
