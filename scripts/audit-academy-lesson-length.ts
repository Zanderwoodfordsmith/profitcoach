/**
 * Report word counts for stored academy lesson content so long written
 * walkthroughs (which belong on the Guide tab) can be spotted.
 *
 * Usage:
 *   npx tsx scripts/audit-academy-lesson-length.ts            (default cutoff 300)
 *   npx tsx scripts/audit-academy-lesson-length.ts --min 250
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const minIndex = process.argv.indexOf("--min");
const minWords = minIndex === -1 ? 300 : Number(process.argv[minIndex + 1] ?? 300);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  course_id: string;
  lesson_id: string;
  title: string | null;
  body_markdown: string | null;
  guide_markdown: string | null;
};

function wordCount(text: string | null): number {
  if (!text) return 0;
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ");
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

async function main() {
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("course_id, lesson_id, title, body_markdown, guide_markdown");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const scored = rows
    .map((row) => ({
      row,
      body: wordCount(row.body_markdown),
      guide: wordCount(row.guide_markdown),
      headings: (row.body_markdown ?? "").match(/^#{1,6}\s/gm)?.length ?? 0,
      numbered: (row.body_markdown ?? "").match(/^\s*\d+[.)]\s/gm)?.length ?? 0,
    }))
    .sort((a, b) => b.body - a.body);

  const long = scored.filter((s) => s.body >= minWords);

  console.log(`rows=${rows.length} cutoff=${minWords} matching=${long.length}\n`);
  for (const s of long) {
    console.log(
      [
        String(s.body).padStart(5),
        `guide=${String(s.guide).padStart(5)}`,
        `h=${String(s.headings).padStart(2)}`,
        `n=${String(s.numbered).padStart(2)}`,
        `${s.row.course_id}/${s.row.lesson_id}`,
        s.row.title ? `— ${s.row.title}` : "",
      ].join("  ")
    );
  }

  const buckets = [100, 200, 250, 300, 400, 500, 800, 1200];
  console.log("\ndistribution of body word counts:");
  for (const b of buckets) {
    console.log(`  >= ${String(b).padStart(4)}: ${scored.filter((s) => s.body >= b).length}`);
  }
  console.log(`  total with body: ${scored.filter((s) => s.body > 0).length}`);
  console.log(`  total with guide: ${scored.filter((s) => s.guide > 0).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
