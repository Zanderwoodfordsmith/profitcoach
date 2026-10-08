import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
let dsn = (env.UNIPILE_DSN || env.UNIPILE_API_URL || "").replace(/\/$/, "");
if (!/^https?:/.test(dsn)) dsn = "https://" + dsn;
const key = env.UNIPILE_API_KEY;
async function up(path) {
  const r = await fetch(dsn + path, {
    headers: { "X-API-KEY": key, accept: "application/json" },
  });
  const t = await r.text();
  try {
    return { status: r.status, body: JSON.parse(t) };
  } catch {
    return { status: r.status, body: t.slice(0, 300) };
  }
}

const DAN = "cb501f32-6c3e-41ef-b1fa-9bc44916df7c";

const { data: coach } = await sb
  .from("coaches")
  .select("id, slug, full_name, email")
  .eq("id", DAN)
  .maybeSingle();
console.log("COACH", coach);

const { data: accts } = await sb
  .from("linkedin_outreach_accounts")
  .select("id, provider, status, unipile_account_id, last_synced_at, display_name")
  .eq("coach_id", DAN);
for (const a of accts ?? []) {
  const remote = await up(`/api/v1/accounts/${a.unipile_account_id}`);
  const remoteOk =
    remote.status === 200 && typeof remote.body === "object"
      ? {
          type: remote.body.type,
          name: remote.body.name,
          sources: remote.body.sources,
        }
      : remote.body;
  console.log("ACCT", {
    provider: a.provider,
    status: a.status,
    last_synced_at: a.last_synced_at,
    unipile: a.unipile_account_id,
    remote_status: remote.status,
    remote: remoteOk,
  });
}

for (const ch of ["linkedin", "email", "whatsapp"]) {
  const { count } = await sb
    .from("messaging_messages")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", DAN)
    .eq("channel", ch);
  const { count: convs } = await sb
    .from("messaging_conversations")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", DAN)
    .eq("last_channel", ch);
  const { data: latest } = await sb
    .from("messaging_messages")
    .select("created_at, direction")
    .eq("coach_id", DAN)
    .eq("channel", ch)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log("CHANNEL", ch, { messages: count, conversations: convs, latest });
}

const { count: contactCount } = await sb
  .from("contacts")
  .select("id", { count: "exact", head: true })
  .eq("coach_id", DAN);
const { count: contactEmailCount } = await sb
  .from("contacts")
  .select("id", { count: "exact", head: true })
  .eq("coach_id", DAN)
  .not("email", "is", null);
const { count: prospectCount } = await sb
  .from("contacts")
  .select("id", { count: "exact", head: true })
  .eq("coach_id", DAN)
  .eq("type", "prospect");
console.log("CONTACTS", { total: contactCount, withEmail: contactEmailCount, prospects: prospectCount });

const { data: pool } = await sb
  .from("coach_lead_lists")
  .select("id")
  .eq("coach_id", DAN)
  .eq("kind", "pool")
  .maybeSingle();
let poolEmails = 0;
let poolWithContact = 0;
if (pool?.id) {
  const { count } = await sb
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", pool.id)
    .not("email", "is", null);
  const { count: withContact } = await sb
    .from("coach_lead_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", pool.id)
    .not("contact_id", "is", null);
  poolEmails = count ?? 0;
  poolWithContact = withContact ?? 0;
}
console.log("POOL", { id: pool?.id, emails: poolEmails, withContact: poolWithContact });

const gmail = (accts ?? []).find((a) =>
  String(a.provider || "").toUpperCase().includes("GOOGLE")
);
const li = (accts ?? []).find((a) =>
  String(a.provider || "").toUpperCase().includes("LINKEDIN")
);

if (gmail && gmail.status === "OK") {
  const emails = await up(
    `/api/v1/emails?account_id=${gmail.unipile_account_id}&limit=50`
  );
  const { data: contacts } = await sb
    .from("contacts")
    .select("email, type")
    .eq("coach_id", DAN);
  const known = new Map();
  for (const c of contacts ?? []) {
    const e = (c.email || "").trim().toLowerCase();
    if (e) known.set(e, c.type);
  }
  const { data: poolItems } = pool?.id
    ? await sb
        .from("coach_lead_list_items")
        .select("email")
        .eq("list_id", pool.id)
        .not("email", "is", null)
        .limit(5000)
    : { data: [] };
  const poolSet = new Set(
    (poolItems ?? []).map((i) => (i.email || "").trim().toLowerCase()).filter(Boolean)
  );
  let stored = 0,
    missingKnown = 0,
    missingPool = 0,
    missingUnknown = 0;
  const missingKnownSamples = [];
  const missingPoolSamples = [];
  for (const e of emails.body?.items ?? []) {
    const role = String(e.role || "").toLowerCase();
    const isSent = role === "sent" || e.is_sender;
    const addr = (
      isSent
        ? e.to_attendees?.[0]?.identifier
        : e.from_attendee?.identifier || ""
    ).toLowerCase();
    const { data: m } = await sb
      .from("messaging_messages")
      .select("id")
      .eq("coach_id", DAN)
      .eq("unipile_message_id", e.id)
      .maybeSingle();
    if (m) {
      stored++;
      continue;
    }
    if (known.has(addr)) {
      missingKnown++;
      if (missingKnownSamples.length < 8)
        missingKnownSamples.push({
          date: e.date,
          role,
          addr,
          type: known.get(addr),
          subject: (e.subject || "").slice(0, 50),
        });
    } else if (poolSet.has(addr)) {
      missingPool++;
      if (missingPoolSamples.length < 8)
        missingPoolSamples.push({
          date: e.date,
          role,
          addr,
          subject: (e.subject || "").slice(0, 50),
        });
    } else missingUnknown++;
  }
  console.log("EMAIL_PAGE", {
    status: emails.status,
    listed: emails.body?.items?.length,
    stored,
    missingKnown,
    missingPool,
    missingUnknown,
    newest: emails.body?.items?.[0]?.date,
    oldest: emails.body?.items?.at(-1)?.date,
    missingKnownSamples,
    missingPoolSamples,
  });
}

if (li && li.status === "OK") {
  const chats = await up(`/api/v1/chats?account_id=${li.unipile_account_id}&limit=40`);
  let convMissing = 0,
    msgStale = 0,
    ok = 0,
    empty = 0;
  const staleSamples = [];
  for (const c of chats.body?.items ?? []) {
    const { data: conv } = await sb
      .from("messaging_conversations")
      .select("id, last_message_at, prospect_name")
      .eq("coach_id", DAN)
      .eq("unipile_chat_id", c.id)
      .maybeSingle();
    if (!conv) {
      convMissing++;
      continue;
    }
    const { data: lastMsg } = await sb
      .from("messaging_messages")
      .select("created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastMsg) empty++;
    const remote = new Date(c.timestamp).getTime();
    const localMsg = lastMsg ? new Date(lastMsg.created_at).getTime() : 0;
    if (remote - localMsg > 60_000) {
      msgStale++;
      if (staleSamples.length < 8)
        staleSamples.push({
          name: conv.prospect_name,
          remote: c.timestamp,
          localMsg: lastMsg?.created_at ?? null,
          convLast: conv.last_message_at,
        });
    } else ok++;
  }
  console.log("LINKEDIN_PAGE", {
    status: chats.status,
    listed: chats.body?.items?.length,
    ok,
    msgStale,
    convMissing,
    empty,
    staleSamples,
  });
}
