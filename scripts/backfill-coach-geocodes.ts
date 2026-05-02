/**
 * One-off backfill: geocode every coach/admin profile that has a free-text `location`
 * but no cached `latitude`/`longitude`.
 *
 * Run:    npx tsx scripts/backfill-coach-geocodes.ts
 * Re-run: npx tsx scripts/backfill-coach-geocodes.ts --force
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the env
 * (e.g. via `.env.local`). Uses the same Nominatim helper as live updates,
 * which self-throttles to 1.1s between calls.
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { geocodeLocation } from "../src/lib/geocodeLocation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const force = process.argv.includes("--force");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  full_name: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function main() {
  console.log(
    `[backfill] starting${force ? " (force: re-geocoding all)" : ""}…`
  );

  const query = supabase
    .from("profiles")
    .select("id, full_name, location, latitude, longitude")
    .in("role", ["coach", "admin"])
    .not("location", "is", null)
    .neq("location", "");

  if (!force) {
    query.is("latitude", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[backfill] query failed:", error);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  console.log(`[backfill] ${rows.length} profile(s) to process`);

  let ok = 0;
  let miss = 0;
  let i = 0;

  for (const row of rows) {
    i += 1;
    const label = row.full_name ?? row.id;
    const loc = (row.location ?? "").trim();
    if (!loc) continue;

    process.stdout.write(`[${i}/${rows.length}] ${label} — "${loc}" … `);
    const coords = await geocodeLocation(loc);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        location_geocoded_at: new Date().toISOString(),
        location_geocoded_source: coords ? "nominatim" : null,
      })
      .eq("id", row.id);

    if (updateErr) {
      console.log(`ERROR (${updateErr.message})`);
      continue;
    }

    if (coords) {
      ok += 1;
      console.log(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      miss += 1;
      console.log("not found");
    }
  }

  console.log(
    `[backfill] done. matched=${ok} unmatched=${miss} total=${rows.length}`
  );
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
