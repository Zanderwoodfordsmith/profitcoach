import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("/Users/zander/Coding/profit-coach-app/.env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("academy_lesson_content").select("*").limit(1);
if (error) { console.error(error); process.exit(1); }
console.log(Object.keys(data![0]));
const { data: rows } = await sb.from("academy_lesson_content").select("course_id, lesson_id, title, transcript_text, is_deleted").limit(2000);
console.log((rows??[]).length);
const withT = (rows??[]).filter((r:any)=> (r.transcript_text??"").length>200);
console.log("with transcript", withT.length);
for (const r of (rows??[]) as any[]) console.log(`${(r.transcript_text??"").length}\t${r.course_id + " " + r.lesson_id}\t${r.title}`);
