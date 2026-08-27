/**
 * Local LinkedIn vanity-URL check for leadrocks_leads.
 *
 * A raw server fetch gets 999 for almost every real profile. From your own
 * machine, going through Google (search the vanity URL, click the first
 * LinkedIn result) is enough to see whether the profile exists or 404s —
 * no Sales Nav cookies required.
 *
 * Default path: Playwright + your installed Chrome, headed, via Google.
 * Optional `--direct` skips Google and opens the vanity URL itself (works
 * for some SEO-indexed profiles, fails for most others).
 *
 * Results go into raw.linkedin_check. Resume-safe: skips already-checked rows.
 *
 * Usage:
 *   npx tsx scripts/validate-lead-linkedin.ts --dry-run --limit 10
 *   npx tsx scripts/validate-lead-linkedin.ts --limit 50
 *   npx tsx scripts/validate-lead-linkedin.ts --direct --limit 10
 *
 * Options:
 *   --dry-run        check + report, do not write raw.linkedin_check
 *   --limit N        stop after N rows
 *   --delay MS       pause between profiles (default 2500)
 *   --direct         skip Google, open the vanity URL directly
 *   --headless       hide the browser (more likely to get blocked)
 *   --recheck        re-check rows that already have a linkedin_check
 *   --no-report      skip writing the CSV report
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 * First run: `npx playwright install chrome` if Chrome channel is missing.
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";

import {
  isVanityLinkedInUrl,
  normalizePublicLinkedInUrl,
} from "../src/lib/salesNavigator/leadIdentity";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const dryRun = process.argv.includes("--dry-run");
const recheck = process.argv.includes("--recheck");
const noReport = process.argv.includes("--no-report");
const viaDirect = process.argv.includes("--direct");
const headless = process.argv.includes("--headless");
const limit = Number(argValue("--limit") ?? "0") || 0;
const delayMs = Math.max(500, Number(argValue("--delay") ?? "2500") || 2500);

const PAGE_SIZE = 100;

type LinkedInStatus = "live" | "dead" | "unknown";

type LinkedInCheck = {
  status: LinkedInStatus;
  via: "google" | "direct";
  finalUrl: string | null;
  error: string | null;
  checkedAt: string;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  company: string | null;
  linkedin_url: string | null;
  raw: Record<string, unknown> | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFinalUrl(finalUrl: string): LinkedInStatus {
  const lower = finalUrl.toLowerCase();
  if (
    lower.includes("linkedin.com/404") ||
    lower.includes("/404/") ||
    /linkedin\.com\/404(?:\?|$)/.test(lower)
  ) {
    return "dead";
  }
  if (
    lower.includes("/authwall") ||
    lower.includes("/login") ||
    lower.includes("/uas/login") ||
    lower.includes("/signup") ||
    lower.includes("google.com/sorry")
  ) {
    return "unknown";
  }
  if (/linkedin\.com\/in\//i.test(lower)) return "live";
  return "unknown";
}

async function dismissConsent(page: Page): Promise<void> {
  const buttons = [
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /^accept$/i }),
    page.locator("#L2AGLb"),
  ];
  for (const btn of buttons) {
    try {
      if (await btn.first().isVisible({ timeout: 1500 })) {
        await btn.first().click({ timeout: 2000 });
        return;
      }
    } catch {
      /* keep trying */
    }
  }
}

async function checkViaGoogle(page: Page, vanityUrl: string): Promise<LinkedInCheck> {
  const checkedAt = new Date().toISOString();
  const query = `https://www.google.com/search?q=${encodeURIComponent(vanityUrl)}`;
  try {
    await page.goto(query, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await dismissConsent(page);

    const target = page.locator('a[href*="linkedin.com/in/"]').first();

    if ((await target.count()) === 0) {
      // No Google result usually means the vanity slug is gone / never indexed.
      return {
        status: "dead",
        via: "google",
        finalUrl: page.url(),
        error: "no_google_result",
        checkedAt,
      };
    }

    await Promise.all([
      page.waitForURL(/linkedin\.com|google\.com/i, { timeout: 20_000 }),
      target.click(),
    ]).catch(async () => {
      const href = await target.getAttribute("href");
      if (href) {
        const dest = href.startsWith("http")
          ? href
          : new URL(href, "https://www.google.com").href;
        await page.goto(dest, { waitUntil: "domcontentloaded", timeout: 20_000 });
      }
    });

    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
    const finalUrl = page.url();
    return {
      status: classifyFinalUrl(finalUrl),
      via: "google",
      finalUrl,
      error: null,
      checkedAt,
    };
  } catch (err) {
    return {
      status: "unknown",
      via: "google",
      finalUrl: page.url(),
      error: err instanceof Error ? err.message : "google_check_failed",
      checkedAt,
    };
  }
}

async function checkDirect(page: Page, vanityUrl: string): Promise<LinkedInCheck> {
  const checkedAt = new Date().toISOString();
  try {
    await page.goto(vanityUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    const finalUrl = page.url();
    return {
      status: classifyFinalUrl(finalUrl),
      via: "direct",
      finalUrl,
      error: null,
      checkedAt,
    };
  } catch (err) {
    return {
      status: "unknown",
      via: "direct",
      finalUrl: page.url(),
      error: err instanceof Error ? err.message : "direct_check_failed",
      checkedAt,
    };
  }
}

async function fetchNextBatch(afterId: string | null): Promise<LeadRow[]> {
  let query = supabase
    .from("leadrocks_leads")
    .select("id, full_name, company, linkedin_url, raw")
    .not("linkedin_url", "is", null)
    .ilike("linkedin_url", "%/in/%")
    .not("linkedin_url", "ilike", "%/in/ac%aa%")
    .like("source", "leadrocks%")
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (afterId) query = query.gt("id", afterId);
  if (!recheck) query = query.is("raw->linkedin_check", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

function csv(value: string | null | undefined): string {
  const v = (value ?? "").toString();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  console.log(
    `[linkedin-validate] start${dryRun ? " (dry-run)" : ""}` +
      ` via=${viaDirect ? "direct" : "google"}` +
      ` ${headless ? "headless" : "headed"}` +
      ` delay=${delayMs}ms` +
      `${limit ? ` limit=${limit}` : ""}`
  );

  const browser = await chromium.launch({
    headless,
    channel: "chrome",
  });
  const context = await browser.newContext({
    locale: "en-GB",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const tally = { live: 0, dead: 0, unknown: 0 };
  const reportRows: string[] = [
    "id,full_name,company,linkedin_url,status,via,final_url,error",
  ];
  let processed = 0;
  let afterId: string | null = null;

  try {
    while (true) {
      const fetched = await fetchNextBatch(afterId);
      if (fetched.length === 0) break;
      afterId = fetched[fetched.length - 1]!.id;

      for (const row of fetched) {
        if (limit && processed >= limit) break;
        const vanity = normalizePublicLinkedInUrl(row.linkedin_url);
        if (!vanity || !isVanityLinkedInUrl(vanity)) continue;

        const check = viaDirect
          ? await checkDirect(page, vanity)
          : await checkViaGoogle(page, vanity);

        tally[check.status] += 1;
        processed += 1;

        if (check.status !== "live") {
          reportRows.push(
            [
              row.id,
              csv(row.full_name),
              csv(row.company),
              csv(row.linkedin_url),
              check.status,
              check.via,
              csv(check.finalUrl),
              csv(check.error),
            ].join(",")
          );
        }

        console.log(
          `  ${check.status.padEnd(7)} ${row.full_name ?? "?"}  ${vanity}` +
            (check.error ? `  (${check.error})` : "")
        );

        if (!dryRun) {
          const nextRaw = {
            ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
            linkedin_check: check,
          };
          const { error } = await supabase
            .from("leadrocks_leads")
            .update({ raw: nextRaw })
            .eq("id", row.id);
          if (error) {
            console.error(`  update failed ${row.id}: ${error.message}`);
          }
        }

        await sleep(delayMs);
      }

      if (limit && processed >= limit) break;
      if (dryRun && !limit) break;
    }
  } finally {
    await browser.close();
  }

  if (!noReport && reportRows.length > 1) {
    const outPath = path.join(
      process.cwd(),
      "exports",
      `linkedin-validation-${new Date().toISOString().slice(0, 10)}.csv`
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, reportRows.join("\n") + "\n", "utf8");
    console.log(`[linkedin-validate] wrote report: ${outPath}`);
  }

  console.log(
    `[linkedin-validate] done. processed=${processed}` +
      ` live=${tally.live} dead=${tally.dead} unknown=${tally.unknown}` +
      (dryRun ? " (dry-run — nothing written)" : "")
  );
}

main().catch((err) => {
  console.error("[linkedin-validate] fatal:", err);
  process.exit(1);
});
