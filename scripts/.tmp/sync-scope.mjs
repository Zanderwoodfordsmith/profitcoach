import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: accts } = await sb.from("linkedin_outreach_accounts").select("id, coach_id, provider, status, display_name, raw, last_synced_at, unipile_account_id");
const ok = accts.filter(a => a.status === "OK");
const ghosts = ok.filter(a => !a.display_name && Object.keys(a.raw || {}).length <= 1);
console.log("accounts:", accts.length, "OK:", ok.length, "coaches with OK:", new Set(ok.map(a => a.coach_id)).size);
console.log("ghost OK accounts (raw={id}):", ghosts.length, "across coaches:", new Set(ghosts.map(g => g.coach_id)).size);
const ghostIds = ghosts.map(g => g.id);
const { data: camps } = await sb.from("linkedin_campaigns").select("id, status, outreach_account_id").in("outreach_account_id", ghostIds.length ? ghostIds : ["00000000-0000-0000-0000-000000000000"]);
console.log("campaigns pointing at ghosts:", camps);
const byCoach = {};
for (const a of ok) { byCoach[a.coach_id] ??= []; byCoach[a.coach_id].push(`${a.provider}:${(a.last_synced_at||"").slice(0,16)}`); }
console.log("OK accounts by coach (provider:last_synced):");
for (const [c, list] of Object.entries(byCoach)) console.log(" ", c, list.join(" | "));

// Conversations (unipile-backed) with zero messages
let from = 0; const convs = [];
while (true) {
  const { data } = await sb.from("messaging_conversations").select("id, coach_id, last_channel").not("unipile_chat_id", "is", null).range(from, from + 999);
  convs.push(...(data ?? [])); if (!data || data.length < 1000) break; from += 1000;
}
const withMsgs = new Set();
from = 0;
while (true) {
  const { data } = await sb.from("messaging_messages").select("conversation_id").range(from, from + 999);
  for (const r of data ?? []) withMsgs.add(r.conversation_id);
  if (!data || data.length < 1000) break; from += 1000;
}
const empty = convs.filter(c => !withMsgs.has(c.id));
const byCh = {};
for (const c of empty) byCh[c.last_channel] = (byCh[c.last_channel] || 0) + 1;
console.log("unipile conversations:", convs.length, "with zero messages:", empty.length, byCh, "coaches affected:", new Set(empty.map(c => c.coach_id)).size);
