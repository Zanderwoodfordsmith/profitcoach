/**
 * Import coaches' LinkedIn posts and newsletter issues (read-only on LinkedIn).
 *
 *   npx tsx scripts/import-linkedin-history.ts --coach="Pam Woodford"
 *   npx tsx scripts/import-linkedin-history.ts --all            every coach with LinkedIn connected
 *   npx tsx scripts/import-linkedin-history.ts --all --full     re-walk everyone's whole history
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNIPILE_DSN, UNIPILE_API_KEY
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { supabaseAdmin } = await import("../src/lib/supabaseAdmin");
  const { coachesDueForHistoryImport, importLinkedInHistory } = await import("../src/lib/linkedinHistory/importHistory");

  const args = process.argv.slice(2);
  const coachArg = args.find((a) => a.startsWith("--coach="))?.slice("--coach=".length);
  const full = args.includes("--full");

  let ids: string[] = [];
  if (coachArg) {
    const { data } = await supabaseAdmin.from("profiles").select("id, full_name").or(`id.eq.${/^[0-9a-f-]{36}$/i.test(coachArg) ? coachArg : "00000000-0000-0000-0000-000000000000"},full_name.ilike.${coachArg}`);
    ids = (data ?? []).map((p) => p.id as string);
  } else if (args.includes("--all")) {
    ids = await coachesDueForHistoryImport(0, 1000);
  }
  if (!ids.length) {
    console.error("No coaches matched. Pass --coach=<name or id> or --all.");
    process.exit(1);
  }

  const { data: names } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
  const nameOf = new Map((names ?? []).map((n) => [n.id as string, (n.full_name as string) || n.id]));
  for (const id of ids) {
    const started = Date.now();
    const result = await importLinkedInHistory(id, { full, maxBodies: 60 });
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(`${nameOf.get(id)}: ${JSON.stringify(result)} (${secs}s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
