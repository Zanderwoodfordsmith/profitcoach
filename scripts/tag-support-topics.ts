/**
 * Sort every support ticket with no topic yet into a plain topic (job 237).
 * New tickets are also sorted when the Support dashboard loads.
 *
 *   npx tsx scripts/tag-support-topics.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    const i = t.indexOf("=");
    if (!t || t.startsWith("#") || i < 0) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { tagUntaggedSupportTickets } = await import("../src/lib/support/ticketTopics");
  let total = 0;
  for (;;) {
    const n = await tagUntaggedSupportTickets(25);
    total += n;
    console.log(`Sorted ${n} (total ${total})`);
    if (n === 0) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
