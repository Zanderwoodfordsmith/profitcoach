/**
 * Copy LinkedIn scrape locations onto coach profiles, then geocode for the map.
 *
 * Default: only fill when `profiles.location` is empty/null, and never overwrite
 * a manually pinned location (`location_geocoded_source = 'manual'`).
 *
 * Run:    npx tsx scripts/backfill-locations-from-linkedin.ts --dry-run
 * Apply:  npx tsx scripts/backfill-locations-from-linkedin.ts
 * Force:  npx tsx scripts/backfill-locations-from-linkedin.ts --force
 *         (--force replaces non-manual text locations from LinkedIn too)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (e.g. `.env.local`).
 * Geocoding uses Nominatim via `geocodeLocation` (self-throttled ~1.1s/req).
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { geocodeLocation } from "../src/lib/geocodeLocation";
import type { LinkedInProfileSnapshot } from "../src/lib/apify/linkedinProfileTypes";

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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type LinkedInRow = {
  coach_id: string;
  snapshot: LinkedInProfileSnapshot | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  location_geocoded_source: string | null;
};

function snapshotLocation(snapshot: LinkedInProfileSnapshot | null): string | null {
  const loc = snapshot?.location?.trim();
  return loc ? loc : null;
}

function isEmptyLocation(location: string | null | undefined): boolean {
  return !(location ?? "").trim();
}

async function main() {
  console.log(
    `[linkedin-locations] starting${dryRun ? " (dry-run)" : ""}${
      force ? " (force: replace non-manual locations)" : ""
    }…`
  );

  const { data: liData, error: liErr } = await supabase
    .from("coach_linkedin_profiles")
    .select("coach_id, snapshot");

  if (liErr) {
    console.error("[linkedin-locations] linkedin query failed:", liErr);
    process.exit(1);
  }

  const withLoc = ((liData ?? []) as LinkedInRow[])
    .map((row) => ({
      coach_id: row.coach_id,
      location: snapshotLocation(row.snapshot),
    }))
    .filter((row): row is { coach_id: string; location: string } =>
      Boolean(row.location)
    );

  console.log(
    `[linkedin-locations] ${withLoc.length} scrape(s) with snapshot.location`
  );

  if (withLoc.length === 0) {
    console.log("[linkedin-locations] nothing to do");
    return;
  }

  const ids = withLoc.map((r) => r.coach_id);
  const { data: profData, error: profErr } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, location, latitude, longitude, location_geocoded_source"
    )
    .in("id", ids)
    .in("role", ["coach", "admin"]);

  if (profErr) {
    console.error("[linkedin-locations] profiles query failed:", profErr);
    process.exit(1);
  }

  const profiles = new Map(
    ((profData ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  type WorkItem = {
    id: string;
    label: string;
    linkedinLocation: string;
    priorLocation: string | null;
    needsLocationWrite: boolean;
    needsGeocode: boolean;
  };

  const work: WorkItem[] = [];
  let skippedManual = 0;
  let skippedHasLocation = 0;
  let skippedNoProfile = 0;

  for (const row of withLoc) {
    const prof = profiles.get(row.coach_id);
    if (!prof) {
      skippedNoProfile += 1;
      continue;
    }

    if (prof.location_geocoded_source === "manual") {
      skippedManual += 1;
      continue;
    }

    const empty = isEmptyLocation(prof.location);
    if (!empty && !force) {
      skippedHasLocation += 1;
      continue;
    }

    const prior = (prof.location ?? "").trim() || null;
    const sameText =
      prior !== null &&
      prior.toLowerCase() === row.location.toLowerCase();
    const needsLocationWrite = empty || (force && !sameText);
    const needsGeocode =
      needsLocationWrite ||
      prof.latitude == null ||
      prof.longitude == null ||
      (force && !sameText);

    if (!needsLocationWrite && !needsGeocode) continue;

    work.push({
      id: prof.id,
      label: prof.full_name ?? prof.id,
      linkedinLocation: row.location,
      priorLocation: prior,
      needsLocationWrite,
      needsGeocode,
    });
  }

  console.log(
    `[linkedin-locations] ${work.length} to update` +
      ` (skip: has-location=${skippedHasLocation}, manual=${skippedManual}, no-profile=${skippedNoProfile})`
  );

  if (work.length === 0) return;

  let wrote = 0;
  let geocoded = 0;
  let unmatched = 0;
  let errors = 0;
  let i = 0;

  for (const item of work) {
    i += 1;
    const from =
      item.priorLocation && item.needsLocationWrite
        ? `"${item.priorLocation}" → `
        : "";
    process.stdout.write(
      `[${i}/${work.length}] ${item.label} — ${from}"${item.linkedinLocation}" … `
    );

    if (dryRun) {
      const geoNote = item.needsGeocode ? " + geocode" : "";
      console.log(`would write${geoNote}`);
      continue;
    }

    const updates: Record<string, unknown> = {};

    if (item.needsLocationWrite) {
      updates.location = item.linkedinLocation;
    }

    if (item.needsGeocode) {
      const coords = await geocodeLocation(item.linkedinLocation);
      updates.latitude = coords?.lat ?? null;
      updates.longitude = coords?.lng ?? null;
      updates.location_geocoded_at = new Date().toISOString();
      updates.location_geocoded_source = coords ? "nominatim" : null;

      if (coords) {
        geocoded += 1;
        process.stdout.write(
          `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} `
        );
      } else {
        unmatched += 1;
        process.stdout.write("geocode miss ");
      }
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", item.id);

    if (updateErr) {
      errors += 1;
      console.log(`ERROR (${updateErr.message})`);
      continue;
    }

    if (item.needsLocationWrite) wrote += 1;
    console.log("ok");
  }

  console.log(
    `[linkedin-locations] done.` +
      (dryRun
        ? ` dry-run candidates=${work.length}`
        : ` wrote=${wrote} geocoded=${geocoded} unmatched=${unmatched} errors=${errors}`)
  );
}

main().catch((err) => {
  console.error("[linkedin-locations] fatal:", err);
  process.exit(1);
});
