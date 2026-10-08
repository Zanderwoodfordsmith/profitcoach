import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const { data } = await sb.from("academy_lesson_content").select("course_id, lesson_id, title, transcript_text, guide_markdown, body_markdown").in("course_id", ["get-calls","win-clients"]).limit(500);
let n=0;
for (const r of (data??[]) as any[]) {
  const t = (r.transcript_text??"");
  if (t.length < 300) continue;
  fs.writeFileSync(`${out}/${r.lesson_id}.md`, `# ${r.title ?? r.lesson_id}\n\n## Guide\n${r.guide_markdown??""}\n\n## Transcript\n${t}`);
  n++;
}
console.log(n);
