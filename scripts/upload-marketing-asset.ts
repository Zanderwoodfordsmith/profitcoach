/**
 * Upload a local file to the public Marketing Assets Supabase bucket.
 *
 * Run: npx tsx scripts/upload-marketing-asset.ts <local-path> [storage-filename]
 */

import { readFileSync } from "fs";
import { basename } from "path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const localPath = process.argv[2];
  if (!localPath) {
    console.error("Usage: npx tsx scripts/upload-marketing-asset.ts <local-path> [storage-filename]");
    process.exit(1);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(1);
  }

  const storagePath = process.argv[3] ?? basename(localPath);
  const buf = readFileSync(localPath);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Uploading ${storagePath} (${Math.round(buf.length / 1024 / 1024)} MB)...`);

  const { error } = await supabase.storage.from("Marketing Assets").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });

  if (error) {
    console.error("Upload failed:", error.message);
    process.exit(1);
  }

  const { data } = supabase.storage.from("Marketing Assets").getPublicUrl(storagePath);
  console.log("Uploaded:", data.publicUrl);
}

void main();
