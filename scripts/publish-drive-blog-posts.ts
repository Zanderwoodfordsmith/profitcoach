/**
 * Publish the five reviewed Drive blog posts: sets blog category, cleans
 * excerpts of markdown markers, and flips them live.
 *
 * Usage: npx tsx scripts/publish-drive-blog-posts.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const TO_PUBLISH: { slug: string; category: string }[] = [
  {
    slug: "the-5-numbers-every-business-owner-should-look-at-every-monday-morning",
    category: "Profit & Cash Flow",
  },
  {
    slug: "the-5-questions-every-team-meeting-should-answer-or-you-shouldnt-be-having-it",
    category: "Ops, Systems & Team",
  },
  {
    slug: "3-mistakes-almost-every-owner-makes-with-their-quarterly-plan",
    category: "Strategy & Planning",
  },
  {
    slug: "7-places-money-is-quietly-leaking-out-of-your-business",
    category: "Profit & Cash Flow",
  },
  {
    slug: "the-4-hires-almost-every-growing-business-owner-gets-wrong",
    category: "Ops, Systems & Team",
  },
];

function cleanExcerpt(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

async function main() {
  loadEnvLocal();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const { slug, category } of TO_PUBLISH) {
    const { data: row, error: readErr } = await supabase
      .from("articles")
      .select("excerpt")
      .eq("slug", slug)
      .maybeSingle();
    if (readErr || !row) {
      console.error(`MISSING: ${slug}`);
      continue;
    }
    const { error } = await supabase
      .from("articles")
      .update({
        categories: [category],
        excerpt: cleanExcerpt(row.excerpt as string),
        editorial_status: "live",
        published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    console.log(error ? `FAIL ${slug}: ${error.message}` : `LIVE: ${slug}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
