/**
 * Seed canonical CROP campaign library templates.
 *
 *   npx tsx scripts/seed-campaign-library.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { ensureCampaignLibrarySeeds } = await import(
    "../src/lib/campaignLibrary/seeds"
  );
  const results = await ensureCampaignLibrarySeeds({ replace: true });
  for (const result of results) {
    console.log(
      `${result.created ? "Created" : "Refreshed"} ${result.name} (${result.id})`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
