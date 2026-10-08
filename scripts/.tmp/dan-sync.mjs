import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const id of ["cb501f32-6c3e-41ef-b1fa-9bc44916df7c", "21cfc0a6-b2a6-4b02-b788-e36c4aa85364"]) {
  const { data: c } = await sb.from("coaches").select("id, slug, linked_in_url, record_kind, access_tier, created_at").eq("id", id).maybeSingle();
  console.log("\nCOACH", c);
  const { data: accts } = await sb.from("linkedin_outreach_accounts").select("*").eq("coach_id", id);
  for (const a of accts ?? []) console.log(" ACCT", JSON.stringify(a));
  const { count: convCount } = await sb.from("messaging_conversations").select("id", { count: "exact", head: true }).eq("coach_id", id);
  console.log(" conversations:", convCount);
  for (const ch of ["email", "linkedin", "whatsapp"]) {
    const { data: latest } = await sb.from("messaging_conversations").select("last_message_at, last_channel, prospect_name, contact_id").eq("coach_id", id).eq("last_channel", ch).order("last_message_at", { ascending: false }).limit(3);
    console.log(" latest", ch, latest);
  }
  const { data: lm } = await sb.from("messaging_messages").select("created_at, channel, direction").eq("coach_id", id).order("created_at", { ascending: false }).limit(5);
  console.log(" latest msgs", lm);
  const { count: contactCount } = await sb.from("contacts").select("id", { count: "exact", head: true }).eq("coach_id", id);
  console.log(" contacts:", contactCount);
}
