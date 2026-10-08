import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById("01df174c-646c-4a29-8e76-9d0132735434");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const { data: ses } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
const DEMO = "5cb89c87-88a9-4cfc-9f95-9591f74f8529";
const { data: row } = await admin.from("coach_practice_knowledge").select("built_sections").eq("coach_id", DEMO).single();
const original = row.built_sections["campaigns:messaging"];
const idx = original.blocks.findIndex((b) => b.type === "message");
const edited = original.blocks.map((b, i) => (i === idx ? { ...b, body: b.body + "\n\nEDIT TEST" } : b));
const res = await fetch("http://localhost:3002/api/coach/practice/build", {
  method: "POST",
  headers: { Authorization: `Bearer ${ses.session.access_token}`, "Content-Type": "application/json", "x-impersonate-coach-id": DEMO },
  body: JSON.stringify({ section: "campaigns:messaging", blocks: edited }),
});
const body = await res.json();
const saved = body.knowledge?.built_sections?.["campaigns:messaging"];
console.log("status", res.status, "edited_at", saved?.edited_at, "has edit", saved?.blocks[idx]?.body.endsWith("EDIT TEST"), "model kept", saved?.model === original.model);
// Restore the original section exactly.
const next = { ...row.built_sections, "campaigns:messaging": original };
await admin.from("coach_practice_knowledge").update({ built_sections: next }).eq("coach_id", DEMO);
const { data: after } = await admin.from("coach_practice_knowledge").select("built_sections").eq("coach_id", DEMO).single();
console.log("restored", !after.built_sections["campaigns:messaging"].edited_at, after.built_sections["campaigns:messaging"].blocks[idx].body.endsWith("EDIT TEST") === false);
