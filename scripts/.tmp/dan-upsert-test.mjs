import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DAN = "cb501f32-6c3e-41ef-b1fa-9bc44916df7c";

const { count: liMsgs } = await sb.from("messaging_messages").select("id", { count: "exact", head: true }).eq("coach_id", DAN).eq("channel", "linkedin");
const { data: lastLi } = await sb.from("messaging_messages").select("created_at, metadata").eq("coach_id", DAN).eq("channel", "linkedin").order("created_at", { ascending: false }).limit(3);
console.log("dan linkedin msgs:", liMsgs, lastLi);
const { data: lastWh } = await sb.from("messaging_messages").select("created_at, channel").eq("coach_id", DAN).contains("metadata", { webhook: true }).order("created_at", { ascending: false }).limit(3);
console.log("dan last webhook msgs:", lastWh);
const { data: lastWhAll } = await sb.from("messaging_messages").select("created_at, channel, coach_id").contains("metadata", { webhook: true }).order("created_at", { ascending: false }).limit(5);
console.log("any coach last webhook msgs:", lastWhAll);

// Dry-run the webhook upsert shape against a conversation, inside a rollback-able probe:
const { data: conv } = await sb.from("messaging_conversations").select("id").eq("coach_id", DAN).eq("prospect_name", "Dave Cawsey").limit(1).maybeSingle();
const probeId = `probe-${Date.now()}`;
const r1 = await sb.from("messaging_messages").upsert({
  conversation_id: conv.id, coach_id: DAN, channel: "linkedin", direction: "inbound", status: "delivered",
  body_text: "probe", unipile_message_id: probeId, metadata: { chat_id: "x", webhook: true, probe: true },
}, { onConflict: "unipile_message_id", ignoreDuplicates: true });
console.log("linkedin-shape upsert:", r1.error);
const r2 = await sb.from("messaging_messages").upsert({
  conversation_id: conv.id, coach_id: DAN, channel: "email", direction: "inbound", status: "delivered",
  body_text: "probe", subject: "probe", unipile_message_id: probeId + "-e", metadata: { webhook: true, probe: true },
}, { onConflict: "unipile_message_id", ignoreDuplicates: true });
console.log("email-shape upsert:", r2.error);
await sb.from("messaging_messages").delete().in("unipile_message_id", [probeId, probeId + "-e"]);
