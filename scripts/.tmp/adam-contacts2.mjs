import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: coaches, error: ce } = await sb.from("coaches").select("*").or("slug.ilike.%adam%,slug.ilike.%westbrook%");
console.log("coaches", ce ?? coaches?.map((c) => ({ id: c.id, slug: c.slug, name: c.name ?? c.full_name, profile_id: c.profile_id ?? c.user_id })));

// contacts from sales nav, grouped by coach
const agg = {};
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("contacts").select("coach_id, prospect_source, created_at").ilike("prospect_source", "%sales%").range(from, from + 999);
  if (error) { console.log(error); break; }
  for (const c of data) { const k = `${c.coach_id}|${c.prospect_source}|${c.created_at.slice(0, 10)}`; agg[k] = (agg[k] ?? 0) + 1; }
  if (data.length < 1000) break;
}
console.log("sales nav contacts by coach|source|day", agg);

// contacts with plumb in business_name grouped by coach
const agg2 = {};
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("contacts").select("coach_id, prospect_source").ilike("business_name", "%plumb%").range(from, from + 999);
  if (error) { console.log(error); break; }
  for (const c of data) { const k = `${c.coach_id}|${c.prospect_source}`; agg2[k] = (agg2[k] ?? 0) + 1; }
  if (data.length < 1000) break;
}
console.log("plumb contacts by coach|source", agg2);

// Adam Westbrook contacts
const W = "5116ce6f-0b64-4197-986e-51058f687825";
const { count } = await sb.from("contacts").select("id", { count: "exact", head: true }).eq("coach_id", W);
console.log("westbrook contacts", count);
const { data: sn } = await sb.from("sales_nav_import_runs").select("*").order("created_at").limit(200);
console.log("sn runs", sn?.map((r) => ({ id: r.id, coach_id: r.coach_id, status: r.status, created: r.created_at, added: r.added_count, keys: undefined })));
