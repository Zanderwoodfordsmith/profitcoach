/**
 * LinkedIn Sales Navigator COMPANY_HEADCOUNT bands.
 * Self-employed uses id A (verified from live Sales Nav URLs).
 */

export type SalesNavHeadcountId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I";

export type SalesNavHeadcountBand = {
  id: SalesNavHeadcountId;
  /** Stored on leadrocks_leads.team_size and shown in Lead Finder. */
  label: string;
};

export const SALES_NAV_HEADCOUNT_BANDS: SalesNavHeadcountBand[] = [
  { id: "A", label: "Self-employed" },
  { id: "B", label: "1-10" },
  { id: "C", label: "11-50" },
  { id: "D", label: "51-200" },
  { id: "E", label: "201-500" },
  { id: "F", label: "501-1000" },
  { id: "G", label: "1001-5000" },
  { id: "H", label: "5001-10000" },
  { id: "I", label: "10001+" },
];

const BAND_BY_LABEL = new Map(
  SALES_NAV_HEADCOUNT_BANDS.map((b) => [b.label.toLowerCase(), b])
);

const BAND_BY_ID = new Map(SALES_NAV_HEADCOUNT_BANDS.map((b) => [b.id, b]));

/** Default bands when auto-segmenting imports (base search + self-employed). */
export const DEFAULT_IMPORT_SEGMENT_TEAM_SIZES = [
  "Self-employed",
  "1-10",
  "11-50",
  "51-200",
] as const;

export function headcountBandForLabel(label: string): SalesNavHeadcountBand | null {
  const key = label.trim().toLowerCase();
  if (key === "self employed" || key === "self-employed") {
    return BAND_BY_LABEL.get("self-employed") ?? null;
  }
  return BAND_BY_LABEL.get(key) ?? null;
}

export function headcountBandForId(id: string): SalesNavHeadcountBand | null {
  return BAND_BY_ID.get(id as SalesNavHeadcountId) ?? null;
}

/** Canonical sort for import segments (self-employed first, then numeric bands). */
export function sortHeadcountLabels(labels: string[]): string[] {
  const order = new Map(
    SALES_NAV_HEADCOUNT_BANDS.map((b, i) => [b.label.toLowerCase(), i])
  );
  return [...labels].sort((a, b) => {
    const ai = order.get(a.toLowerCase()) ?? 999;
    const bi = order.get(b.toLowerCase()) ?? 999;
    return ai - bi;
  });
}
