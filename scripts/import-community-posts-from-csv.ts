/**
 * One-off: import community posts from CSV (e.g. Disco export) linked by member email.
 *
 * CSV columns expected: Title, Content, Date Posted, Member Name, Member Email, Category
 *
 * Category mapping:
 *   - "community" (any case) → app category slug `general` (💬 General Discussion)
 *   - Other values → matched loosely to existing `community_categories.slug`
 *
 * Prerequisites:
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Members already exist in Auth + profiles (same emails as CSV)
 *
 * Date Posted:
 *   - Unambiguous: 27/04/2026 → day 27; 4/23/2026 → month 4 day 23.
 *   - Ambiguous (both ≤12): defaults to M/D/Y (Disco-style: 5/1/2026 = 1 May). Override with
 *     COMMUNITY_POST_CSV_AMBIGUOUS_ORDER=dmy in .env.local for UK day-first.
 *   - Also accepts ISO YYYY-MM-DD.
 *
 * Re-import after fixing dates (deletes same author+title then inserts):
 *   npx tsx scripts/import-community-posts-from-csv.ts --replace-same-author-title "/path/to.csv"
 *
 * Usage:
 *   npx tsx scripts/import-community-posts-from-csv.ts --dry-run "/path/to.csv"
 *   npx tsx scripts/import-community-posts-from-csv.ts --dry-run --verbose-dates "/path/to.csv"
 *   npx tsx scripts/import-community-posts-from-csv.ts "/path/to.csv"
 *   npx tsx scripts/import-community-posts-from-csv.ts --replace-same-author-title "/path/to.csv"
 *   npx tsx scripts/import-community-posts-from-csv.ts --continue-on-error "/path/to/file.csv"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient, type User } from "@supabase/supabase-js";
import { DateTime } from "luxon";

import { capitalizeFirstUnicodeLetter } from "../src/lib/communityPostCapitalize";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const continueOnError = argv.includes("--continue-on-error");
const verboseDates = argv.includes("--verbose-dates");
const replaceSameAuthorTitle = argv.includes("--replace-same-author-title");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npx tsx scripts/import-community-posts-from-csv.ts [--dry-run] [--continue-on-error] <path-to.csv>"
  );
  process.exit(1);
}

const resolvedCsv = path.resolve(csvPath.trim());
if (!fs.existsSync(resolvedCsv)) {
  console.error(`CSV not found: ${resolvedCsv}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type CsvRow = Record<string, string>;

/** CSV "Category" → `community_categories.slug` */
function categorySlugFromCsv(raw: string | undefined): string {
  const key = raw?.trim().toLowerCase() ?? "";
  if (!key) return "general";
  if (key === "community") return "general";
  if (key.includes("general")) return "general";
  if (key.includes("win")) return "wins";
  if (key.includes("announce")) return "announcements";
  if (key.includes("feedback") || key.includes("technical"))
    return "requesting-feedback";
  if (key.includes("intro") || key.includes("resource")) return "intros";
  const normalized = key.replace(/\s+/g, "-");
  return normalized;
}

function ambiguousSlashOrder(): "mdy" | "dmy" {
  const v = process.env.COMMUNITY_POST_CSV_AMBIGUOUS_ORDER?.trim().toLowerCase();
  if (v === "dmy" || v === "uk") return "dmy";
  return "mdy";
}

/**
 * Slash dates from Disco/CSV: unambiguous segments use day>12 or month>12;
 * when both ≤12, defaults to M/D/Y (e.g. 5/1/2026 → 1 May) unless env sets dmy.
 */
function parsePostedAtIso(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const dt = DateTime.fromISO(t.slice(0, 10), { zone: "utc" });
    return dt.isValid ? dt.startOf("day").toISO() : null;
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const a = parseInt(m[1]!, 10);
  const b = parseInt(m[2]!, 10);
  const year = parseInt(m[3]!, 10);
  let dt: DateTime;
  if (a > 12) {
    dt = DateTime.fromObject({ year, month: b, day: a }, { zone: "utc" });
  } else if (b > 12) {
    dt = DateTime.fromObject({ year, month: a, day: b }, { zone: "utc" });
  } else if (ambiguousSlashOrder() === "dmy") {
    dt = DateTime.fromObject({ year, month: b, day: a }, { zone: "utc" });
  } else {
    dt = DateTime.fromObject({ year, month: a, day: b }, { zone: "utc" });
  }
  if (!dt.isValid) return null;
  return dt.startOf("day").toISO();
}

async function loadAuthUsersByEmail(): Promise<Map<string, User>> {
  const byEmail = new Map<string, User>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const users = data.users ?? [];
    for (const u of users) {
      if (u.email) byEmail.set(u.email.trim().toLowerCase(), u);
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return byEmail;
}

async function loadCategorySlugToId(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("community_categories")
    .select("id, slug");
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const slug = row.slug as string;
    map.set(slug, row.id as string);
  }
  return map;
}

function resolveCategoryId(
  slugMap: Map<string, string>,
  csvCategory: string | undefined
): { slug: string; id: string | null } {
  let slug = categorySlugFromCsv(csvCategory);
  let id = slugMap.get(slug) ?? null;
  if (!id && slug !== "general") {
    slug = "general";
    id = slugMap.get("general") ?? null;
  }
  return { slug, id };
}

async function main() {
  const raw = fs.readFileSync(resolvedCsv, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_column_count: true,
    relax_quotes: true,
  }) as CsvRow[];

  const slugToId = await loadCategorySlugToId();
  if (!slugToId.size) {
    console.error("[import-posts] No community_categories rows found.");
    process.exit(1);
  }

  const byEmail = dryRun ? new Map<string, User>() : await loadAuthUsersByEmail();

  let missingAuthor = 0;
  let missingCategory = 0;
  const categoryCounts = new Map<string, number>();

  for (const row of rows) {
    const email = row["Member Email"]?.trim().toLowerCase();
    if (!email) {
      missingAuthor += 1;
      continue;
    }
    if (dryRun) {
      const { slug } = resolveCategoryId(slugToId, row["Category"]);
      categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
      continue;
    }
    if (!byEmail.has(email)) missingAuthor += 1;
    const { slug, id: catId } = resolveCategoryId(slugToId, row["Category"]);
    categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
    if (!catId) missingCategory += 1;
  }

  console.log(
    `[import-posts] rows=${rows.length} dryRun=${dryRun} categories=${JSON.stringify(Object.fromEntries(categoryCounts))} ambiguousOrder=${ambiguousSlashOrder()} replaceSameAuthorTitle=${replaceSameAuthorTitle}`
  );
  if (dryRun && verboseDates) {
    console.log("[import-posts] parsed dates (verify before real import):");
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]!["Date Posted"];
      const iso = parsePostedAtIso(raw);
      const title = rows[i]!["Title"]?.trim().slice(0, 50) ?? "";
      console.log(
        `  row ${i + 2}: "${String(raw).trim()}" → ${iso ?? "INVALID"}  (${title}…)`
      );
    }
  }
  if (dryRun) {
    console.log(
      `[import-posts] dry-run: unknown emails in CSV (cannot resolve without listing auth) — import will skip rows with no matching user.`
    );
    return;
  }

  console.log(
    `[import-posts] auth users loaded=${byEmail.size} missingAuthorRows≈${missingAuthor} (includes empty email)`
  );

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = capitalizeFirstUnicodeLetter(row["Title"]?.trim() ?? "");
    const body = capitalizeFirstUnicodeLetter(row["Content"]?.trim() ?? "");
    const email = row["Member Email"]?.trim().toLowerCase();
    const posted = parsePostedAtIso(row["Date Posted"]);

    if (!email || !title) {
      console.warn(
        `[import-posts] row ${i + 2}: skip (missing email or title)`
      );
      skipped += 1;
      continue;
    }

    const user = byEmail.get(email);
    if (!user) {
      console.warn(
        `[import-posts] row ${i + 2}: no Auth user for email=${email} — ${title.slice(0, 40)}…`
      );
      skipped += 1;
      continue;
    }

    const { slug, id: categoryId } = resolveCategoryId(slugToId, row["Category"]);
    if (!categoryId) {
      console.warn(
        `[import-posts] row ${i + 2}: unknown category slug=${slug} — skip`
      );
      skipped += 1;
      continue;
    }

    const createdAt = posted ?? new Date().toISOString();

    try {
      if (replaceSameAuthorTitle) {
        const { error: delErr } = await supabase
          .from("community_posts")
          .delete()
          .eq("author_id", user.id)
          .eq("title", title);
        if (delErr) throw new Error(`delete existing: ${delErr.message}`);
      }

      const { error } = await supabase.from("community_posts").insert({
        author_id: user.id,
        category_id: categoryId,
        title,
        body,
        is_pinned: false,
        image_url: null,
        media: null,
        created_at: createdAt,
        updated_at: createdAt,
      });
      if (error) throw new Error(error.message);
      inserted += 1;
      if (inserted % 20 === 0) {
        console.log(`[import-posts] inserted ${inserted}…`);
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[import-posts] FAILED row ${i + 2} ${email} "${title.slice(0, 50)}": ${msg}`
      );
      if (!continueOnError) {
        console.error(
          "[import-posts] stopping (pass --continue-on-error to proceed)"
        );
        process.exit(1);
      }
    }
  }

  console.log(
    `[import-posts] done inserted=${inserted} skipped=${skipped} failed=${failed}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
