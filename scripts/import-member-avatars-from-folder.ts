/**
 * One-off: upload headshots from a local folder into Supabase Storage (`avatars`)
 * and set `profiles.avatar_url`, matching files to profiles by first + last name.
 *
 * Filename conventions (basename without extension):
 *   - "Jane Doe" or "Jane_Doe" → first Jane, last Doe
 *   - "Mary Anne van Berg" → first "Mary Anne van", last "Berg" (last token = last name)
 *   - "Doe, Jane" → last Doe, first Jane
 *
 * Prerequisites:
 *   - `.env.local` with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Images: JPEG, PNG, or WebP, each ≤ 2MB (same rules as /api/coach/avatar)
 *
 * Usage:
 *   npx tsx scripts/import-member-avatars-from-folder.ts --dry-run "/path/to/Members images Headshots"
 *   npx tsx scripts/import-member-avatars-from-folder.ts "/path/to/folder"
 *   npx tsx scripts/import-member-avatars-from-folder.ts --continue-on-error --role coach "/path/to/folder"
 */

import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { splitFullName } from "../src/lib/splitFullName";

loadEnvConfig(process.cwd());

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const continueOnError = argv.includes("--continue-on-error");
const recursive = !argv.includes("--no-recursive");
const roleIdx = argv.indexOf("--role");
const roleFilter =
  roleIdx >= 0 && argv[roleIdx + 1]
    ? (argv[roleIdx + 1]!.trim().toLowerCase() as "coach" | "admin")
    : null;

const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a === "--role") {
    i += 1;
    continue;
  }
  if (!a.startsWith("--")) positional.push(a);
}

const resolvedFolder = positional[0]?.trim()
  ? path.resolve(positional[0]!.trim())
  : null;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

if (!resolvedFolder) {
  console.error(
    "Usage: npx tsx scripts/import-member-avatars-from-folder.ts [--dry-run] [--continue-on-error] [--no-recursive] [--role coach|admin] <folder-path>"
  );
  process.exit(1);
}

if (!fs.existsSync(resolvedFolder) || !fs.statSync(resolvedFolder).isDirectory()) {
  console.error(`Not a directory: ${resolvedFolder}`);
  process.exit(1);
}

/** Use this in nested functions: TS does not narrow `resolvedFolder` inside closures. */
const importAvatarsRoot: string = resolvedFolder;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function normalizePart(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function contentTypeForExt(ext: string): string | null {
  const e = ext.toLowerCase();
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return null;
}

function extForContentType(ct: string): string {
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  return "jpg";
}

/** Parse stem → { first, last } for profile matching. */
function parseNameFromStem(stem: string): { first: string; last: string } | null {
  const cleaned = stem.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (cleaned.includes(",")) {
    const [a, b] = cleaned.split(",").map((s) => s.trim());
    if (a && b) return { first: b, last: a };
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1]!;
  const first = parts.slice(0, -1).join(" ");
  return { first, last };
}

function collectImageFiles(dir: string, out: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (recursive) collectImageFiles(full, out);
      continue;
    }
    const ext = path.extname(ent.name);
    if (IMAGE_EXT.has(ext.toLowerCase())) out.push(full);
  }
}

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
};

function effectiveFirstLast(p: ProfileRow): { first: string; last: string } | null {
  const f = p.first_name?.trim();
  const l = p.last_name?.trim();
  if (f && l) return { first: f, last: l };
  const fromFull = splitFullName(p.full_name ?? "");
  const ff = fromFull.first_name?.trim();
  const ll = fromFull.last_name?.trim();
  if (ff && ll) return { first: ff, last: ll };
  return null;
}

function matchKey(first: string, last: string): string {
  return `${normalizePart(first)}|${normalizePart(last)}`;
}

async function loadProfiles(): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, role");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProfileRow[];

  const byKey = new Map<string, string[]>();
  for (const p of rows) {
    if (roleFilter && (p.role ?? "").toLowerCase() !== roleFilter) continue;
    const fl = effectiveFirstLast(p);
    if (!fl) continue;
    const k = matchKey(fl.first, fl.last);
    const list = byKey.get(k) ?? [];
    list.push(p.id);
    byKey.set(k, list);
  }
  return byKey;
}

async function main() {
  const files: string[] = [];
  collectImageFiles(importAvatarsRoot, files);
  files.sort();

  console.log(
    `[avatars] folder=${importAvatarsRoot} files=${files.length} dryRun=${dryRun} recursive=${recursive} roleFilter=${roleFilter ?? "(none)"}`
  );

  const byKey = await loadProfiles();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let ambiguous = 0;
  let noMatch = 0;

  for (const filePath of files) {
    const base = path.basename(filePath);
    const stem = path.basename(filePath, path.extname(filePath));
    const parsed = parseNameFromStem(stem);
    if (!parsed) {
      console.warn(`[avatars] skip (could not parse name): ${base}`);
      skipped += 1;
      continue;
    }

    const k = matchKey(parsed.first, parsed.last);
    const ids = byKey.get(k) ?? [];
    if (ids.length === 0) {
      console.warn(
        `[avatars] no profile for "${parsed.first} ${parsed.last}" ← ${base}`
      );
      noMatch += 1;
      continue;
    }
    if (ids.length > 1) {
      console.warn(
        `[avatars] ambiguous (${ids.length} profiles) "${parsed.first} ${parsed.last}" ← ${base}`
      );
      ambiguous += 1;
      continue;
    }

    const userId = ids[0]!;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypeForExt(ext);
    if (!contentType) {
      console.warn(`[avatars] skip (unsupported ext): ${base}`);
      skipped += 1;
      continue;
    }

    const buf = fs.readFileSync(filePath);
    if (buf.length > MAX_SIZE_BYTES) {
      console.warn(
        `[avatars] skip (>2MB): ${base} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`
      );
      skipped += 1;
      continue;
    }

    const storageExt = extForContentType(contentType);
    const objectPath = `${userId}/avatar.${storageExt}`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${objectPath}`;

    if (dryRun) {
      console.log(
        `[avatars] dry-run OK: ${base} → user ${userId.slice(0, 8)}… → ${objectPath}`
      );
      uploaded += 1;
      continue;
    }

    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(objectPath, buf, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw new Error(updateError.message);

      console.log(`[avatars] OK: ${base} → ${userId.slice(0, 8)}…`);
      uploaded += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[avatars] FAILED ${base}: ${msg}`);
      if (!continueOnError) {
        console.error(
          "[avatars] stopping (pass --continue-on-error to proceed)"
        );
        process.exit(1);
      }
    }
  }

  console.log(
    `[avatars] done uploaded=${uploaded} skipped=${skipped} noMatch=${noMatch} ambiguous=${ambiguous} failed=${failed}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
