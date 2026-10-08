import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false } });
const rows = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from("academy_lesson_content")
    .select("course_id,lesson_id,title,body_markdown,guide_markdown,transcript_text")
    .range(from, from + 499);
  if (error) { console.error(error.message); process.exit(1); }
  rows.push(...data);
  if (data.length < 500) break;
}
const by = {};
fs.mkdirSync("scripts/.tmp/classroom", { recursive: true });
for (const r of rows) {
  const t = r.transcript_text ?? "", b = r.body_markdown ?? "", g = r.guide_markdown ?? "";
  const s = (by[r.course_id] ??= { n: 0, t: 0, b: 0, g: 0 });
  s.n++; s.t += t.length; s.b += b.length; s.g += g.length;
  if (!t && !b && !g) continue;
  const name = `${r.course_id}__${r.lesson_id}`.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 160);
  fs.writeFileSync(`scripts/.tmp/classroom/${name}.md`,
    `# ${r.title ?? r.lesson_id}\n\n${b ? `## Body\n${b}\n\n` : ""}${g ? `## Guide\n${g}\n\n` : ""}${t ? `## Transcript\n${t}\n` : ""}`);
}
for (const [c, s] of Object.entries(by)) console.log(`${c}: ${s.n} lessons · transcript ${Math.round(s.t/1000)}k · body ${Math.round(s.b/1000)}k · guide ${Math.round(s.g/1000)}k`);
