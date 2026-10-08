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

const { data: items } = await sb.from("coach_lead_list_items").select("id, full_name, company, job_title, linkedin_url, email, phone").eq("list_id", POOL);
const plumb = items.filter((i) => /plumb/i.test(`${i.company} ${i.job_title}`));
console.log("pool", items.length, "li", items.filter((i) => i.linkedin_url).length, "email", items.filter((i) => i.email).length, "neither", items.filter((i) => !i.linkedin_url && !i.email).length);
const { data: leads } = await sb.from("linkedin_campaign_leads").select("campaign_id, linkedin_url, company, status, metadata").eq("coach_id", ADAM);
const enrolledUrls = new Set(leads.map((l) => l.linkedin_url).filter(Boolean));
console.log("plumbers", plumb.length);
for (const p of plumb) console.log(" ", p.company, "|", p.job_title, "| li:", !!p.linkedin_url, "| email:", !!p.email, "| enrolled:", enrolledUrls.has(p.linkedin_url));
const { data: camp } = await sb.from("linkedin_campaigns").select("id, name, channel, status, outreach_account_id, stats").in("id", ["d55af58f-ca86-43ac-9ebc-1214895cf9c4", "7126d79d-7dd4-4705-a921-f68211776874", "d50585bb-cc07-4b63-8135-ac4b86c7f765", "cd284e52-17cf-4bca-ab79-efeb241794fb"]);
console.log(JSON.stringify(camp, null, 1));
