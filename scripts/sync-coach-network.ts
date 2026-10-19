/**
 * Read coaches' LinkedIn connections into coach_network_connections for the
 * Referrals tab. Read only on LinkedIn: one list call per 1,000 connections.
 *
 *   npx tsx scripts/sync-coach-network.ts <coach-id> [<coach-id> ...]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const coachIds = process.argv.slice(2).filter((a) => /^[0-9a-f-]{36}$/i.test(a));
  if (!coachIds.length) {
    console.error("Pass one or more coach ids.");
    process.exit(1);
  }

  const { syncCoachNetwork, loadNetworkSummary } = await import("../src/lib/referrals/network");

  for (const coachId of coachIds) {
    const started = Date.now();
    const result = await syncCoachNetwork(coachId);
    if (!result.ok) {
      console.error(`${coachId}: ${result.error}`);
      continue;
    }
    const summary = await loadNetworkSummary(coachId);
    console.log(
      `${coachId}: ${result.total} connections read in ${Math.round((Date.now() - started) / 1000)}s. ` +
        `${summary.total} to rate (own campaign accepts left out).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
