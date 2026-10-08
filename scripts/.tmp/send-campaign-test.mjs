import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById("01df174c-646c-4a29-8e76-9d0132735434");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const { data: ses } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
const DEMO = "5cb89c87-88a9-4cfc-9f95-9591f74f8529";
for (const variant of ["connector", "conversation"]) {
  const res = await fetch("http://localhost:3002/api/coach/practice/send-campaign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ses.session.access_token}`, "Content-Type": "application/json", "x-impersonate-coach-id": DEMO },
    body: JSON.stringify({ variant }),
  });
  const body = await res.json();
  console.log(variant, res.status, body);
  if (body.campaign_id) {
    const { data: steps } = await admin.from("linkedin_campaign_steps").select("position,step_type,wait_hours,send_mode,body").eq("campaign_id", body.campaign_id).order("position");
    for (const s of steps) console.log(" ", s.position, s.step_type, s.wait_hours ?? "", s.send_mode, (s.body ?? "").slice(0, 90).replace(/\n/g, " "));
    const { data: c } = await admin.from("linkedin_campaigns").select("status,coach_id,name").eq("id", body.campaign_id).single();
    console.log("  campaign", c);
  }
}
