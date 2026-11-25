/**
 * Cut each coach's profile photo out of its background for the newsletter
 * cover templates, and save it to newsletter-images/cutouts/<id>.png.
 * Runs on this Mac (free, no paid service) with rembg through uv.
 *
 *   npx tsx scripts/newsletter-cutouts.ts --coach="Mark Cadbury"
 *   npx tsx scripts/newsletter-cutouts.ts --all          every coach with a photo and no cut-out yet
 *   npx tsx scripts/newsletter-cutouts.ts --all --redo   remake them all
 *
 * Needs uv (~/.local/bin/uvx). The first run downloads the model (~1 GB).
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import path from "path";
import { loadEnvConfig } from "@next/env";
import sharp from "sharp";

loadEnvConfig(process.cwd());

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { COVER_BUCKET, cutOutPath, ensureCoverBucket } = await import("../src/lib/newsletterCover/storage");

  const args = process.argv.slice(2);
  const coach = args.find((a) => a.startsWith("--coach="))?.slice("--coach=".length);
  const redo = args.includes("--redo");
  if (!coach && !args.includes("--all")) throw new Error('Pass --coach="Name" or --all');

  let query = supabaseAdmin.from("profiles").select("id, full_name, avatar_url").not("avatar_url", "is", null);
  if (coach) query = query.ilike("full_name", coach);
  const { data: people, error } = await query;
  if (error) throw new Error(error.message);

  await ensureCoverBucket();
  const { data: existing } = await supabaseAdmin.storage.from(COVER_BUCKET).list("cutouts", { limit: 1000 });
  const done = new Set((existing ?? []).map((f) => f.name));

  const work = mkdtempSync(path.join(tmpdir(), "cutouts-"));
  const uvx = path.join(homedir(), ".local/bin/uvx");
  let made = 0;
  for (const p of people ?? []) {
    const name = (p.full_name as string | null) ?? p.id;
    if (!redo && done.has(`${p.id}.png`)) continue;
    try {
      const res = await fetch(p.avatar_url as string);
      if (!res.ok) throw new Error(`photo ${res.status}`);
      const input = path.join(work, `${p.id}.in`);
      const output = path.join(work, `${p.id}.png`);
      writeFileSync(input, Buffer.from(await res.arrayBuffer()));
      execFileSync(uvx, ["--python", "3.11", "--from", "rembg[cpu,cli]", "rembg", "i", "-m", "birefnet-portrait", "-a", input, output], { stdio: "ignore" });

      // Trim to the person, and keep a full-length photo to head and shoulders.
      let img = await sharp(readFileSync(output)).trim({ threshold: 1 }).png().toBuffer();
      const meta = await sharp(img).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (h > w * 1.25) img = await sharp(img).extract({ left: 0, top: 0, width: w, height: Math.round(w * 1.1) }).trim({ threshold: 1 }).png().toBuffer();

      const { error: up } = await supabaseAdmin.storage.from(COVER_BUCKET).upload(cutOutPath(p.id), img, { contentType: "image/png", upsert: true });
      if (up) throw new Error(up.message);
      made += 1;
      console.log(`✓ ${name} (${w}×${h})`);
    } catch (err) {
      console.log(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Made ${made} cut-out(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
