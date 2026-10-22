/**
 * Draft directory sectors for listed coaches from their bio and LinkedIn
 * import (Anthropic), picked from the fixed SECTORS list so the directory can
 * filter on them. Saved to profiles.directory_page.industries with
 * industries_suggested: true; the coach's page then says so until they edit.
 *
 * Never touches sectors a coach set themselves. --force redoes earlier
 * AI suggestions.
 *
 * Run:    npx tsx scripts/suggest-directory-sectors.ts --dry-run
 * Apply:  npx tsx scripts/suggest-directory-sectors.ts
 * One:    npx tsx scripts/suggest-directory-sectors.ts --slug=will
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
 */

import { loadEnvConfig } from "@next/env";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

loadEnvConfig(process.cwd());

import { summarizeLinkedInSnapshot } from "../src/lib/firstCampaign/linkedinSummary";
import type { LinkedInProfileSnapshot } from "../src/lib/apify/linkedinProfileTypes";
import { SECTORS, parseDirectoryPage } from "../src/lib/directoryPage/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim();

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY in env.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const onlySlug = process.argv.find((a) => a.startsWith("--slug="))?.slice("--slug=".length);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const Pick = z.object({
  sectors: z.array(z.enum(SECTORS)),
  why: z.string(),
});

const SYSTEM = `You tag business coaches for a public directory, so business owners can find a coach who knows their industry.

Pick at most 3 sectors from the allowed list where the coach has clear evidence: they say they work with owners in that sector, or they spent real years running or working in a business in it.

Rules:
- Use only facts in the text. Never guess from a name or a town.
- Trustee, board, volunteer and side roles do not count. Only paid work they ran or did for years, or the clients they coach.
- Coaching, consulting and "business growth" alone are not evidence for Professional services. Use it only when they worked in, or work with, firms like accountants, lawyers, recruiters or consultancies.
- Order the sectors by strength of evidence, strongest first.
- If nothing is clear, return an empty list.
- In "why", give one short line per sector naming the evidence.`;

type CoachRow = {
  id: string;
  slug: string;
  profiles: {
    full_name: string | null;
    coach_business_name: string | null;
    bio: string | null;
    directory_summary: string | null;
    directory_bio: string | null;
    directory_page: unknown;
  } | null;
};

async function main() {
  let query = supabase
    .from("coaches")
    .select("id, slug, profiles!inner ( full_name, coach_business_name, bio, directory_summary, directory_bio, directory_page )")
    .eq("directory_listed", true);
  if (onlySlug) query = query.eq("slug", onlySlug);
  const { data, error } = await query;
  if (error) throw error;
  const coaches = (data ?? []) as unknown as CoachRow[];

  const { data: linked } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, snapshot")
    .in("coach_id", coaches.map((c) => c.id));
  const snapshots = new Map(
    (linked ?? []).map((r) => [r.coach_id as string, r.snapshot as LinkedInProfileSnapshot | null]),
  );

  let saved = 0;
  for (const coach of coaches) {
    const p = Array.isArray(coach.profiles) ? coach.profiles[0] : coach.profiles;
    if (!p) continue;
    const page = parseDirectoryPage(p.directory_page);
    if (page.industries?.length && !page.industries_suggested) {
      console.log(`- ${coach.slug}: has their own sectors, skipped`);
      continue;
    }
    if (page.industries?.length && !force) {
      console.log(`- ${coach.slug}: already suggested, skipped (use --force)`);
      continue;
    }

    const user = [
      `Allowed sectors: ${SECTORS.join("; ")}`,
      "",
      `Coach: ${p.full_name ?? coach.slug}`,
      `Business: ${p.coach_business_name ?? "(none)"}`,
      `Directory headline: ${p.directory_summary?.trim() || "(none)"}`,
      `Directory bio: ${p.directory_bio?.trim() || "(none)"}`,
      `Other bio: ${p.bio?.trim() || "(none)"}`,
      "",
      "LinkedIn import:",
      summarizeLinkedInSnapshot(snapshots.get(coach.id) ?? null, { fullName: p.full_name }),
    ].join("\n");

    const response = await anthropic.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: zodOutputFormat(Pick) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.log(`! ${coach.slug}: no answer (${response.stop_reason}), skipped`);
      continue;
    }

    const sectors = [...new Set(response.parsed_output.sectors)].slice(0, 3);
    console.log(`${dryRun ? "~" : "+"} ${coach.slug}: ${sectors.join(", ") || "(none)"}\n    ${response.parsed_output.why.replace(/\n/g, "\n    ")}`);
    if (dryRun || !sectors.length) continue;

    // Merge into the stored JSON as-is, so keys this script doesn't know survive.
    const stored =
      p.directory_page && typeof p.directory_page === "object" && !Array.isArray(p.directory_page)
        ? (p.directory_page as Record<string, unknown>)
        : {};
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ directory_page: { ...stored, industries: sectors, industries_suggested: true } })
      .eq("id", coach.id);
    if (saveError) console.error(`! ${coach.slug}: ${saveError.message}`);
    else saved += 1;
  }
  console.log(`\nDone. ${dryRun ? "Dry run, nothing saved." : `${saved} saved.`}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
