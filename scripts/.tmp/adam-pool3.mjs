import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ADAM = "5116ce6f-0b64-4197-986e-51058f687825";

const { data: camps, error } = await sb.from("linkedin_campaigns").select("*").eq("coach_id", ADAM);
console.log("campaigns", error ?? camps?.map((c) => ({ id: c.id, name: c.name, status: c.status, created_at: c.created_at, updated_at: c.updated_at, audience: c.audience_list_id ?? c.list_id, keys: Object.keys(c).join(",") })));
const { data: leads } = await sb.from("linkedin_campaign_leads").select("campaign_id, status, company, created_at, metadata").eq("coach_id", ADAM);
const agg = {};
for (const l of leads ?? []) { const k = `${l.campaign_id}|${l.status}`; agg[k] = (agg[k] ?? 0) + 1; }
console.log("campaign leads", leads?.length, agg);
console.log("lead sample", leads?.slice(0, 3));

const { data: items } = await sb.from("coach_lead_list_items").select("*").eq("list_id", "95b0a850-0c87-4cfc-9cd3-6266adb22610").limit(2);
console.log("pool row shape", items);

const { data: views } = await sb.from("prospect_table_views").select("*").eq("surface", "pool");
console.log("pool views (all)", views?.filter((v) => JSON.stringify(v).includes(ADAM)));
const { data: prefs } = await sb.from("prospect_table_view_preferences").select("*").eq("surface", "pool");
console.log("pool prefs adam", prefs?.filter((v) => JSON.stringify(v).includes(ADAM)));
