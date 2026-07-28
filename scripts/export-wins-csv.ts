/**
 * Export all community Wins posts to CSV.
 *
 * Run: npx tsx scripts/export-wins-csv.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

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

type MediaItem = { url?: string; kind?: string };

type WinRow = {
  id: string;
  title: string;
  body: string;
  published_at: string | null;
  created_at: string;
  image_url: string | null;
  media: MediaItem[] | null;
  author: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

function csvCell(value: string): string {
  const s = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function coachName(author: WinRow["author"]): string {
  if (!author) return "";
  if (author.full_name?.trim()) return author.full_name.trim();
  const parts = [author.first_name, author.last_name].filter(Boolean);
  return parts.join(" ").trim();
}

function winDate(row: WinRow): string {
  const raw = row.published_at ?? row.created_at;
  return raw ? raw.slice(0, 10) : "";
}

function uploadUrls(row: WinRow): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };

  if (Array.isArray(row.media)) {
    for (const item of row.media) push(item?.url);
  }
  push(row.image_url);
  return urls;
}

async function main() {
  const { data: category, error: catError } = await supabase
    .from("community_categories")
    .select("id")
    .eq("slug", "wins")
    .maybeSingle();

  if (catError) {
    console.error("Failed to load wins category:", catError.message);
    process.exit(1);
  }
  if (!category?.id) {
    console.error("No community category with slug 'wins' found.");
    process.exit(1);
  }

  const pageSize = 1000;
  const rows: WinRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("community_posts")
      .select(
        `
        id,
        title,
        body,
        published_at,
        created_at,
        image_url,
        media,
        author:profiles!author_id (
          full_name,
          first_name,
          last_name
        )
      `
      )
      .eq("category_id", category.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Failed to load wins:", error.message);
      process.exit(1);
    }

    const batch = (data ?? []) as unknown as WinRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const headers = [
    "win",
    "coach",
    "date",
    "what_they_said",
    "uploaded_anything",
    "upload_urls",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    const urls = uploadUrls(row);
    lines.push(
      [
        row.title ?? "",
        coachName(row.author),
        winDate(row),
        row.body ?? "",
        urls.length > 0 ? "yes" : "no",
        urls.join(" | "),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const outDir = path.join(__dirname, "..", "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `wins-export-${stamp}.csv`);
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length} wins to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
