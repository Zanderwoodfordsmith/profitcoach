/**
 * One-off Sales Navigator import → CSV (no UI / no DB).
 *
 * Usage:
 *   npx tsx scripts/run-sales-nav-import-to-csv.ts \
 *     --url "https://www.linkedin.com/sales/search/people?..." \
 *     --cookie-file /tmp/sales-nav-cookies.json \
 *     --pages 4 \
 *     --out ~/Downloads/uk-plumbers-owners.csv
 *
 *   # Or set LINKEDIN_SALES_NAV_COOKIE in .env.local (Cookie-Editor JSON array)
 *
 * Options:
 *   --mode Short | Full | "Full + email search"   (default Short)
 *   --pages N          search pages (25 leads/page, default 4)
 *   --user-agent "..." optional browser UA
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { SalesNavImportedLead } from "../src/lib/apify/salesNavigatorTypes";
import { SALES_NAV_MAX_TAKE_PAGES } from "../src/lib/apify/salesNavigatorTypes";
import {
  SalesNavScrapeError,
  fetchSalesNavSearchDataset,
  getApifyRunState,
  scrapeSalesNavSearch,
  startSalesNavSearch,
} from "../src/lib/apify/salesNavigatorSearch";
import {
  estimateSalesNavImportCostUsd,
  type SalesNavProfileScraperMode,
} from "../src/lib/salesNavigator/apifyCost";
import {
  buildSalesNavLeadsCsv,
} from "../src/lib/salesNavigator/exportSalesNavLeadsCsv";

loadEnvConfig(process.cwd());

const MODES = new Set<SalesNavProfileScraperMode>([
  "Short",
  "Full",
  "Full + email search",
]);

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function readCookie(): string {
  const file = argValue("--cookie-file");
  if (file) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      throw new Error(`Cookie file not found: ${abs}`);
    }
    return fs.readFileSync(abs, "utf8").trim();
  }
  const env =
    process.env.LINKEDIN_SALES_NAV_COOKIE?.trim() ||
    process.env.APIFY_SALES_NAV_COOKIE?.trim() ||
    "";
  if (!env) {
    throw new Error(
      "Provide --cookie-file or set LINKEDIN_SALES_NAV_COOKIE in .env.local"
    );
  }
  return env;
}

function leadsToCsv(leads: SalesNavImportedLead[]): string {
  return buildSalesNavLeadsCsv(leads);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TERMINAL_APIFY = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

async function scrapeAsync(opts: {
  salesNavUrl: string;
  cookie: string;
  userAgent: string;
  takePages: number;
  profileScraperMode: SalesNavProfileScraperMode;
}): Promise<{ leads: SalesNavImportedLead[]; scrapedCount: number }> {
  const started = await startSalesNavSearch(opts);
  console.log(`Apify run started: ${started.apifyRunId}`);

  while (true) {
    await sleep(25_000);
    const state = await getApifyRunState(started.apifyRunId);
    console.log(
      `  ${state.status} · ${state.itemCount.toLocaleString()} items in dataset`
    );
    if (!TERMINAL_APIFY.has(state.status)) continue;

    const datasetId = state.datasetId ?? started.apifyDatasetId;
    if (state.status !== "SUCCEEDED") {
      if (datasetId && state.itemCount > 0) {
        console.warn(
          `Run ended ${state.status} — saving ${state.itemCount} partial results.`
        );
        const leads = await fetchSalesNavSearchDataset({
          datasetId,
          takePages: opts.takePages,
        });
        return { leads, scrapedCount: leads.length };
      }
      throw new SalesNavScrapeError(
        `Apify run ${state.status.toLowerCase()}.`,
        "scrape_failed"
      );
    }
    if (!datasetId) {
      throw new SalesNavScrapeError(
        "Apify run succeeded without a dataset.",
        "scrape_failed"
      );
    }
    const leads = await fetchSalesNavSearchDataset({
      datasetId,
      takePages: opts.takePages,
    });
    return { leads, scrapedCount: leads.length };
  }
}

async function main() {
  const url = argValue("--url")?.trim();
  if (!url) {
    console.error(
      "Usage: npx tsx scripts/run-sales-nav-import-to-csv.ts --url <sales-nav-url> [--cookie-file path] [--pages 4] [--mode Short|Full] [--out file.csv]"
    );
    process.exit(1);
  }

  const pages = Math.min(
    SALES_NAV_MAX_TAKE_PAGES,
    Math.max(1, Number(argValue("--pages") ?? "4") || 4)
  );
  const modeRaw = argValue("--mode")?.trim() ?? "Short";
  if (!MODES.has(modeRaw as SalesNavProfileScraperMode)) {
    throw new Error(`Invalid --mode "${modeRaw}". Use Short, Full, or "Full + email search".`);
  }
  const mode = modeRaw as SalesNavProfileScraperMode;

  const outArg = argValue("--out");
  const outPath = path.resolve(
    outArg ||
      path.join(
        process.cwd(),
        "exports",
        `sales-nav-import-${new Date().toISOString().slice(0, 10)}.csv`
      )
  );

  const cookie = readCookie();
  const userAgent =
    argValue("--user-agent")?.trim() ||
    process.env.LINKEDIN_SALES_NAV_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  const est = estimateSalesNavImportCostUsd({
    takePages: pages,
    profileCount: pages * 25,
    mode,
  });

  console.log(`Mode: ${mode}`);
  console.log(`Pages: ${pages} (up to ~${pages * 25} leads)`);
  console.log(`Est. Apify cost: ~$${est.toFixed(2)}`);
  console.log("Starting Apify scrape (large imports poll every 25s)…");

  const started = Date.now();
  const scrapeInput = {
    salesNavUrl: url,
    cookie,
    userAgent,
    takePages: pages,
    profileScraperMode: mode,
  };
  let result;
  try {
    result =
      pages > 4
        ? await scrapeAsync(scrapeInput)
        : await scrapeSalesNavSearch(scrapeInput);
  } catch (err) {
    if (err instanceof SalesNavScrapeError) {
      console.error(`Scrape failed (${err.code}): ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const elapsed = Math.round((Date.now() - started) / 1000);
  const csv = leadsToCsv(result.leads);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csv, "utf8");

  console.log(`Done in ${elapsed}s — ${result.scrapedCount} leads`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
