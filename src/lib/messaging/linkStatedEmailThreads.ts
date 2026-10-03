import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { normalizeContactEmail } from "@/lib/contacts/identity";
import { looksLikePersonName } from "@/lib/messaging/conversationDisplay";
import {
  bestPersonName,
  statedCounterpartEmail,
} from "@/lib/messaging/threadIdentity";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ThreadRow = {
  id?: string;
  coach_id?: string | null;
  contact_id?: string | null;
  prospect_name?: string | null;
  prospect_email?: string | null;
  prospect_phone?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_linkedin_provider_id?: string | null;
  last_channel?: string | null;
  last_preview?: string | null;
};

type ContactHit = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
};

/**
 * Join a LinkedIn (or other) thread to an email thread when the person
 * states an address we already have, and copy a real name onto a contact
 * that is still Unknown or an email address.
 */
export async function linkStatedEmailThreads<T extends ThreadRow>(
  rows: T[]
): Promise<T[]> {
  if (!rows.length) return rows;
  const coachId = rows.find((row) => row.coach_id)?.coach_id || null;
  if (!coachId) return rows;

  try {
    return await linkRows(rows, coachId);
  } catch (err) {
    console.error("linkStatedEmailThreads:", err);
    return rows;
  }
}

async function linkRows<T extends ThreadRow>(
  rows: T[],
  coachId: string
): Promise<T[]> {
  const next = rows.map((row) => ({ ...row }));
  const stated = await statedEmailsForUnlinked(next);
  const beyond = await statedEmailsInOtherChannels(coachId);
  for (const [conversationId, email] of beyond) {
    if (!stated.has(conversationId)) stated.set(conversationId, email);
  }
  const knownIds = new Set(next.map((row) => row.id).filter(Boolean));
  const extras = await loadConversations(
    coachId,
    [...stated.keys()].filter((id) => !knownIds.has(id))
  );
  const work = [...next, ...extras];
  const emails = [...new Set(stated.values())];
  const contactsByEmail = await contactsForEmails(coachId, emails);

  const rowByEmail = new Map<string, ThreadRow>();
  for (const row of work) {
    const email = normalizeContactEmail(row.prospect_email);
    if (email && !rowByEmail.has(email)) rowByEmail.set(email, row);
  }

  const conversationPatches: Array<Record<string, unknown> & { id: string }> =
    [];

  for (const [conversationId, email] of stated) {
    const row = work.find((item) => item.id === conversationId);
    if (!row) continue;
    const matches = contactsByEmail.get(email) ?? [];
    if (matches.length > 1) continue;
    const other = rowByEmail.get(email);
    if (other?.id === conversationId) continue;
    const contactId = matches[0]?.id || other?.contact_id || null;
    if (row.contact_id && contactId && row.contact_id !== contactId) continue;
    if (!contactId && !other) continue;

    const emailAlready = normalizeContactEmail(row.prospect_email) === email;
    const contactAlready = !contactId || row.contact_id === contactId;
    row.prospect_email = email;
    if (contactId && !row.contact_id) row.contact_id = contactId;
    if (emailAlready && contactAlready) continue;
    conversationPatches.push({
      id: conversationId,
      prospect_email: email,
      ...(contactId ? { contact_id: contactId } : {}),
    });
  }

  const contactIds = [
    ...new Set(work.map((row) => row.contact_id).filter(Boolean)),
  ] as string[];
  const contacts = await loadContacts(coachId, contactIds);
  const bestNameByContact = new Map<string, string>();
  for (const row of work) {
    if (!row.contact_id) continue;
    const best = bestPersonName([
      bestNameByContact.get(row.contact_id),
      row.prospect_name,
    ]);
    if (best) bestNameByContact.set(row.contact_id, best);
  }

  const contactPatches: Array<{ id: string; patch: Record<string, unknown> }> =
    [];
  for (const [contactId, name] of bestNameByContact) {
    const contact = contacts.get(contactId);
    if (!contact || looksLikePersonName(contact.full_name)) continue;
    const split = splitFullName(name);
    const patch: Record<string, unknown> = { full_name: name };
    if (!looksLikePersonName(contact.first_name)) {
      patch.first_name = split.first_name;
      patch.last_name = split.last_name;
    }
    const linkedIn = work.find(
      (row) => row.contact_id === contactId && row.prospect_linkedin_url
    );
    if (!contact.linkedin_url && linkedIn?.prospect_linkedin_url) {
      patch.linkedin_url = linkedIn.prospect_linkedin_url;
    }
    if (
      !contact.linkedin_provider_id &&
      linkedIn?.prospect_linkedin_provider_id
    ) {
      patch.linkedin_provider_id = linkedIn.prospect_linkedin_provider_id;
    }
    contact.full_name = name;
    contactPatches.push({ id: contactId, patch });
  }

  for (const row of work) {
    if (!row.contact_id) continue;
    const name = bestNameByContact.get(row.contact_id);
    if (!name || looksLikePersonName(row.prospect_name)) continue;
    row.prospect_name = name;
    if (!row.id) continue;
    const existing = conversationPatches.find((patch) => patch.id === row.id);
    if (existing) existing.prospect_name = name;
    else conversationPatches.push({ id: row.id, prospect_name: name });
  }

  await Promise.all([
    ...conversationPatches.map(({ id, ...patch }) =>
      supabaseAdmin
        .from("messaging_conversations")
        .update(patch)
        .eq("id", id)
        .eq("coach_id", coachId)
    ),
    ...contactPatches.map(async ({ id, patch }) => {
      await tryUpdateContactStripping(id, patch);
      if (typeof patch.full_name === "string") {
        await supabaseAdmin
          .from("messaging_conversations")
          .update({ prospect_name: patch.full_name })
          .eq("coach_id", coachId)
          .eq("contact_id", id);
      }
    }),
  ]);

  return next;
}

async function statedEmailsInOtherChannels(
  coachId: string
): Promise<Map<string, string>> {
  const stated = new Map<string, string>();
  const { data } = await supabaseAdmin
    .from("messaging_messages")
    .select("conversation_id, body_text")
    .eq("coach_id", coachId)
    .eq("direction", "inbound")
    .neq("channel", "email")
    .ilike("body_text", "%@%")
    .order("created_at", { ascending: false })
    .limit(300);
  const shortest = new Map<string, { email: string; length: number }>();
  for (const message of data ?? []) {
    const conversationId = message.conversation_id as string | null;
    const email = statedCounterpartEmail(message.body_text as string | null);
    if (!conversationId || !email) continue;
    const length = String(message.body_text || "").length;
    const prev = shortest.get(conversationId);
    if (!prev || length < prev.length) {
      shortest.set(conversationId, { email, length });
    }
  }
  for (const [conversationId, hit] of shortest) stated.set(conversationId, hit.email);
  return stated;
}

async function loadConversations(
  coachId: string,
  ids: string[]
): Promise<ThreadRow[]> {
  if (!ids.length) return [];
  const { data } = await supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, coach_id, contact_id, prospect_name, prospect_email, prospect_phone, prospect_linkedin_url, prospect_linkedin_provider_id, last_channel, last_preview"
    )
    .eq("coach_id", coachId)
    .in("id", ids.slice(0, 50));
  return (data ?? []) as ThreadRow[];
}

async function statedEmailsForUnlinked<T extends ThreadRow>(
  rows: T[]
): Promise<Map<string, string>> {
  const stated = new Map<string, string>();
  const needMessages: string[] = [];
  for (const row of rows) {
    if (!row.id) continue;
    if (normalizeContactEmail(row.prospect_email)) continue;
    if ((row.last_channel || "").toLowerCase() === "email") continue;
    const fromPreview = statedCounterpartEmail(row.last_preview);
    if (fromPreview) {
      stated.set(row.id, fromPreview);
      continue;
    }
    needMessages.push(row.id);
  }

  for (let i = 0; i < needMessages.length; i += 50) {
    const ids = needMessages.slice(i, i + 50);
    const { data } = await supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id, body_text")
      .in("conversation_id", ids)
      .eq("direction", "inbound")
      .ilike("body_text", "%@%")
      .limit(800);
    const shortest = new Map<string, { email: string; length: number }>();
    for (const message of data ?? []) {
      const conversationId = message.conversation_id as string | null;
      const email = statedCounterpartEmail(message.body_text as string | null);
      if (!conversationId || !email) continue;
      const length = String(message.body_text || "").length;
      const prev = shortest.get(conversationId);
      if (!prev || length < prev.length) {
        shortest.set(conversationId, { email, length });
      }
    }
    for (const [conversationId, hit] of shortest) {
      stated.set(conversationId, hit.email);
    }
  }

  return stated;
}

async function contactsForEmails(
  coachId: string,
  emails: string[]
): Promise<Map<string, ContactHit[]>> {
  const grouped = new Map<string, ContactHit[]>();
  if (!emails.length) return grouped;
  const filter = emails.map((email) => `email.ilike.${email}`).join(",");
  const { data } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, email, linkedin_url, linkedin_provider_id"
    )
    .eq("coach_id", coachId)
    .or(filter);
  for (const row of data ?? []) {
    const email = normalizeContactEmail(row.email as string | null);
    if (!email) continue;
    const list = grouped.get(email) ?? [];
    list.push(row as ContactHit);
    grouped.set(email, list);
  }
  return grouped;
}

async function loadContacts(
  coachId: string,
  ids: string[]
): Promise<Map<string, ContactHit>> {
  const map = new Map<string, ContactHit>();
  if (!ids.length) return map;
  const { data } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, email, linkedin_url, linkedin_provider_id"
    )
    .eq("coach_id", coachId)
    .in("id", ids);
  for (const row of data ?? []) {
    map.set(row.id as string, row as ContactHit);
  }
  return map;
}
