export type AbVariantStats = {
  assigned: number;
  interested: number;
  replied: number;
  connected: number;
  booked: number;
};

export function abMetricForStep(stepType: string): {
  key: keyof Pick<AbVariantStats, "connected" | "interested" | "booked">;
  noun: string;
} {
  if (stepType === "invite") return { key: "connected", noun: "accepted" };
  return { key: "interested", noun: "interested" };
}

export function abRatePercent(
  stats: AbVariantStats | null | undefined,
  key: keyof Pick<AbVariantStats, "connected" | "interested" | "booked">
): number | null {
  if (!stats || stats.assigned <= 0) return null;
  return Math.round(((stats[key] ?? 0) / stats.assigned) * 100);
}

export function abWinningKey(
  variants: Array<{ key: string }>,
  statsByKey: Record<string, AbVariantStats> | undefined,
  metric: keyof Pick<AbVariantStats, "connected" | "interested" | "booked">
): string | null {
  if (!statsByKey) return null;
  const scored = variants
    .map((v) => {
      const stats = statsByKey[v.key];
      if (!stats || stats.assigned < 5) return null;
      return { key: v.key, rate: stats[metric] / stats.assigned };
    })
    .filter((row): row is { key: string; rate: number } => row != null);
  if (scored.length < 2) return null;
  scored.sort((a, b) => b.rate - a.rate);
  if (scored[0].rate <= 0) return null;
  if (scored[1] && scored[0].rate === scored[1].rate) return null;
  return scored[0].key;
}
