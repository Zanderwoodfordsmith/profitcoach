// End-to-end test of the practice interview: a fictional demo coach answers
// the real interviewer through the dev server API, as an admin viewing Zander Demo.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById("01df174c-646c-4a29-8e76-9d0132735434");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const { data: ses } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
const headers = {
  Authorization: `Bearer ${ses.session.access_token}`,
  "Content-Type": "application/json",
  "x-impersonate-coach-id": "5cb89c87-88a9-4cfc-9f95-9591f74f8529",
};
const BASE = "http://localhost:3002";
const api = async (path, body) => {
  const res = await fetch(BASE + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
};

const PERSONA = `You are role-playing a FICTIONAL demo coach for a software test. Answer the interviewer briefly and naturally, like a real person speaking, 1 to 4 sentences, UK English, a bit of Yorkshire straight talk. Never mention this is a test.

Facts about you (use them when relevant, do not dump them all at once):
- Name: Zander Demo. Based in Leeds, UK. Mobile: 07700 900123 (a fictional number).
- 22 years in building services. Spent 11 years at Harlow & Pike Building Services (M&E and HVAC contractor, Leeds), last 5 as Operations Director.
- Grew the HVAC division from £4.2M to £11.8M revenue in 5 years by moving from one-off installs to planned maintenance contracts and pricing jobs properly.
- Cut rework on site by 38% in 18 months with a simple job-handover checklist and weekly site reviews.
- Took the business from 35 to 92 staff without the MD being in every decision: built a layer of three contracts managers.
- Since leaving, advised one client: Brennan Mechanical (family-owned M&E firm, £6M turnover), net margin from 4% to 11% in 14 months.
- People ask you about: pricing and margin on jobs, getting out of the day-to-day, building a management layer, cash flow on retentions.
- Superpower: turning a busy, owner-dependent contractor into one that runs on numbers and a weekly rhythm.
- What makes you different: you have run the operation yourself, you talk the language of sites and retentions.
- Industries: building services, HVAC, M&E, electrical contractors, facilities management. You can access them easily through old contacts and the Leeds construction network.
- Who signs off: the MD or owner.
- Will not take: start-ups, anyone who wants a quick fix without doing the work, businesses under £1M.
- Client sessions: Tuesdays and Wednesdays, 8am to 2pm. Prospect calls: Monday and Thursday afternoons.
- Time: 15 or more hours a week.
- Web address: happy with a Profit Coach page at your name for now.
- Email: set one up for you.
- LinkedIn: public, you left Harlow & Pike last year so you can say you coach.
- Minimum fee: £1,950 a month. Capacity: 8 clients. Prefer coaching with some hands-on consulting early on.`;

const ai = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
await admin.from("coach_intake_sessions").update({ status: "abandoned" }).eq("coach_id", "5cb89c87-88a9-4cfc-9f95-9591f74f8529").eq("status", "active");
const history = [];
let res = await api("/api/coach/practice/interview", { start: true });
for (let turn = 0; turn < 24; turn++) {
  const q = res.assistant_message;
  console.log(`\nQ: ${q}`);
  if (res.done) break;
  history.push({ role: "user", content: q });
  const a = await ai.messages.create({ model, max_tokens: 300, system: PERSONA, messages: history });
  const answer = a.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  history.push({ role: "assistant", content: answer });
  console.log(`A: ${answer}`);
  res = await api("/api/coach/practice/interview", { message: answer });
}
const final = await api("/api/coach/practice");
console.log("\nMISSING", final.knowledge.missing_fields, "score", final.knowledge.completeness_score);
