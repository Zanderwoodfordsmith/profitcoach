/** Calendar days since last login (start-of-day to start-of-day). */
export function daysSinceLastLogin(iso: string): number | null {
  const t = Date.parse(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(t)) return null;
  const login = new Date(t);
  const now = new Date();
  const startUtc = Date.UTC(
    login.getFullYear(),
    login.getMonth(),
    login.getDate()
  );
  const endUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

/**
 * Freshness bands for admin last-login colour coding:
 * - fresh: ≤ 7 days
 * - warm: 8–30 days (inclusive)
 * - cold: &gt; 30 days or never / invalid
 */
export type LastLoginFreshness = "fresh" | "warm" | "cold";

export function lastLoginFreshness(
  iso: string | null | undefined
): LastLoginFreshness {
  if (!iso) return "cold";
  const days = daysSinceLastLogin(iso);
  if (days == null) return "cold";
  if (days <= 7) return "fresh";
  if (days <= 30) return "warm";
  return "cold";
}

export function lastLoginFreshnessClasses(
  freshness: LastLoginFreshness
): string {
  if (freshness === "fresh") return "bg-emerald-100 text-emerald-800";
  if (freshness === "warm") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}
