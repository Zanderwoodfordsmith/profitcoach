/**
 * Draft short `community_bio` copy from LinkedIn snapshots (Anthropic).
 *
 * Only fills empty `community_bio`. Skips coaches who already have a solid
 * prose `bio` fallback (Amber-style). Rewrites LinkedIn-headline-style `bio`
 * into a proper community blurb by writing `community_bio` (takes precedence).
 *
 * Run:    npx tsx scripts/backfill-community-bios-from-linkedin.ts --dry-run
 * Apply:  npx tsx scripts/backfill-community-bios-from-linkedin.ts
 * Limit:  npx tsx scripts/backfill-community-bios-from-linkedin.ts --limit=5
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
 */

import { loadEnvConfig } from "@next/env";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { resolveAnthropicModel } from "../src/lib/anthropicModel";
import { summarizeLinkedInSnapshot } from "../src/lib/firstCampaign/linkedinSummary";
import type { LinkedInProfileSnapshot } from "../src/lib/apify/linkedinProfileTypes";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in env.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg
  ? Math.max(1, Number.parseInt(limitArg.slice("--limit=".length), 10) || 0)
  : 0;

const BATCH_SIZE = 8;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

type LinkedInRow = {
  coach_id: string;
  snapshot: LinkedInProfileSnapshot | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  coach_business_name: string | null;
  community_bio: string | null;
  bio: string | null;
  role: string;
};

/** Amber-style prose already usable as community fallback — leave alone. */
function hasGoodProseBio(bio: string | null | undefined): boolean {
  const t = (bio ?? "").trim();
  if (t.length < 70) return false;
  if (t.includes("|")) return false;
  if (!/[.!?…]/.test(t)) return false;
  // Headline dumps are often Title Case job strings without "I"/"help"/"coach"
  const lower = t.toLowerCase();
  const coachingVoice =
    /\b(i |i'm |im |help|helps|coach|coaching|work with|working with)\b/.test(
      lower
    );
  return coachingVoice;
}

function hasLinkedInMaterial(snapshot: LinkedInProfileSnapshot | null): boolean {
  if (!snapshot) return false;
  return Boolean(
    snapshot.headline?.trim() ||
      snapshot.about?.trim() ||
      (snapshot.experiences?.length ?? 0) > 0
  );
}

const SYSTEM = `You write short community bios for coaches in a private coaching community.

Style (match this closely):
- First person ("I…") preferred when natural
- 1–2 sentences only
- Role + who they help + outcome
- Warm, plain, commercially clear — no corporate fluff, no hashtags, no emoji
- No LinkedIn jargon dumps, no pipe-separated job titles, no "open to work"
- Do not invent credentials, companies, or niches that aren't in the source
- Aim for ~120–220 characters (hard max 240)

Example tone: "I'm a business psychologist and coach who helps business owners step out of survival mode and into confident leadership."

Return ONLY a JSON array of objects: [{"id":"...","bio":"..."}] with one entry per coach, same order as input. No markdown fences.`;

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function parseBiosJson(
  raw: string
): Array<{ id: string; bio: string }> | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const id = String((item as { id?: unknown }).id ?? "").trim();
        const bio = String((item as { bio?: unknown }).bio ?? "").trim();
        if (!id || !bio) return null;
        return { id, bio: bio.slice(0, 280) };
      })
      .filter((x): x is { id: string; bio: string } => Boolean(x));
  } catch {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return parseBiosJson(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generateBatch(
  items: Array<{
    id: string;
    fullName: string;
    businessName: string | null;
    snapshot: LinkedInProfileSnapshot;
  }>
): Promise<Map<string, string>> {
  const blocks = items.map((item, i) => {
    const summary = summarizeLinkedInSnapshot(item.snapshot, {
      fullName: item.fullName,
      businessName: item.businessName,
    });
    return `### Coach ${i + 1}\nid: ${item.id}\n${summary}`;
  });

  const user = `Write a community bio for each coach below.\n\n${blocks.join("\n\n")}`;

  const response = await anthropic.messages.create({
    model: resolveAnthropicModel(),
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const raw = textFromMessage(response);
  const parsed = parseBiosJson(raw);
  const out = new Map<string, string>();
  if (!parsed) {
    console.warn("[community-bios] failed to parse batch JSON:", raw.slice(0, 400));
    return out;
  }
  for (const row of parsed) {
    out.set(row.id, row.bio);
  }
  // Fallback: model sometimes mangles UUIDs — map by batch order when counts match.
  if (out.size < items.length && parsed.length === items.length) {
    for (let i = 0; i < items.length; i += 1) {
      if (!out.has(items[i].id) && parsed[i]?.bio) {
        out.set(items[i].id, parsed[i].bio);
      }
    }
  }
  return out;
}

async function main() {
  console.log(
    `[community-bios] starting${dryRun ? " (dry-run)" : ""}${
      force ? " (force empty community_bio even if prose bio exists)" : ""
    }${limit ? ` limit=${limit}` : ""}…`
  );

  const { data: liData, error: liErr } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, snapshot");

  if (liErr) {
    console.error("[community-bios] linkedin query failed:", liErr);
    process.exit(1);
  }

  const liRows = (liData ?? []) as LinkedInRow[];
  const withMaterial = liRows.filter((r) => hasLinkedInMaterial(r.snapshot));
  console.log(
    `[community-bios] ${withMaterial.length} scrape(s) with LinkedIn copy`
  );

  const ids = withMaterial.map((r) => r.coach_id);
  const { data: profData, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, coach_business_name, community_bio, bio, role")
    .in("id", ids)
    .in("role", ["coach", "admin"]);

  if (profErr) {
    console.error("[community-bios] profiles query failed:", profErr);
    process.exit(1);
  }

  const profiles = new Map(
    ((profData ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );
  const snapById = new Map(
    withMaterial.map((r) => [r.coach_id, r.snapshot as LinkedInProfileSnapshot])
  );

  type WorkItem = {
    id: string;
    fullName: string;
    businessName: string | null;
    snapshot: LinkedInProfileSnapshot;
    reason: string;
  };

  const work: WorkItem[] = [];
  let skippedHasCommunity = 0;
  let skippedGoodBio = 0;
  let skippedNoProfile = 0;

  for (const row of withMaterial) {
    const prof = profiles.get(row.coach_id);
    if (!prof) {
      skippedNoProfile += 1;
      continue;
    }
    if ((prof.community_bio ?? "").trim()) {
      skippedHasCommunity += 1;
      continue;
    }
    if (!force && hasGoodProseBio(prof.bio)) {
      skippedGoodBio += 1;
      continue;
    }

    const reason = !(prof.bio ?? "").trim()
      ? "empty"
      : "headline-style-bio";

    work.push({
      id: prof.id,
      fullName: prof.full_name ?? prof.id,
      businessName: prof.coach_business_name,
      snapshot: snapById.get(prof.id)!,
      reason,
    });
  }

  const selected = limit ? work.slice(0, limit) : work;
  console.log(
    `[community-bios] ${selected.length} to draft` +
      ` (eligible=${work.length}; skip: has-community_bio=${skippedHasCommunity}, good-prose-bio=${skippedGoodBio}, no-profile=${skippedNoProfile})`
  );

  if (selected.length === 0) return;

  let wrote = 0;
  let failed = 0;

  for (let i = 0; i < selected.length; i += BATCH_SIZE) {
    const batch = selected.slice(i, i + BATCH_SIZE);
    process.stdout.write(
      `[batch ${Math.floor(i / BATCH_SIZE) + 1}] generating ${batch.length}… `
    );

    let bios: Map<string, string>;
    try {
      bios = await generateBatch(batch);
    } catch (err) {
      console.log("ERROR", err instanceof Error ? err.message : err);
      failed += batch.length;
      continue;
    }
    console.log(`got ${bios.size}`);

    for (const item of batch) {
      const bio = bios.get(item.id);
      if (!bio) {
        failed += 1;
        console.log(`  ✗ ${item.fullName} — no model bio`);
        continue;
      }

      console.log(
        `  ${dryRun ? "would write" : "write"} [${item.reason}] ${item.fullName}: ${bio}`
      );

      if (dryRun) {
        wrote += 1;
        continue;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ community_bio: bio })
        .eq("id", item.id);

      if (updateErr) {
        failed += 1;
        console.log(`    ERROR ${updateErr.message}`);
        continue;
      }
      wrote += 1;
    }
  }

  console.log(
    `[community-bios] done. ${dryRun ? "drafted" : "wrote"}=${wrote} failed=${failed}`
  );
}

main().catch((err) => {
  console.error("[community-bios] fatal:", err);
  process.exit(1);
});
