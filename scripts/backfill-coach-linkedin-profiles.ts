/**
 * Scrape LinkedIn profiles for coaches/admins with a `profiles.linkedin_url`.
 *
 * Eligibility modes (combine freely):
 *   --months=N              signed in within last N months (default 6 if no other mode)
 *   --joined-since=YYYY-MM-DD  disco join / created_at on or after date
 *   --vip                   named all-time / case-study coaches (Ashley Maile, etc.)
 *   --top                   high ladder, meaningful reported income, or client_results
 *
 * Other flags:
 *   --dry-run
 *   --force                 re-scrape even if snapshot exists
 *   --apply-avatars         also fill missing community avatars from LinkedIn photos
 *
 * Examples:
 *   npx tsx scripts/backfill-coach-linkedin-profiles.ts --dry-run
 *   npx tsx scripts/backfill-coach-linkedin-profiles.ts --joined-since=2024-01-01 --vip --top --apply-avatars
 *   npx tsx scripts/backfill-coach-linkedin-profiles.ts --months=6
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import {
  LinkedInProfileError,
  normalizeLinkedInProfileUrl,
  scrapeLinkedInProfile,
} from "../src/lib/apify/linkedinProfile";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const includeVip = process.argv.includes("--vip");
const includeTop = process.argv.includes("--top");
const applyAvatars = process.argv.includes("--apply-avatars");

const monthsArg = process.argv.find((a) => a.startsWith("--months="));
const joinedArg = process.argv.find((a) => a.startsWith("--joined-since="));

const monthsExplicit = Boolean(monthsArg);
const joinedSince = joinedArg
  ? new Date(`${joinedArg.slice("--joined-since=".length)}T00:00:00.000Z`)
  : null;

const useRecentLogin =
  monthsExplicit || (!joinedSince && !includeVip && !includeTop);
const months = monthsArg
  ? Math.max(1, Number.parseInt(monthsArg.slice("--months=".length), 10) || 6)
  : 6;

/** Named all-time / case-study coaches (match full_name case-insensitive). */
const VIP_FULL_NAMES = [
  "Ashley Maile",
  "James Baker",
  "John Mccarthy",
  "John McCarthy",
  "Emerson Patton",
  "Ian Finney",
  "Nick Summers",
];

const HIGH_LADDER_LEVELS = new Set([
  "gold",
  "platinum",
  "emerald",
  "ruby",
  "sapphire",
  "diamond",
  "blue_diamond",
  "black_diamond",
]);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ProfileRow = {
  id: string;
  full_name: string | null;
  linkedin_url: string;
  role: string;
  disco_community_joined_on: string | null;
  created_at: string | null;
  coaching_income_reported_2024: string | null;
  ai_context: unknown;
};

function resolvedJoinAt(row: ProfileRow): Date | null {
  const raw = row.disco_community_joined_on ?? row.created_at;
  if (!raw) return null;
  const iso = String(raw).includes("T") ? String(raw) : `${raw}T12:00:00.000Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

function hasMeaningfulIncome(raw: string | null): boolean {
  if (!raw) return false;
  const s = raw.trim();
  if (!s || /^(0|none|n\/a|zero|nil|\£?0(\.00)?|\$0)$/i.test(s)) return false;
  const digits = s.replace(/[^\d.]/g, "");
  const n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) return /k\b/i.test(s);
  return n >= 1000;
}

function hasClientResults(aiContext: unknown): boolean {
  if (!aiContext || typeof aiContext !== "object") return false;
  const results = (aiContext as { client_results?: unknown }).client_results;
  return Array.isArray(results) && results.length > 0;
}

async function listRecentSignInIds(cutoff: Date): Promise<Set<string>> {
  const recent = new Set<string>();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    }
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.last_sign_in_at && new Date(user.last_sign_in_at) >= cutoff) {
        recent.add(user.id);
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return recent;
}

async function main() {
  if (joinedSince && Number.isNaN(joinedSince.getTime())) {
    console.error("Invalid --joined-since date. Use YYYY-MM-DD.");
    process.exit(1);
  }

  const loginCutoff = new Date();
  loginCutoff.setMonth(loginCutoff.getMonth() - months);

  console.log(
    `[linkedin-backfill]` +
      `${dryRun ? " dry-run" : ""}` +
      `${force ? " force" : ""}` +
      `${applyAvatars ? " apply-avatars" : ""}` +
      `${useRecentLogin ? ` months=${months}` : ""}` +
      `${joinedSince ? ` joined-since=${joinedSince.toISOString().slice(0, 10)}` : ""}` +
      `${includeVip ? " vip" : ""}` +
      `${includeTop ? " top" : ""}`
  );

  if (!dryRun && !process.env.APIFY_TOKEN?.trim()) {
    console.error("Missing APIFY_TOKEN in env.");
    process.exit(1);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, full_name, linkedin_url, role, disco_community_joined_on, created_at, coaching_income_reported_2024, ai_context"
    )
    .in("role", ["coach", "admin"])
    .not("linkedin_url", "is", null)
    .neq("linkedin_url", "");

  if (profilesError) {
    console.error("[linkedin-backfill] profiles query failed:", profilesError);
    process.exit(1);
  }

  const withUrl = (profiles ?? []) as ProfileRow[];
  console.log(`[linkedin-backfill] profiles with linkedin_url: ${withUrl.length}`);

  const recentIds = useRecentLogin
    ? await listRecentSignInIds(loginCutoff)
    : new Set<string>();
  if (useRecentLogin) {
    console.log(
      `[linkedin-backfill] users signed in within ${months} months: ${recentIds.size}`
    );
  }

  const vipNameSet = new Set(
    VIP_FULL_NAMES.map((n) => n.trim().toLowerCase())
  );
  const vipIds = new Set<string>();
  if (includeVip) {
    for (const row of withUrl) {
      const name = (row.full_name ?? "").trim().toLowerCase();
      if (vipNameSet.has(name)) vipIds.add(row.id);
    }
    // Also fuzzy-match Ashley Maile spelling variants
    for (const row of withUrl) {
      const name = (row.full_name ?? "").trim().toLowerCase();
      if (name.includes("ashley") && (name.includes("maile") || name.includes("mail"))) {
        vipIds.add(row.id);
      }
    }
    console.log(`[linkedin-backfill] vip matches: ${vipIds.size}`);
  }

  const topIds = new Set<string>();
  if (includeTop) {
    const { data: ladder, error: ladderError } = await supabase
      .from("community_ladder_achievements")
      .select("user_id, level_id");
    if (ladderError) {
      console.error("[linkedin-backfill] ladder query failed:", ladderError);
      process.exit(1);
    }
    for (const row of ladder ?? []) {
      if (HIGH_LADDER_LEVELS.has(row.level_id as string)) {
        topIds.add(row.user_id as string);
      }
    }
    for (const row of withUrl) {
      if (hasMeaningfulIncome(row.coaching_income_reported_2024)) {
        topIds.add(row.id);
      }
      if (hasClientResults(row.ai_context)) {
        topIds.add(row.id);
      }
    }
    console.log(`[linkedin-backfill] top matches (ladder/income/results): ${topIds.size}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, scraped_at");

  if (existingError) {
    console.error(
      "[linkedin-backfill] coach_linkedin_profiles query failed:",
      existingError
    );
    process.exit(1);
  }

  const scrapedAtByCoach = new Map<string, string>();
  for (const row of existingRows ?? []) {
    scrapedAtByCoach.set(row.coach_id as string, row.scraped_at as string);
  }

  const eligible: Array<ProfileRow & { reasons: string[] }> = [];
  let skippedInvalidUrl = 0;
  let skippedAlreadyScraped = 0;
  let skippedNotInCohort = 0;

  for (const row of withUrl) {
    const reasons: string[] = [];
    if (useRecentLogin && recentIds.has(row.id)) reasons.push("recent_login");
    if (joinedSince) {
      const joined = resolvedJoinAt(row);
      if (joined && joined >= joinedSince) reasons.push("joined_since");
    }
    if (includeVip && vipIds.has(row.id)) reasons.push("vip");
    if (includeTop && topIds.has(row.id)) reasons.push("top");

    if (reasons.length === 0) {
      skippedNotInCohort += 1;
      continue;
    }

    const normalized = normalizeLinkedInProfileUrl(row.linkedin_url);
    if (!normalized) {
      skippedInvalidUrl += 1;
      console.log(
        `  skip invalid url: ${row.full_name ?? row.id} — ${row.linkedin_url}`
      );
      continue;
    }
    if (!force && scrapedAtByCoach.has(row.id)) {
      skippedAlreadyScraped += 1;
      continue;
    }
    eligible.push({ ...row, linkedin_url: normalized, reasons });
  }

  console.log(
    `[linkedin-backfill] to scrape: ${eligible.length}` +
      ` (not in cohort: ${skippedNotInCohort}, invalid url: ${skippedInvalidUrl}, already scraped: ${skippedAlreadyScraped})`
  );

  if (dryRun) {
    for (const row of eligible) {
      console.log(
        `  - ${row.full_name ?? row.id}  [${row.reasons.join(",")}]  ${row.linkedin_url}`
      );
    }
    console.log("[linkedin-backfill] dry-run complete (no Apify calls).");
    return;
  }

  let ok = 0;
  let failed = 0;
  let avatarsApplied = 0;

  for (let i = 0; i < eligible.length; i += 1) {
    const row = eligible[i]!;
    const label = row.full_name ?? row.id;
    process.stdout.write(
      `[${i + 1}/${eligible.length}] ${label} [${row.reasons.join(",")}] — ${row.linkedin_url} … `
    );

    try {
      const result = await scrapeLinkedInProfile(row.linkedin_url);
      const scrapedAt = new Date().toISOString();

      const { error: upsertError } = await supabase
        .from("coach_linkedin_profiles")
        .upsert(
          {
            coach_id: row.id,
            linkedin_url: result.linkedinUrl,
            scraped_at: scrapedAt,
            snapshot: result.snapshot,
            raw: result.raw,
            updated_at: scrapedAt,
          },
          { onConflict: "coach_id" }
        );

      if (upsertError) {
        failed += 1;
        console.log(`SAVE ERROR (${upsertError.message})`);
        continue;
      }

      await supabase
        .from("profiles")
        .update({ linkedin_url: result.linkedinUrl })
        .eq("id", row.id);

      let avatarNote = "";
      if (applyAvatars) {
        const { applyLinkedInPhotoAsAvatarIfMissing } = await import(
          "../src/lib/apify/applyLinkedInAvatar"
        );
        const avatarResult = await applyLinkedInPhotoAsAvatarIfMissing(
          row.id,
          result.snapshot.photoUrl
        );
        if (avatarResult.status === "applied") {
          avatarsApplied += 1;
          avatarNote = " +avatar";
        }
      }

      ok += 1;
      const name =
        result.snapshot.firstName || result.snapshot.lastName
          ? `${result.snapshot.firstName ?? ""} ${result.snapshot.lastName ?? ""}`.trim()
          : result.snapshot.headline ?? "ok";
      console.log(`${name}${avatarNote}`);
    } catch (err) {
      failed += 1;
      const message =
        err instanceof LinkedInProfileError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      console.log(`FAIL (${message})`);
    }
  }

  console.log(
    `[linkedin-backfill] done. ok=${ok} failed=${failed} total=${eligible.length}` +
      (applyAvatars ? ` avatars_applied=${avatarsApplied}` : "")
  );
}

main().catch((err) => {
  console.error("[linkedin-backfill] fatal:", err);
  process.exit(1);
});
