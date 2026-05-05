/**
 * Dev-only performance helpers. No-op in production.
 */

export function devPerfStart(): number {
  if (process.env.NODE_ENV !== "development") return 0;
  return performance.now();
}

export function devPerfEnd(label: string, startedAt: number): void {
  if (process.env.NODE_ENV !== "development" || startedAt <= 0) return;
  const ms = Math.round(performance.now() - startedAt);
  // eslint-disable-next-line no-console -- intentional dev profiling
  console.debug(`[perf] ${label}: ${ms}ms`);
}
