import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ADAM = "5116ce6f-0b64-4197-986e-51058f687825";
const POOL = "95b0a850-0c87-4cfc-9cd3-6266adb22610";

const { data: items } = await sb.from("coach_lead_list_items").select("id, full_name, company, industry, source, contact_id, created_at").eq("list_id", POOL);
const byInd = {};
for (const i of items) byInd[i.industry ?? "null"] = (byInd[i.industry ?? "null"] ?? 0) + 1;
console.log("pool industries", byInd);
console.log("with contact_id", items.filter((i) => i.contact_id).length);
console.log("sample", items.slice(0, 5));

// Recent GM runs across all coaches mentioning plumb
const { data: runs } = await sb.from("google_maps_import_runs").select("id, coach_id, list_id, save_list_id, status, search_term, location_query, added_count, skipped_count, created_at, error_message").order("created_at", { ascending: false }).limit(40);
console.log("recent gm runs (all coaches)", JSON.stringify(runs, null, 1));

// Pool items with plumb in company/industry across coaches
const { data: pl } = await sb.from("coach_lead_list_items").select("coach_id, list_id, source, created_at").or("industry.ilike.%plumb%,company.ilike.%plumb%").limit(5000);
const agg = {};
for (const r of pl ?? []) { const k = `${r.coach_id}|${r.list_id}|${r.source}`; agg[k] = (agg[k] ?? 0) + 1; }
console.log("plumb rows by coach|list|source", agg);

// Campaigns for Adam
const { data: camps, error: ce } = await sb.from("campaigns").select("*").eq("coach_id", ADAM);
console.log("campaigns", ce ?? camps?.map((c) => ({ id: c.id, name: c.name, status: c.status, created_at: c.created_at })));
