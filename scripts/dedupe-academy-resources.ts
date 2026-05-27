/**
 * Merge duplicate academy resources in the database (same normalized URL).
 *
 * Usage:
 *   npx tsx scripts/dedupe-academy-resources.ts --dry-run
 *   npx tsx scripts/dedupe-academy-resources.ts --apply
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import type { AcademyResourceRow } from "../src/lib/academy/resources";
import {
  normalizeAcademyResourceUrl,
  pickCanonicalResourceTitle,
} from "../src/lib/academy/resourceUrl";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const apply = argv.includes("--apply");

async function main() {
  if (!dryRun && !apply) {
    console.error("Pass --dry-run or --apply");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: resources, error } = await supabase.from("academy_resources").select("*");
  if (error) throw new Error(error.message);

  const rows = (resources ?? []) as AcademyResourceRow[];
  const groups = new Map<string, AcademyResourceRow[]>();

  for (const row of rows) {
    const key = normalizeAcademyResourceUrl(row.url);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate URL groups (${rows.length} total resources)`);

  for (const [url, list] of duplicateGroups) {
    const sorted = [...list].sort(
      (a, b) => (a.source_line ?? 99999) - (b.source_line ?? 99999) || a.title.localeCompare(b.title)
    );
    const keep = sorted[0]!;
    const remove = sorted.slice(1);
    const title = pickCanonicalResourceTitle(list.map((r) => r.title));

    console.log(`\n${url.slice(0, 90)}`);
    console.log(`  keep: ${keep.id} · "${title}"`);
    for (const row of remove) {
      console.log(`  drop: ${row.id} · "${row.title}" (${row.topic ?? "no topic"})`);
    }

    if (apply) {
      for (const row of remove) {
        const { data: links } = await supabase
          .from("academy_lesson_resources")
          .select("*")
          .eq("resource_id", row.id);

        for (const link of links ?? []) {
          await supabase.from("academy_lesson_resources").upsert(
            {
              course_id: link.course_id,
              lesson_id: link.lesson_id,
              resource_id: keep.id,
              sort_order: link.sort_order,
            },
            { onConflict: "course_id,lesson_id,resource_id" }
          );
        }

        await supabase.from("academy_lesson_resources").delete().eq("resource_id", row.id);
        await supabase.from("academy_resources").delete().eq("id", row.id);
      }

      await supabase
        .from("academy_resources")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", keep.id);
    }
  }

  if (apply) {
    console.log(`\nMerged ${duplicateGroups.reduce((n, [, list]) => n + list.length - 1, 0)} duplicate rows`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
