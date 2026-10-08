import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false } });
const PAM = "485e5b67-9cef-44ce-94f1-f5b2d560869a";
const out = {};
for (const t of ["coach_linkedin_profiles", "coach_icps", "coach_avatars", "coach_campaign_setup", "coach_campaign_messages", "linkedin_campaigns"]) {
  const col = t === "linkedin_campaigns" ? "coach_id" : "coach_id";
  const r = await sb.from(t).select("*").eq(col, PAM).limit(20);
  out[t] = r.error ? `ERR ${r.error.message}` : r.data;
  console.log(t, r.error ? r.error.message : `${r.data.length} rows`);
}
const steps = await sb.from("linkedin_campaign_steps").select("*").in("campaign_id", (Array.isArray(out.linkedin_campaigns) ? out.linkedin_campaigns : []).map((c) => c.id)).limit(60);
out.linkedin_campaign_steps = steps.error ? steps.error.message : steps.data;
console.log("steps", steps.error?.message ?? steps.data.length);
fs.writeFileSync("scripts/.tmp/pam.json", JSON.stringify(out, null, 2));
