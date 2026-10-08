import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const demo = await sb.from("profiles").select("id, full_name, role, coach_business_name").or("full_name.ilike.%demo%,full_name.ilike.%woodford%,full_name.ilike.%zander%"); console.log(demo.data, demo.error?.message);
const ids = (demo.data??[]).map((r:any)=>r.id);
const camps = await sb.from("linkedin_campaigns").select("id, coach_id, name, status, channel, outreach_account_id").in("coach_id", ids); console.log(camps.data);
const lists = await sb.from("coach_lead_lists").select("id, coach_id, name, kind, item_count, source").in("coach_id", ids); console.log(lists.data);
const { data: tbls } = await sb.from("linkedin_campaigns").select("outreach_account_id").not("outreach_account_id","is",null).limit(1); console.log(tbls);
