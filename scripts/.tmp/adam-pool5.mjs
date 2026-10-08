import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ADAM="5116ce6f-0b64-4197-986e-51058f687825";
const { data: items } = await sb.from("coach_lead_list_items").select("linkedin_url").eq("list_id","95b0a850-0c87-4cfc-9cd3-6266adb22610").not("linkedin_url","is",null);
const poolUrls = new Set(items.map(i=>i.linkedin_url));
const { data: leads } = await sb.from("linkedin_campaign_leads").select("campaign_id, linkedin_url, status").eq("coach_id",ADAM);
const by = {};
for (const l of leads) { by[l.campaign_id] ??= {total:0, fromPool:0}; by[l.campaign_id].total++; if (poolUrls.has(l.linkedin_url)) by[l.campaign_id].fromPool++; }
console.log(by);
