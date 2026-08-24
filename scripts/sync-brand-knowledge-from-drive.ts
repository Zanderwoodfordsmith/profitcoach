/**
 * Sync the Profit Coach brand knowledge ("core brain") files from the locally
 * synced Google Drive into content/ai-knowledge/.
 *
 * Source of truth: Shared drives/Business Coach Academy/_brand/
 * Re-run whenever the Drive docs change:
 *   npx tsx scripts/sync-brand-knowledge-from-drive.ts
 */
import { copyFileSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DRIVE_BRAND_DIR = join(
  homedir(),
  "Library/CloudStorage/GoogleDrive-zander@businesscoachacademy.com",
  "Shared drives/Business Coach Academy/_brand"
);

const DEST_DIR = resolve(process.cwd(), "content", "ai-knowledge");

/** [source relative to _brand, destination filename] */
const FILES: [string, string][] = [
  ["Profit Coach/methodology.md", "methodology.md"],
  ["Profit Coach/icp.md", "icp.md"],
  ["Profit Coach/business-profile.md", "business-profile.md"],
  ["Profit Coach/brand-voice.md", "brand-voice.md"],
  ["Profit Coach/offer-stack.md", "offer-stack.md"],
  ["Profit Coach/avatar-profile.md", "avatar-profile.md"],
  ["Profit Coach/copywriter-knowledge.md", "copywriter-knowledge.md"],
  ["writing-rules.md", "writing-rules.md"],
];

function main() {
  if (!existsSync(DRIVE_BRAND_DIR)) {
    throw new Error(
      `Drive folder not found (is Google Drive for desktop running?): ${DRIVE_BRAND_DIR}`
    );
  }
  for (const [src, dest] of FILES) {
    const from = join(DRIVE_BRAND_DIR, src);
    if (!existsSync(from)) {
      console.warn(`SKIP (missing in Drive): ${src}`);
      continue;
    }
    const to = join(DEST_DIR, dest);
    copyFileSync(from, to);
    const bytes = statSync(to).size;
    console.log(`OK ${dest} (${bytes.toLocaleString()} bytes)`);
  }
  console.log(
    "\nDone. Repo copies updated — DB overrides (Admin → Brand → Core brain) still win where set."
  );
}

main();
