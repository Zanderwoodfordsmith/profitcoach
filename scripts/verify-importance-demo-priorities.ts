import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getPlaybookMeta } from "../src/lib/bossData";
import {
  buildProspectFocusReason,
  getRankedProspectPriorities,
} from "../src/lib/playbookSessionNotes";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, playbook_session_notes")
    .ilike("full_name", "Importance Demo")
    .maybeSingle();

  if (error || !data) {
    console.error("Importance Demo contact not found:", error?.message);
    process.exit(1);
  }

  const notes = (data.playbook_session_notes ?? {}) as Record<string, string>;
  const ranked = getRankedProspectPriorities(notes);

  console.log("Contact:", data.full_name);
  console.log("Complete:", ranked.complete.length, "| Incomplete:", ranked.incomplete.length);

  if (ranked.topPick) {
    const name = getPlaybookMeta(ranked.topPick.ref)?.name ?? ranked.topPick.ref;
    console.log("Top pick:", name, `${ranked.topPick.importance}/10`);
    console.log("Reason:", buildProspectFocusReason(ranked.topPick.scores));
  }

  console.log(
    "Top 3:",
    ranked.complete
      .slice(0, 3)
      .map((p) => `${getPlaybookMeta(p.ref)?.name ?? p.ref} (${p.importance}/10)`)
      .join(", ")
  );

  console.log(
    "Incomplete:",
    ranked.incomplete.map((p) => getPlaybookMeta(p.ref)?.name ?? p.ref).join(", ") || "(none)"
  );
}

void main();
