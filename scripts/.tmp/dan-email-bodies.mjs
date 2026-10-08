import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let dsn = (env.UNIPILE_DSN || env.UNIPILE_API_URL || "").replace(/\/$/, "");
if (!/^https?:/.test(dsn)) dsn = "https://" + dsn;

const { data: msgs } = await sb.from("messaging_messages").select("id, body_text, metadata, created_at, coach_id").eq("channel", "email").order("created_at", { ascending: false }).limit(1000);
let subjOnly = 0;
const byCoach = {};
for (const m of msgs ?? []) {
  const subj = (m.metadata?.subject || "").trim();
  if (subj && (m.body_text || "").trim() === subj) { subjOnly++; byCoach[m.coach_id] = (byCoach[m.coach_id] || 0) + 1; }
}
console.log("email msgs checked:", msgs?.length, "body == subject:", subjOnly, byCoach);

const r = await fetch(`${dsn}/api/v1/emails?account_id=hnjD1J1jRgSESfJw1oTc1A&limit=2&meta_only=true`, { headers: { "X-API-KEY": env.UNIPILE_API_KEY, accept: "application/json" } });
const j = await r.json();
console.log("meta_only keys:", Object.keys(j.items?.[0] ?? {}).join(","), "has body_plain:", "body_plain" in (j.items?.[0] ?? {}));
