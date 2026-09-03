/**
 * Export coaches for Business Coach Academy / marketing site use.
 *
 * Includes join dates, bios, directory + LinkedIn links, emails, photos,
 * and client-result stories from ai_context when present.
 *
 * Run:
 *   npx tsx scripts/export-coaches-marketing-csv.ts
 *   npx tsx scripts/export-coaches-marketing-csv.ts --base-url https://www.theprofitcoach.com
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  resolveDirectoryBio,
  resolveDirectorySummary,
} from "../src/lib/profileBioFields";
import type { CoachAiContext } from "../src/lib/profitCoachAi/types";

const SYSTEM_COACH_SLUGS = new Set(["profit-coach-snapshot", "zander-demo"]);

function isSystemCoachSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return SYSTEM_COACH_SLUGS.has(slug.trim().toLowerCase());
}

function resolveCoachJoinedAt(
  slug: string | null | undefined,
  options: {
    discoCommunityJoinedOn?: string | null;
    profileCreatedAt?: string | null;
  }
): string | null {
  if (options.discoCommunityJoinedOn) return options.discoCommunityJoinedOn;
  if (isSystemCoachSlug(slug)) return null;
  return options.profileCreatedAt ?? null;
}

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

/** Marketing links should be production unless explicitly overridden. */
const DIRECTORY_BASE = (
  argValue("--base-url")?.trim() ||
  "https://www.theprofitcoach.com"
).replace(/\/$/, "");

type ProfileEmbed = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  location: string | null;
  linkedin_url: string | null;
  industry: string | null;
  previous_company: string | null;
  bio: string | null;
  community_bio: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
  disco_community_joined_on: string | null;
  member_since_note: string | null;
  created_at: string | null;
  coaching_income_reported_2024: string | null;
  ai_context: CoachAiContext | null;
  role: string | null;
};

type CoachRow = {
  id: string;
  slug: string;
  directory_listed: boolean | null;
  directory_level: string | null;
  access_tier: string | null;
  membership_status: string | null;
  record_kind: string | null;
  conference_status: string | null;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
};

function csvCell(value: string): string {
  const s = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function asProfile(raw: CoachRow["profiles"]): ProfileEmbed | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function formatJoinDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatClientResults(ctx: CoachAiContext | null | undefined): string {
  const results = ctx?.client_results ?? [];
  if (!results.length) return "";
  return results
    .map((r) => {
      const title = (r.title ?? "").trim();
      const story = (r.story ?? "").trim();
      if (title && story) return `${title}: ${story}`;
      return title || story;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

async function loadEmailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error("Failed to list auth users:", error.message);
      process.exit(1);
    }
    const users = data.users ?? [];
    for (const user of users) {
      if (user.email) map.set(user.id, user.email);
    }
    if (users.length < 1000) break;
  }
  return map;
}

async function loadCoaches(): Promise<CoachRow[]> {
  const pageSize = 1000;
  const rows: CoachRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("coaches")
      .select(
        `
        id,
        slug,
        directory_listed,
        directory_level,
        access_tier,
        membership_status,
        record_kind,
        conference_status,
        profiles!inner (
          full_name,
          first_name,
          last_name,
          coach_business_name,
          avatar_url,
          location,
          linkedin_url,
          industry,
          previous_company,
          bio,
          community_bio,
          directory_summary,
          directory_bio,
          disco_community_joined_on,
          member_since_note,
          created_at,
          coaching_income_reported_2024,
          ai_context,
          role
        )
      `
      )
      .order("slug", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Failed to load coaches:", error.message);
      process.exit(1);
    }

    const batch = (data ?? []) as unknown as CoachRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function shouldInclude(row: CoachRow, profile: ProfileEmbed | null): boolean {
  if (!profile) return false;
  if (isSystemCoachSlug(row.slug)) return false;
  if ((row.record_kind ?? "member") !== "member") return false;
  if (profile.role && !["coach", "admin"].includes(profile.role)) return false;
  if (row.access_tier === "do_not_contact" || row.access_tier === "early_exit") {
    return false;
  }
  return true;
}

async function main() {
  const [coaches, emails] = await Promise.all([loadCoaches(), loadEmailMap()]);

  const headers = [
    "full_name",
    "first_name",
    "last_name",
    "email",
    "business_name",
    "join_date",
    "member_since_note",
    "short_description",
    "long_description",
    "directory_listed",
    "directory_link",
    "linkedin_url",
    "photo_url",
    "location",
    "industry",
    "previous_company",
    "certification_level",
    "access_tier",
    "membership_status",
    "superpowers",
    "client_results",
    "reported_coaching_income_2024",
    "slug",
  ];

  const lines = [headers.join(",")];
  let included = 0;
  let withPhoto = 0;
  let withDirectory = 0;
  let withResults = 0;

  for (const row of coaches) {
    const profile = asProfile(row.profiles);
    if (!shouldInclude(row, profile) || !profile) continue;

    const shortDescription = resolveDirectorySummary(profile) ?? "";
    const longDescription = resolveDirectoryBio(profile) ?? "";
    const joinDate = formatJoinDate(
      resolveCoachJoinedAt(row.slug, {
        discoCommunityJoinedOn: profile.disco_community_joined_on,
        profileCreatedAt: profile.created_at,
      })
    );
    const directoryLink = row.slug
      ? `${DIRECTORY_BASE}/directory/${encodeURIComponent(row.slug)}`
      : "";
    const photoUrl = profile.avatar_url?.trim() ?? "";
    const clientResults = formatClientResults(profile.ai_context);
    const superpowers = (profile.ai_context?.superpowers ?? "").trim();

    included += 1;
    if (photoUrl) withPhoto += 1;
    if (row.directory_listed) withDirectory += 1;
    if (clientResults) withResults += 1;

    lines.push(
      [
        profile.full_name ?? "",
        profile.first_name ?? "",
        profile.last_name ?? "",
        emails.get(row.id) ?? "",
        profile.coach_business_name ?? "",
        joinDate,
        profile.member_since_note ?? "",
        shortDescription,
        longDescription,
        row.directory_listed ? "yes" : "no",
        directoryLink,
        profile.linkedin_url ?? "",
        photoUrl,
        profile.location ?? "",
        profile.industry ?? "",
        profile.previous_company ?? "",
        row.directory_level ?? "",
        row.access_tier ?? "",
        row.membership_status ?? "",
        superpowers,
        clientResults,
        profile.coaching_income_reported_2024 ?? "",
        row.slug ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const outDir = path.join(__dirname, "..", "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `coaches-marketing-export-${stamp}.csv`);
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  console.log(`Wrote ${included} coaches to ${outPath}`);
  console.log(
    `  directory_listed=${withDirectory}, with_photo=${withPhoto}, with_client_results=${withResults}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
