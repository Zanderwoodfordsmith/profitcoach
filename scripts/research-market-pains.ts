/**
 * Pains research for one market: what UK owners say, in their words, ranked
 * by how many separate owners say it. Writes <slug>.json and <slug>.md.
 * Reads only: no database writes. Costs about $1 to $1.50 a market.
 *
 *   npx tsx scripts/research-market-pains.ts --coach <coach id> [--market "..."] [--buyer "..."] [--out dir]
 *   npx tsx scripts/research-market-pains.ts --market "UK independent gyms" [--buyer "..."] [--slug gyms] [--out dir]
 *
 * With --coach the market comes from the coach's Blueprint (first market
 * hypothesis, else the industries they have credibility in) unless --market is given.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] ?? null : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

type Sourced<T> = { value: T } | null | undefined;

async function marketFromCoach(coachId: string): Promise<{ name: string; market: string; buyer?: string }> {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const [{ data: profile }, { data: row }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", coachId).maybeSingle(),
    supabaseAdmin.from("coach_practice_knowledge").select("payload, report_payload").eq("coach_id", coachId).maybeSingle(),
  ]);
  const name = (profile?.full_name as string | undefined)?.trim() || coachId;
  const market = (row?.payload as { market?: Record<string, Sourced<unknown>> } | null)?.market ?? {};
  const list = (key: string): string[] => {
    const v = market[key]?.value;
    return Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];
  };
  const hypothesis = (row?.report_payload as { market_hypotheses?: { industry?: string; buyer?: string }[] } | null)
    ?.market_hypotheses?.[0];
  if (hypothesis?.industry) {
    return { name, market: `UK: ${hypothesis.industry}`, buyer: hypothesis.buyer ?? list("buyer_roles").join("; ") };
  }
  const credibility = list("industries_credibility");
  if (!credibility.length) throw new Error(`${name} has no market in their Blueprint yet. Pass --market.`);
  return { name, market: `UK owner-led businesses in: ${credibility.slice(0, 3).join("; ")}`, buyer: list("buyer_roles").join("; ") || undefined };
}

async function main() {
  const coachId = arg("--coach");
  const out = arg("--out") ?? join(process.cwd(), "tmp", "pains-research");
  let title = arg("--slug") ?? "";
  let market = arg("--market") ?? "";
  let buyer = arg("--buyer") ?? undefined;
  if (coachId) {
    const fromCoach = await marketFromCoach(coachId);
    market ||= fromCoach.market;
    buyer ??= fromCoach.buyer;
    title ||= fromCoach.name;
  }
  if (!market) throw new Error("Pass --coach <id> or --market \"...\".");
  title ||= market;

  const { researchMarketPains, painsToMarkdown } = await import("../src/lib/research/marketPains");
  console.log(`Researching: ${market}${buyer ? ` (buyer: ${buyer})` : ""}`);
  const result = await researchMarketPains({ market, buyer }, { onLog: (line) => console.log(`  ${line}`) });

  mkdirSync(out, { recursive: true });
  const slug = slugify(title);
  writeFileSync(join(out, `${slug}.json`), JSON.stringify({ title, coach_id: coachId, ...result }, null, 2));
  writeFileSync(join(out, `${slug}.md`), painsToMarkdown(result, `Pains research: ${title}`));
  console.log(`Wrote ${join(out, `${slug}.md`)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
