/**
 * Free website validation for leadrocks_leads.company_website.
 *
 * No LLM / no tokens — just DNS + HTTP status checks. Classifies each website as:
 *   live    — resolved and returned a final 2xx/3xx status
 *   dead    — DNS did not resolve, connection refused, or 404/410
 *   unknown — timeout, TLS error, or protective status (401/403/429/5xx)
 *
 * Results are written into raw.website_check (jsonb, no schema change), and a
 * CSV of dead/unknown rows is written to exports/.
 *
 * Run (default: only rows not yet checked, safe to resume):
 *   npx tsx scripts/validate-lead-websites.ts --dry-run
 *   npx tsx scripts/validate-lead-websites.ts
 *
 * Options:
 *   --dry-run           check + report, do not write raw.website_check
 *   --limit N           stop after N rows (testing)
 *   --concurrency N     parallel requests (default 24)
 *   --timeout MS        per-request timeout (default 15000)
 *   --recheck           re-check rows that already have a website_check
 *   --clear-dead        set company_website = null when status is dead (keeps the lead)
 *   --no-report         skip writing the CSV report
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

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
const clearDead = process.argv.includes("--clear-dead");
const noReport = process.argv.includes("--no-report");
const limit = Number(argValue("--limit") ?? "0") || 0;
const concurrency = Math.max(1, Number(argValue("--concurrency") ?? "24") || 24);
const timeoutMs = Math.max(2000, Number(argValue("--timeout") ?? "15000") || 15000);

const PAGE = 500;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type WebsiteStatus = "live" | "dead" | "unknown";

type WebsiteCheck = {
  status: WebsiteStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  error: string | null;
  checkedAt: string;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  company: string | null;
  company_website: string | null;
  raw: Record<string, unknown> | null;
};

function normalizeWebsiteUrl(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

function errorCode(err: unknown): string {
  const anyErr = err as { cause?: { code?: string }; name?: string; code?: string };
  return (
    anyErr?.cause?.code ??
    anyErr?.code ??
    anyErr?.name ??
    (err instanceof Error ? err.message : "unknown")
  );
}

function classify(
  httpStatus: number | null,
  errCode: string | null
): WebsiteStatus {
  if (errCode) {
    if (
      errCode === "ENOTFOUND" ||
      errCode === "EAI_AGAIN" ||
      errCode === "ECONNREFUSED" ||
      errCode === "ERR_NAME_NOT_RESOLVED"
    ) {
      return "dead";
    }
    return "unknown"; // timeout, TLS, reset, etc.
  }
  if (httpStatus == null) return "unknown";
  if (httpStatus >= 200 && httpStatus < 400) return "live";
  if (httpStatus === 404 || httpStatus === 410) return "dead";
  return "unknown"; // 401/403/429/5xx: exists but protected/transient
}

async function fetchStatus(
  url: string,
  method: "HEAD" | "GET"
): Promise<{ httpStatus: number; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
    // Drain GET bodies so sockets are released promptly.
    if (method === "GET") {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
    }
    return { httpStatus: res.status, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWebsite(rawUrl: string): Promise<WebsiteCheck> {
  const checkedAt = new Date().toISOString();
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) {
    return {
      status: "dead",
      httpStatus: null,
      finalUrl: null,
      error: "malformed_url",
      checkedAt,
    };
  }

  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let errCode: string | null = null;

  try {
    const head = await fetchStatus(url, "HEAD");
    httpStatus = head.httpStatus;
    finalUrl = head.finalUrl;
    // Some servers mishandle HEAD — retry with GET on 405/501 or 4xx/5xx.
    if (httpStatus === 405 || httpStatus === 501 || httpStatus >= 400) {
      try {
        const get = await fetchStatus(url, "GET");
        httpStatus = get.httpStatus;
        finalUrl = get.finalUrl;
      } catch {
        /* keep HEAD result */
      }
    }
  } catch (headErr) {
    // HEAD failed outright — try GET before giving up.
    try {
      const get = await fetchStatus(url, "GET");
      httpStatus = get.httpStatus;
      finalUrl = get.finalUrl;
    } catch (getErr) {
      errCode = errorCode(getErr) || errorCode(headErr);
    }
  }

  return {
    status: classify(httpStatus, errCode),
    httpStatus,
    finalUrl,
    error: errCode,
    checkedAt,
  };
}

async function fetchNextBatch(): Promise<LeadRow[]> {
  let query = supabase
    .from("leadrocks_leads")
    .select("id, full_name, company, company_website, raw")
    .not("company_website", "is", null)
    .neq("company_website", "")
    .order("id", { ascending: true })
    .limit(PAGE);

  if (!recheck) {
    // Drain loop: only rows without a website_check yet.
    query = query.is("raw->website_check", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

// Offset pagination is needed for --recheck (rows never leave the set).
async function fetchOffsetBatch(offset: number): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from("leadrocks_leads")
    .select("id, full_name, company, company_website, raw")
    .not("company_website", "is", null)
    .neq("company_website", "")
    .order("id", { ascending: true })
    .range(offset, offset + PAGE - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  poolSize = concurrency
): Promise<void> {
  let idx = 0;
  const runners = Array.from(
    { length: Math.min(poolSize, items.length) },
    async () => {
      while (idx < items.length) {
        const cur = items[idx++];
        await worker(cur);
      }
    }
  );
  await Promise.all(runners);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateLeadRow(
  row: LeadRow,
  check: WebsiteCheck
): Promise<boolean> {
  const nextRaw = {
    ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
    website_check: check,
  };
  const patch: { raw: Record<string, unknown>; company_website?: null } = {
    raw: nextRaw,
  };
  if (clearDead && check.status === "dead") {
    patch.company_website = null;
  }

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { error } = await supabase
      .from("leadrocks_leads")
      .update(patch)
      .eq("id", row.id);
    if (!error) return true;
    if (attempt === 4) {
      console.error(`  update failed ${row.id}: ${error.message}`);
      return false;
    }
    await sleep(400 * attempt);
  }
  return false;
}

async function main() {
  console.log(
    `[website-validate] start${dryRun ? " (dry-run)" : ""}` +
      ` concurrency=${concurrency} timeout=${timeoutMs}ms` +
      `${recheck ? " (recheck all)" : " (unchecked only)"}` +
      `${clearDead ? " clear-dead=on" : ""}` +
      `${limit ? ` limit=${limit}` : ""}`
  );

  const tally = { live: 0, dead: 0, unknown: 0, cleared: 0 };
  const reportRows: string[] = [
    "id,full_name,company,company_website,status,http_status,final_url,error",
  ];
  let processed = 0;
  let offset = 0;

  while (true) {
    const fetched = recheck
      ? await fetchOffsetBatch(offset)
      : await fetchNextBatch();
    if (fetched.length === 0) break;

    const batch = limit
      ? fetched.slice(0, Math.max(0, limit - processed))
      : fetched;
    if (batch.length === 0) break;

    const results = new Map<string, WebsiteCheck>();

    await runPool(batch, async (row) => {
      if (!row.company_website) return;
      const check = await checkWebsite(row.company_website);
      results.set(row.id, check);
      tally[check.status] += 1;

      if (check.status !== "live") {
        reportRows.push(
          [
            row.id,
            csv(row.full_name),
            csv(row.company),
            csv(row.company_website),
            check.status,
            check.httpStatus ?? "",
            csv(check.finalUrl),
            csv(check.error),
          ].join(",")
        );
      }
    });

    if (!dryRun) {
      let clearedThisBatch = 0;
      await runPool(
        batch,
        async (row) => {
          const check = results.get(row.id);
          if (!check) return;
          const ok = await updateLeadRow(row, check);
          if (ok && clearDead && check.status === "dead") {
            clearedThisBatch += 1;
          }
        },
        6
      );
      tally.cleared += clearedThisBatch;
    } else if (clearDead) {
      for (const row of batch) {
        const check = results.get(row.id);
        if (check?.status === "dead") tally.cleared += 1;
      }
    }

    processed += batch.length;
    offset += fetched.length;
    console.log(
      `[website-validate] processed=${processed}` +
        ` live=${tally.live} dead=${tally.dead} unknown=${tally.unknown}` +
        (clearDead ? ` would_clear=${tally.cleared}` : "")
    );

    if (limit && processed >= limit) break;
    // In drain mode a dry-run never removes rows, so stop after one pass.
    if (!recheck && dryRun) break;
  }

  if (!noReport && reportRows.length > 1) {
    const outPath = path.join(
      process.cwd(),
      "exports",
      `website-validation-${new Date().toISOString().slice(0, 10)}.csv`
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, reportRows.join("\n") + "\n", "utf8");
    console.log(`[website-validate] wrote report: ${outPath}`);
  }

  console.log(
    `[website-validate] done. processed=${processed}` +
      ` live=${tally.live} dead=${tally.dead} unknown=${tally.unknown}` +
      (clearDead ? ` cleared=${tally.cleared}` : "") +
      (dryRun ? " (dry-run — nothing written)" : "")
  );
}

function csv(value: string | null | undefined): string {
  const v = (value ?? "").toString();
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

main().catch((err) => {
  console.error("[website-validate] fatal:", err);
  process.exit(1);
});
