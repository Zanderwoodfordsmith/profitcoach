import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: coach } = await sb.from("coaches").select("id, slug").eq("slug", "adam").maybeSingle();
console.log("coach", coach);
const coachId = coach?.id;

const all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("contacts").select("id, type, prospect_source, prospect_status, linkedin_url, email, created_at").eq("coach_id", coachId).range(from, from + 999);
  if (error) { console.log(error); break; }
  all.push(...data);
  if (data.length < 1000) break;
}
const agg = {};
for (const c of all) { const k = `${c.type}|${c.prospect_source}|${c.created_at?.slice(0, 10)}`; agg[k] = (agg[k] ?? 0) + 1; }
console.log("contacts", all.length, agg);
console.log("with li", all.filter((c) => c.linkedin_url).length);
