import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync("/Users/zander/Coding/profit-coach-app/.env.local", "utf8")
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profs, error: pe } = await sb.from("profiles").select("id, full_name").ilike("full_name", "%westbrook%");
console.log("profiles", pe ?? profs);
for (const p of profs ?? []) {
  const { data: lists } = await sb.from("coach_lead_lists").select("id, name, kind, source, item_count, created_at, updated_at").eq("coach_id", p.id);
  console.log("lists", lists);
  for (const l of lists ?? []) {
    const { count } = await sb.from("coach_lead_list_items").select("id", { count: "exact", head: true }).eq("list_id", l.id);
    console.log("  actual items", l.name, l.kind, count);
  }
  const { data: gm } = await sb.from("google_maps_import_runs").select("id, list_id, save_list_id, status, search_term, location_query, max_places, added_count, skipped_count, scraped_count, created_at, finished_at, error_message").eq("coach_id", p.id).order("created_at");
  console.log("gm runs", JSON.stringify(gm, null, 1));
  const { data: sn } = await sb.from("sales_nav_import_runs").select("*").eq("coach_id", p.id).order("created_at");
  console.log("sn runs", sn?.length, JSON.stringify(sn?.map((r) => ({ id: r.id, status: r.status, created_at: r.created_at, list_id: r.list_id, save_list_id: r.save_list_id, added: r.added_count })), null, 1));
}
