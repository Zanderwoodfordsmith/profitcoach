/**
 * Import Profit Coach blog posts from the synced Drive folder into the
 * articles table as UNPUBLISHED rows (editorial_status: review) so they can
 * be checked in Admin → Blog before anything goes live.
 *
 * Re-runnable: upserts by slug; never touches published/editorial_status on
 * rows that already exist (so review decisions stick).
 *
 * Usage: npx tsx scripts/import-blog-drafts-from-drive.ts
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BLOG_DIR = join(
  homedir(),
  "Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com",
  "Shared drives/Business Coach Academy/Profit Coach",
  "PC 1. Marketing/Content Marketer/Blog"
);

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

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

type Parsed = {
  title: string;
  date: string | null;
  theme: string | null;
  body: string;
};

function parsePost(raw: string): Parsed | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  let title = "";
  let date: string | null = null;
  let theme: string | null = null;
  let body = raw;
  if (fmMatch) {
    body = raw.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split("\n")) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).trim().toLowerCase();
      const value = line.slice(i + 1).trim();
      if (key === "title") title = value;
      if (key === "date") date = value;
      if (key === "theme") theme = value;
    }
  }
  body = body.trim();
  // Drop the duplicated H1 (title renders from the row).
  const h1 = body.match(/^#\s+.+\n+/);
  if (h1) body = body.slice(h1[0].length).trim();
  if (!title) {
    const firstH1 = raw.match(/^#\s+(.+)$/m);
    title = firstH1?.[1]?.trim() ?? "";
  }
  if (!title || !body) return null;
  return { title, date, theme, body };
}

function firstParagraph(body: string): string {
  for (const raw of body.split(/\n\s*\n/)) {
    const t = raw.trim();
    if (t && !t.startsWith("#")) return t.replace(/\s+/g, " ").slice(0, 240);
  }
  return "";
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const supabase = createClient(url, key);

  if (!existsSync(BLOG_DIR)) {
    throw new Error(`Drive blog folder not found: ${BLOG_DIR}`);
  }

  const files = readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const { data: existingRows, error: exErr } = await supabase
    .from("articles")
    .select("slug");
  if (exErr) throw new Error(exErr.message);
  const existing = new Set((existingRows ?? []).map((r) => r.slug as string));

  let inserted = 0;
  let skipped = 0;
  for (const file of files) {
    const parsed = parsePost(readFileSync(join(BLOG_DIR, file), "utf8"));
    if (!parsed) {
      console.warn(`SKIP (unparseable): ${file}`);
      continue;
    }
    const slug = slugifyTitle(parsed.title);
    if (existing.has(slug)) {
      console.log(`skip (already imported): ${slug}`);
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("articles").insert({
      slug,
      title: parsed.title,
      excerpt: firstParagraph(parsed.body),
      body: parsed.body,
      published: false,
      editorial_status: "review",
      categories: parsed.theme ? [parsed.theme] : [],
      created_at: parsed.date
        ? new Date(parsed.date).toISOString()
        : new Date().toISOString(),
    });
    if (error) {
      console.error(`FAIL ${file}: ${error.message}`);
      continue;
    }
    console.log(`imported: ${slug}  ("${parsed.title}")`);
    inserted += 1;
  }
  console.log(`\nDone: ${inserted} imported, ${skipped} already present.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
