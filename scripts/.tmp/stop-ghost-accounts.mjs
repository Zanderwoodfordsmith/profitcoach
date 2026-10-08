import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let dsn = (env.UNIPILE_DSN || env.UNIPILE_API_URL || "").replace(/\/$/, "");
if (!/^https?:/.test(dsn)) dsn = "https://" + dsn;

const { data: accts } = await sb.from("linkedin_outreach_accounts").select("id, coach_id, provider, status, unipile_account_id").eq("status", "OK");
for (const a of accts) {
  const r = await fetch(`${dsn}/api/v1/accounts/${encodeURIComponent(a.unipile_account_id)}`, { headers: { "X-API-KEY": env.UNIPILE_API_KEY, accept: "application/json" } });
  if (r.status !== 404) continue;
  const body = await r.json().catch(() => ({}));
  if (body.type !== "errors/resource_not_found") continue;
  const { error } = await sb.from("linkedin_outreach_accounts").update({ status: "STOPPED" }).eq("id", a.id);
  console.log("STOPPED", a.coach_id, a.provider, a.unipile_account_id, error?.message ?? "ok");
}
