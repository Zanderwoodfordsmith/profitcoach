import {
  CLIENT_SOURCE_LABELS,
  REVENUE_BAND_LABELS,
  TEAM_SIZE_LABELS,
  type ClientSource,
  type RevenueBand,
  type TeamSize,
} from "@/lib/clientRoster/fields";

/**
 * "Your best clients look like this": what a coach's clients have in common,
 * weighted towards the ones they'd most like more of (fit 4 or 5), so BCA can
 * aim campaigns at lookalikes (Matt Lakajev's "find the clones of your best
 * clients"). Pure, so it can be tested and reused for the BCA-wide view.
 */

export type InsightClient = {
  client_sector: string | null;
  client_revenue_band: string | null;
  client_team_size: string | null;
  client_source: string | null;
  client_fee_amount: number | null;
  client_fit: number | null;
  client_result: string | null;
};

export type Share = { key: string; label: string; count: number; share: number };

export type ClientInsights = {
  clients: number;
  described: number;
  best: number;
  sectors: Share[];
  revenue: Share[];
  team: Share[];
  sources: Share[];
  averageFee: number | null;
  withResults: number;
  summary: string | null;
  missing: string[];
};

function weight(c: InsightClient): number {
  if (c.client_fit == null) return 1;
  return c.client_fit >= 4 ? 2 : c.client_fit <= 2 ? 0.5 : 1;
}

function tally(clients: InsightClient[], pick: (c: InsightClient) => string | null, label: (k: string) => string): Share[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const c of clients) {
    const raw = pick(c);
    if (!raw) continue;
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const w = weight(c);
    m.set(key, (m.get(key) ?? 0) + w);
    total += w;
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: label(key), count: Math.round(count * 10) / 10, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function clientInsights(clients: InsightClient[]): ClientInsights {
  const sectors = tally(clients, (c) => c.client_sector, (k) => titleCase(k));
  const revenue = tally(clients, (c) => c.client_revenue_band, (k) => REVENUE_BAND_LABELS[k as RevenueBand] ?? k);
  const team = tally(clients, (c) => c.client_team_size, (k) => TEAM_SIZE_LABELS[k as TeamSize] ?? k);
  const sources = tally(clients, (c) => c.client_source, (k) => CLIENT_SOURCE_LABELS[k as ClientSource] ?? k);
  const fees = clients.map((c) => c.client_fee_amount).filter((f): f is number => typeof f === "number" && f > 0);
  const described = clients.filter((c) => c.client_sector || c.client_revenue_band || c.client_team_size || c.client_source).length;

  const missing: string[] = [];
  if (clients.length && described < clients.length) missing.push(`${clients.length - described} client${clients.length - described === 1 ? "" : "s"} have no sector, size or source yet`);
  if (clients.length && !clients.some((c) => c.client_fit != null)) missing.push("rate each client 1 to 5 for how many more like them you'd want");
  if (clients.length && !clients.some((c) => c.client_result)) missing.push("add the result you got for at least your best clients (it becomes your proof)");

  let summary: string | null = null;
  const top = (list: Share[]) => (list[0] && list[0].share >= 0.3 ? list[0] : null);
  const s = top(sectors);
  const r = top(revenue);
  const t = top(team);
  const src = top(sources);
  if (described >= 3 && (s || r || t)) {
    const parts = [r ? `${r.label} turnover` : null, s ? s.label.toLowerCase() : null, t ? `businesses with ${t.label} staff` : "businesses"].filter(Boolean);
    summary = `Your best clients are mostly ${parts.join(" ")}`;
    if (src) summary += `, and most found you through ${src.label.toLowerCase()}`;
    summary += ".";
  }

  return {
    clients: clients.length,
    described,
    best: clients.filter((c) => (c.client_fit ?? 0) >= 4).length,
    sectors: sectors.slice(0, 6),
    revenue,
    team,
    sources,
    averageFee: fees.length ? Math.round(fees.reduce((a, b) => a + b, 0) / fees.length) : null,
    withResults: clients.filter((c) => c.client_result).length,
    summary,
    missing,
  };
}
