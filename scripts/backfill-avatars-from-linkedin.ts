/**
 * For coaches with a LinkedIn snapshot photo and no community avatar,
 * download the photo into `avatars` storage and set `profiles.avatar_url`.
 * Never overwrites an existing avatar.
 *
 * Dry-run:  npx tsx scripts/backfill-avatars-from-linkedin.ts --dry-run
 * Run:      npx tsx scripts/backfill-avatars-from-linkedin.ts
 */

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

const dryRun = process.argv.includes("--dry-run");

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Snapshot = {
  photoUrl?: string | null;
  fullName?: string | null;
};

function contentTypeFromResponse(
  contentTypeHeader: string | null,
  url: string
): string | null {
  const raw = (contentTypeHeader ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED_TYPES.has(raw)) return raw;
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes("profile-displayphoto")
  ) {
    return "image/jpeg";
  }
  return null;
}

async function main() {
  console.log(`[linkedin-avatars] starting${dryRun ? " (dry-run)" : ""}…`);

  const { data: liRows, error: liError } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, snapshot");

  if (liError) {
    console.error("[linkedin-avatars] query failed:", liError);
    process.exit(1);
  }

  const coachIds = (liRows ?? []).map((r) => r.coach_id as string);
  if (coachIds.length === 0) {
    console.log("[linkedin-avatars] no LinkedIn snapshots.");
    return;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", coachIds);

  if (profilesError) {
    console.error("[linkedin-avatars] profiles query failed:", profilesError);
    process.exit(1);
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        full_name: (p.full_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null)?.trim() || null,
      },
    ])
  );

  const photoByCoach = new Map<string, string>();
  for (const row of liRows ?? []) {
    const snap = row.snapshot as Snapshot | null;
    const photo = snap?.photoUrl?.trim();
    if (photo) photoByCoach.set(row.coach_id as string, photo);
  }

  let applied = 0;
  let skippedHasAvatar = 0;
  let skippedNoPhoto = 0;
  let failed = 0;
  const candidates: Array<{
    id: string;
    name: string;
    photoUrl: string;
  }> = [];

  for (const id of coachIds) {
    const profile = profileById.get(id);
    const name = profile?.full_name ?? id;
    const photoUrl = photoByCoach.get(id);
    if (!photoUrl) {
      skippedNoPhoto += 1;
      continue;
    }
    if (profile?.avatar_url) {
      skippedHasAvatar += 1;
      continue;
    }
    candidates.push({ id, name, photoUrl });
  }

  console.log(
    `[linkedin-avatars] candidates=${candidates.length} skipped_has_avatar=${skippedHasAvatar} skipped_no_photo=${skippedNoPhoto}`
  );

  for (let i = 0; i < candidates.length; i += 1) {
    const row = candidates[i]!;
    process.stdout.write(
      `[${i + 1}/${candidates.length}] ${row.name} … `
    );

    if (dryRun) {
      applied += 1;
      console.log("would apply");
      continue;
    }

    try {
      const response = await fetch(row.photoUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ProfitCoachAvatarImport/1.0)",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        redirect: "follow",
      });
      if (!response.ok) {
        failed += 1;
        console.log(`FAIL (HTTP ${response.status})`);
        continue;
      }

      const contentType = contentTypeFromResponse(
        response.headers.get("content-type"),
        row.photoUrl
      );
      if (!contentType) {
        failed += 1;
        console.log("FAIL (unsupported type)");
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_SIZE_BYTES) {
        failed += 1;
        console.log(
          `FAIL (size ${buffer.byteLength})`
        );
        continue;
      }

      const ext = EXT_BY_TYPE[contentType] ?? "jpg";
      const objectPath = `${row.id}/avatar.${ext}`;
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${objectPath}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(objectPath, buffer, { contentType, upsert: true });
      if (uploadError) {
        failed += 1;
        console.log(`FAIL (upload: ${uploadError.message})`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", row.id);
      if (updateError) {
        failed += 1;
        console.log(`FAIL (profile: ${updateError.message})`);
        continue;
      }

      applied += 1;
      console.log("ok");
    } catch (err) {
      failed += 1;
      console.log(
        `FAIL (${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  console.log(
    `[linkedin-avatars] done. applied=${applied} failed=${failed} skipped_has_avatar=${skippedHasAvatar} skipped_no_photo=${skippedNoPhoto}`
  );
}

main().catch((err) => {
  console.error("[linkedin-avatars] fatal:", err);
  process.exit(1);
});
