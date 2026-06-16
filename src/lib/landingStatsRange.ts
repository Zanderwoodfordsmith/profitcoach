export type LandingStatsRangePreset = "7" | "14" | "30" | "90" | "all" | "custom";

export type LandingStatsRange = {
  preset: LandingStatsRangePreset;
  customFrom: string;
  customTo: string;
};

export const LANDING_STATS_RANGE_PRESETS: {
  id: LandingStatsRangePreset;
  label: string;
}[] = [
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

function toLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultLandingStatsRange(): LandingStatsRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    preset: "30",
    customFrom: toLocalYmd(from),
    customTo: toLocalYmd(to),
  };
}

export function isLandingStatsRangeValid(range: LandingStatsRange): boolean {
  if (range.preset !== "custom") return true;
  if (!range.customFrom.trim() || !range.customTo.trim()) return false;
  return range.customFrom <= range.customTo;
}

export function landingStatsRangeQuery(range: LandingStatsRange): string {
  if (range.preset === "all") {
    return "";
  }

  if (range.preset === "custom") {
    if (!isLandingStatsRangeValid(range)) return "";
    const params = new URLSearchParams({
      from: new Date(`${range.customFrom}T00:00:00.000Z`).toISOString(),
      to: new Date(`${range.customTo}T23:59:59.999Z`).toISOString(),
    });
    return params.toString();
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Number(range.preset));

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return params.toString();
}

export function landingStatsRangeLabel(range: LandingStatsRange): string {
  switch (range.preset) {
    case "7":
      return "Last 7 days";
    case "14":
      return "Last 14 days";
    case "30":
      return "Last 30 days";
    case "90":
      return "Last 90 days";
    case "all":
      return "All time";
    case "custom":
      if (range.customFrom && range.customTo) {
        return `${range.customFrom} – ${range.customTo}`;
      }
      return "Custom range";
  }
}
