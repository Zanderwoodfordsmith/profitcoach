/**
 * One-off: create Auth users + profiles (+ coaches row for coaches) from Disco export CSV.
 *
 * Prerequisites:
 *   - Apply migration `20260606120000_profiles_disco_import_fields.sql` in Supabase
 *     (adds `timezone` + Disco columns). Required or inserts fail on missing columns.
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/import-disco-members-from-csv.ts --dry-run "/path/to/Members info from disco. .csv"
 *   npx tsx scripts/import-disco-members-from-csv.ts "/path/to/file.csv"
 *   npx tsx scripts/import-disco-members-from-csv.ts --continue-on-error "/path/to/file.csv"
 *
 * Passwords (defaults match your request):
 *   COACH_IMPORT_PASSWORD=bcalogin
 *   ADMIN_IMPORT_PASSWORD=BCAlogin!23
 *
 * Re-run on the same CSV updates existing profiles (including join / last-seen dates).
 * Slash dates ambiguous both ≤12: default M/D/Y; set DISCO_MEMBER_CSV_AMBIGUOUS_DATE_ORDER=dmy for UK.
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { parse } from "csv-parse/sync";
import { createClient, type User } from "@supabase/supabase-js";
import { DateTime } from "luxon";

import { splitFullName } from "../src/lib/splitFullName";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COACH_PASSWORD =
  process.env.COACH_IMPORT_PASSWORD?.trim() || "bcalogin";
const ADMIN_PASSWORD =
  process.env.ADMIN_IMPORT_PASSWORD?.trim() || "BCAlogin!23";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const continueOnError = argv.includes("--continue-on-error");
const csvPath = argv.filter((a) => !a.startsWith("--")).at(0);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!csvPath?.trim()) {
  console.error(
    "Usage: npx tsx scripts/import-disco-members-from-csv.ts [--dry-run] [--continue-on-error] <path-to.csv>"
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

function parseMembershipTier(membershipPlan: string | undefined): string | null {
  if (!membershipPlan?.trim()) return null;
  const tail = membershipPlan.split("|").pop()?.trim() ?? "";
  if (!tail) return null;
  const t = tail.toLowerCase();
  if (t.includes("part")) return "Part-time";
  if (t.includes("professional")) return "Professional";
  if (t.includes("elite")) return "Elite";
  return tail;
}

function ambiguousProfileDateOrder(): "mdy" | "dmy" {
  const v = process.env.DISCO_MEMBER_CSV_AMBIGUOUS_DATE_ORDER?.trim().toLowerCase();
  if (v === "dmy" || v === "uk") return "dmy";
  return "mdy";
}

/**
 * Values for Postgres `date` columns (`disco_last_seen_on`, `disco_community_joined_on`).
 * Accepts `YYYY-MM-DD`, ISO datetime prefix, or `M/D/YYYY` / `D/M/YYYY` (ambiguous → M/D unless env dmy).
 */
function parseProfileDateColumn(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
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
  } else if (ambiguousProfileDateOrder() === "dmy") {
    dt = DateTime.fromObject({ year, month: b, day: a }, { zone: "utc" });
  } else {
    dt = DateTime.fromObject({ year, month: a, day: b }, { zone: "utc" });
  }
  return dt.isValid ? dt.toFormat("yyyy-MM-dd") : null;
}

function normalizeProfileRole(roleRaw: string | undefined): "admin" | "coach" {
  const r = roleRaw?.trim().toLowerCase();
  return r === "admin" ? "admin" : "coach";
}

function baseSlugFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "coach").toLowerCase();
  let s = local
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) s = "coach";
  return s.slice(0, 48);
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

async function coachSlugExists(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

async function allocateCoachSlug(email: string): Promise<string> {
  const base = baseSlugFromEmail(email);
  if (!(await coachSlugExists(base))) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`.slice(0, 60);
    if (!(await coachSlugExists(candidate))) return candidate;
  }
  throw new Error(`Could not allocate slug for ${email}`);
}

function emptyToNull(s: string | undefined): string | null {
  const v = s?.trim();
  return v ? v : null;
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

  let coachCount = 0;
  let adminCount = 0;
  for (const row of rows) {
    const role = normalizeProfileRole(row["Role"]);
    if (role === "admin") adminCount += 1;
    else coachCount += 1;
  }

  console.log(
    `[import] rows=${rows.length} parsed (coaches=${coachCount}, admins=${adminCount}) dryRun=${dryRun}`
  );

  if (dryRun) {
    const tiers = new Map<string, number>();
    for (const row of rows) {
      const t = parseMembershipTier(row["Membership Plan"]) ?? "(none)";
      tiers.set(t, (tiers.get(t) ?? 0) + 1);
    }
    console.log("[import] membership_tier distribution:", Object.fromEntries(tiers));
    return;
  }

  const existingByEmail = await loadAuthUsersByEmail();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const emailRaw = row["Email"]?.trim().toLowerCase();
    if (!emailRaw) {
      console.warn(`[import] row ${i + 2}: missing email, skip`);
      skipped += 1;
      continue;
    }

    const firstName = row["First Name"]?.trim() ?? "";
    const lastName = row["Last Name"]?.trim() ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || emailRaw;
    const { first_name, last_name } = splitFullName(fullName);
    const profileRole = normalizeProfileRole(row["Role"]);
    const password =
      profileRole === "admin" ? ADMIN_PASSWORD : COACH_PASSWORD;

    const profilePayload = {
      role: profileRole,
      full_name: fullName,
      first_name,
      last_name,
      coach_business_name: null as string | null,
      bio: emptyToNull(row["Short Bio"]),
      linkedin_url: emptyToNull(row["LinkedIn Profile URL"]),
      timezone: emptyToNull(row["Local Timezone"]),
      discord_user_id: emptyToNull(row["Disco User ID"]),
      industry: emptyToNull(row["Industry"]),
      previous_company: emptyToNull(row["Previous Company"]),
      member_since_note: emptyToNull(row["Member Since"]),
      disco_last_seen_on: parseProfileDateColumn(row["Last Seen"]),
      disco_community_joined_on: parseProfileDateColumn(
        row["Joined Community On"]
      ),
      membership_tier: parseMembershipTier(row["Membership Plan"]),
      coaching_income_reported_2024: emptyToNull(
        row["2024 Coaching Income"]
      ),
    };

    const label = `${emailRaw} (${fullName})`;

    try {
      let userId: string;

      const existing = existingByEmail.get(emailRaw);
      if (existing) {
        userId = existing.id;
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (existingProfile) {
          const { error: upErr } = await supabase
            .from("profiles")
            .update(profilePayload)
            .eq("id", userId);
          if (upErr) throw new Error(upErr.message);
        } else {
          const { error: insProfErr } = await supabase
            .from("profiles")
            .insert({ id: userId, ...profilePayload });
          if (insProfErr) throw new Error(insProfErr.message);
        }
        updated += 1;
        console.log(`[import] upserted profile ${label}`);

        if (profileRole === "coach") {
          const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("id", userId)
            .maybeSingle();
          if (!coachRow) {
            const slug = await allocateCoachSlug(emailRaw);
            const { error: cErr } = await supabase
              .from("coaches")
              .insert({ id: userId, slug });
            if (cErr) throw new Error(`coaches insert: ${cErr.message}`);
            console.log(`[import] added coaches row slug=${slug} for ${label}`);
          }
        }
      } else {
        const { data: authData, error: createErr } =
          await supabase.auth.admin.createUser({
            email: emailRaw,
            password,
            email_confirm: true,
          });
        if (createErr || !authData.user) {
          throw new Error(createErr?.message ?? "createUser failed");
        }
        userId = authData.user.id;
        existingByEmail.set(emailRaw, authData.user);

        const { error: insErr } = await supabase.from("profiles").insert({
          id: userId,
          ...profilePayload,
        });
        if (insErr) {
          await supabase.auth.admin.deleteUser(userId);
          throw new Error(`profiles insert: ${insErr.message}`);
        }

        if (profileRole === "coach") {
          const slug = await allocateCoachSlug(emailRaw);
          const { error: cErr } = await supabase
            .from("coaches")
            .insert({ id: userId, slug });
          if (cErr) {
            await supabase.from("profiles").delete().eq("id", userId);
            await supabase.auth.admin.deleteUser(userId);
            throw new Error(`coaches insert: ${cErr.message}`);
          }
          console.log(`[import] created ${label} slug=${slug}`);
        } else {
          console.log(`[import] created admin ${label}`);
        }
        created += 1;
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[import] FAILED ${label}: ${msg}`);
      if (!continueOnError) {
        console.error("[import] stopping (pass --continue-on-error to proceed)");
        process.exit(1);
      }
    }
  }

  console.log(
    `[import] done created=${created} updated=${updated} skipped=${skipped} failed=${failed}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
