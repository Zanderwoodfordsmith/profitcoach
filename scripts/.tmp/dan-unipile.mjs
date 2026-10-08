import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let dsn = (env.UNIPILE_DSN || env.UNIPILE_API_URL || "").replace(/\/$/, "");
if (!/^https?:/.test(dsn)) dsn = "https://" + dsn;
const key = env.UNIPILE_API_KEY;
async function up(path) {
  const r = await fetch(dsn + path, { headers: { "X-API-KEY": key, accept: "application/json" } });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t.slice(0, 300) }; }
}
const DAN = "cb501f32-6c3e-41ef-b1fa-9bc44916df7c";

for (const id of ["32PieF_2QKeWTy6cPvOPCQ", "YDdAMKYqTsaxvtK4wMnNog", "94XseCspT-mU3I-tlDhiBQ", "1s9j86jRRf62s54DjovaKw"]) {
  const r = await up(`/api/v1/accounts/${id}`);
  console.log("ghost", id, r.status, typeof r.body === "object" ? { type: r.body.type, name: r.body.name, sources: r.body.sources, err: r.body.type === undefined ? r.body : undefined } : r.body);
}

// Email
const GMAIL = "hnjD1J1jRgSESfJw1oTc1A";
const emails = await up(`/api/v1/emails?account_id=${GMAIL}&limit=50`);
console.log("\nemails status", emails.status, "count", emails.body?.items?.length, "cursor", Boolean(emails.body?.cursor));
const { data: contacts } = await sb.from("contacts").select("id, email, type").eq("coach_id", DAN);
const known = new Set((contacts ?? []).map(c => (c.email || "").trim().toLowerCase()).filter(Boolean));
const { data: poolItems } = await sb.from("coach_lead_list_items").select("email, list_id").eq("coach_id", DAN).not("email", "is", null).limit(5000);
const poolEmails = new Set((poolItems ?? []).map(i => (i.email || "").trim().toLowerCase()));
console.log("contacts with email:", known.size, "pool emails:", poolEmails.size);
let stored = 0, missingKnown = 0, missingUnknown = 0, missingInPool = 0;
const unknownSenders = new Map();
for (const e of emails.body?.items ?? []) {
  const role = String(e.role || "").toLowerCase();
  const isSent = role === "sent" || e.is_sender;
  const addr = (isSent ? e.to_attendees?.[0]?.identifier : e.from_attendee?.identifier || "").toLowerCase();
  const { data: m } = await sb.from("messaging_messages").select("id").eq("coach_id", DAN).eq("unipile_message_id", e.id).maybeSingle();
  if (m) { stored++; continue; }
  if (known.has(addr)) { missingKnown++; console.log("  MISSING known", e.date, role, addr, (e.subject||"").slice(0,60)); }
  else { missingUnknown++; if (poolEmails.has(addr)) missingInPool++; unknownSenders.set(addr, (unknownSenders.get(addr)||0)+1); }
}
console.log({ stored, missingKnown, missingUnknown, missingInPool });
console.log("roles:", [...new Set((emails.body?.items ?? []).map(e => e.role))]);
console.log("newest email date:", emails.body?.items?.[0]?.date, "oldest in page:", emails.body?.items?.at(-1)?.date);
console.log("unknown senders sample:", [...unknownSenders.entries()].slice(0, 25));

// LinkedIn
const LI = "cc7FNNooThK4w7Rk6RtLEw";
const chats = await up(`/api/v1/chats?account_id=${LI}&limit=40`);
console.log("\nchats status", chats.status, "count", chats.body?.items?.length);
let convMissing = 0, msgStale = 0, ok = 0;
for (const c of (chats.body?.items ?? []).slice(0, 25)) {
  const { data: conv } = await sb.from("messaging_conversations").select("id, last_message_at, last_preview, prospect_name").eq("coach_id", DAN).eq("unipile_chat_id", c.id).maybeSingle();
  if (!conv) { convMissing++; console.log("  NO CONV", c.id, c.timestamp, c.name); continue; }
  const { data: lastMsg } = await sb.from("messaging_messages").select("created_at, body_text").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const remote = new Date(c.timestamp).getTime();
  const localMsg = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;
  if (remote - localMsg > 60_000) { msgStale++; console.log("  STALE", conv.prospect_name, "remote", c.timestamp, "localMsg", lastMsg?.created_at, "conv.last", conv.last_message_at); }
  else ok++;
}
console.log({ ok, msgStale, convMissing });
