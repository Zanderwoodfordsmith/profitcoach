import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const COACH = "01df174c-646c-4a29-8e76-9d0132735434";
const mode = process.argv[2];
if (mode === "create") {
  const { data, error } = await sb.from("contacts").insert([
    { coach_id: COACH, type: "prospect", full_name: "ZZ Bulk Delete Test 1" },
    { coach_id: COACH, type: "prospect", full_name: "ZZ Bulk Delete Test 2" },
  ]).select("id");
  console.log(JSON.stringify(data?.map((r) => r.id)), error?.message ?? "");
} else {
  const { data } = await sb.from("contacts").select("id, full_name").eq("coach_id", COACH).like("full_name", "ZZ Bulk Delete Test%");
  console.log("remaining:", data);
  if (mode === "cleanup" && data?.length) await sb.from("contacts").delete().in("id", data.map((r) => r.id));
}
