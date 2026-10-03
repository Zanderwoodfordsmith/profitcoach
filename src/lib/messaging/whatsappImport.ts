import {
  phoneMatchKey,
  whatsAppThreadAllowed,
} from "@/lib/messaging/knownContacts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AllowContext = {
  poolPhones: Set<string>;
  contactTypes: Map<string, string>;
  typeByPhone: Map<string, string>;
  blockedPhones: Set<string>;
  blockedContactIds: Set<string>;
};

async function loadPoolPhoneKeys(coachId: string): Promise<Set<string> | null> {
  const phones = new Set<string>();
  const { data: pool, error: poolError } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();
  if (poolError) {
    console.error("whatsapp import pool:", poolError.message);
    return null;
  }
  const poolId = (pool?.id as string | undefined) ?? null;
  if (!poolId) return phones;

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select("phone")
      .eq("list_id", poolId)
      .not("phone", "is", null)
      .range(from, from + 999);
    if (error) {
      console.error("whatsapp import pool phones:", error.message);
      return null;
    }
    for (const row of data ?? []) {
      const key = phoneMatchKey(typeof row.phone === "string" ? row.phone : null);
      if (key) phones.add(key);
    }
    if (!data || data.length < 1000) break;
  }
  return phones;
}

async function loadTrackedContacts(
  coachId: string
): Promise<{
  contactTypes: Map<string, string>;
  typeByPhone: Map<string, string>;
} | null> {
  const contactTypes = new Map<string, string>();
  const typeByPhone = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, phone, type")
      .eq("coach_id", coachId)
      .in("type", ["prospect", "client"])
      .range(from, from + 999);
    if (error) {
      console.error("whatsapp import contacts:", error.message);
      return null;
    }
    for (const row of data ?? []) {
      const type = String(row.type || "").toLowerCase();
      if (type !== "prospect" && type !== "client") continue;
      const id = row.id as string;
      contactTypes.set(id, type);
      const phone = phoneMatchKey(
        typeof row.phone === "string" ? row.phone : null
      );
      if (phone && !typeByPhone.has(phone)) typeByPhone.set(phone, type);
    }
    if (!data || data.length < 1000) break;
  }
  return { contactTypes, typeByPhone };
}

async function loadBlocks(
  coachId: string
): Promise<{ phones: Set<string>; contactIds: Set<string> } | null> {
  const phones = new Set<string>();
  const contactIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("messaging_import_blocks")
      .select("phone_key, contact_id")
      .eq("coach_id", coachId)
      .eq("channel", "whatsapp")
      .range(from, from + 999);
    if (error) {
      console.error("whatsapp import blocks:", error.message);
      return null;
    }
    for (const row of data ?? []) {
      const phone = typeof row.phone_key === "string" ? row.phone_key : null;
      const contactId =
        typeof row.contact_id === "string" ? row.contact_id : null;
      if (phone) phones.add(phone);
      if (contactId) contactIds.add(contactId);
    }
    if (!data || data.length < 1000) break;
  }
  return { phones, contactIds };
}

async function loadAllowContext(coachId: string): Promise<AllowContext | null> {
  const [poolPhones, tracked, blocks] = await Promise.all([
    loadPoolPhoneKeys(coachId),
    loadTrackedContacts(coachId),
    loadBlocks(coachId),
  ]);
  if (!poolPhones || !tracked || !blocks) return null;
  return {
    poolPhones,
    contactTypes: tracked.contactTypes,
    typeByPhone: tracked.typeByPhone,
    blockedPhones: blocks.phones,
    blockedContactIds: blocks.contactIds,
  };
}

function conversationAllowed(
  ctx: AllowContext,
  row: { contact_id: string | null; prospect_phone: string | null }
): boolean {
  const phone = phoneMatchKey(row.prospect_phone);
  const contactId = row.contact_id;
  const blocked =
    Boolean(phone && ctx.blockedPhones.has(phone)) ||
    Boolean(contactId && ctx.blockedContactIds.has(contactId));
  const contactType =
    (contactId ? ctx.contactTypes.get(contactId) : null) ||
    (phone ? ctx.typeByPhone.get(phone) : null) ||
    null;
  return whatsAppThreadAllowed({
    blocked,
    onPool: Boolean(phone && ctx.poolPhones.has(phone)),
    contactType,
  });
}

/**
 * Remove WhatsApp threads that are not a pool number, prospect, or client.
 * Does not list or download chat history from the phone.
 */
export async function dropDisallowedWhatsAppThreads(
  coachId: string
): Promise<{ chats: number; messages: number }> {
  const ctx = await loadAllowContext(coachId);
  if (!ctx) return { chats: 0, messages: 0 };

  const dropIds: string[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, contact_id, prospect_phone")
      .eq("coach_id", coachId)
      .eq("last_channel", "whatsapp")
      .is("hidden_at", null)
      .range(from, from + 499);
    if (error) {
      console.error("whatsapp import thread scan:", error.message);
      return { chats: 0, messages: 0 };
    }
    for (const row of data ?? []) {
      if (
        conversationAllowed(ctx, {
          contact_id: (row.contact_id as string | null) ?? null,
          prospect_phone: (row.prospect_phone as string | null) ?? null,
        })
      ) {
        continue;
      }
      dropIds.push(row.id as string);
    }
    if (!data || data.length < 500) break;
  }

  if (!dropIds.length) return { chats: 0, messages: 0 };
  await removeStoredWhatsAppThreads(coachId, dropIds);
  return { chats: dropIds.length, messages: 0 };
}

async function removeStoredWhatsAppThreads(
  coachId: string,
  conversationIds: string[]
): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < conversationIds.length; i += 100) {
    const ids = conversationIds.slice(i, i + 100);
    const { error: messageError } = await supabaseAdmin
      .from("messaging_messages")
      .delete()
      .eq("coach_id", coachId)
      .in("conversation_id", ids);
    if (messageError) {
      console.error("whatsapp import message delete:", messageError.message);
    }
    const { error: scheduleError } = await supabaseAdmin
      .from("messaging_scheduled_messages")
      .update({ status: "cancelled" })
      .eq("coach_id", coachId)
      .in("conversation_id", ids)
      .eq("status", "scheduled");
    if (scheduleError) {
      console.error("whatsapp import schedule cancel:", scheduleError.message);
    }
    const { error: hideError } = await supabaseAdmin
      .from("messaging_conversations")
      .update({
        hidden_at: now,
        last_preview: null,
        unread_count: 0,
      })
      .eq("coach_id", coachId)
      .in("id", ids);
    if (hideError) {
      console.error("whatsapp import hide:", hideError.message);
    }
  }
}

async function insertBlock(input: {
  coachId: string;
  phoneKey: string | null;
  contactId: string | null;
}): Promise<void> {
  if (!input.phoneKey && !input.contactId) return;
  const { error } = await supabaseAdmin.from("messaging_import_blocks").insert({
    coach_id: input.coachId,
    channel: "whatsapp",
    phone_key: input.phoneKey,
    contact_id: input.contactId,
  });
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

/**
 * Coach chose "Don't import" for these WhatsApp chats.
 * Stored messages are removed. A later send from the app lifts the block
 * so a reply to that message can come back in.
 */
export async function blockWhatsAppConversations(input: {
  coachId: string;
  conversationIds: string[];
}): Promise<{ blocked: number }> {
  const ids = [...new Set(input.conversationIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { blocked: 0 };

  const { data, error } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, contact_id, prospect_phone, last_channel")
    .eq("coach_id", input.coachId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const whatsappIds: string[] = [];
  for (const row of data ?? []) {
    if ((row.last_channel as string | null)?.toLowerCase() !== "whatsapp") {
      continue;
    }
    whatsappIds.push(row.id as string);
    const phoneKey = phoneMatchKey(row.prospect_phone as string | null);
    const contactId = (row.contact_id as string | null) ?? null;
    let blockPhone = phoneKey;
    if (!blockPhone && contactId) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("phone")
        .eq("id", contactId)
        .eq("coach_id", input.coachId)
        .maybeSingle();
      blockPhone = phoneMatchKey((contact?.phone as string | null) ?? null);
    }
    await insertBlock({
      coachId: input.coachId,
      phoneKey: blockPhone,
      contactId,
    });
  }

  if (whatsappIds.length) {
    await removeStoredWhatsAppThreads(input.coachId, whatsappIds);
  }
  return { blocked: whatsappIds.length };
}

/**
 * An outbound WhatsApp send means this thread is now one we started.
 * Lift "Don't import" so their reply can land, and show the thread again.
 */
export async function liftWhatsAppImportBlock(input: {
  coachId: string;
  contactId?: string | null;
  phone?: string | null;
}): Promise<void> {
  const phoneKey = phoneMatchKey(input.phone);
  const contactId = input.contactId?.trim() || null;
  if (!phoneKey && !contactId) return;

  if (phoneKey) {
    const { error } = await supabaseAdmin
      .from("messaging_import_blocks")
      .delete()
      .eq("coach_id", input.coachId)
      .eq("channel", "whatsapp")
      .eq("phone_key", phoneKey);
    if (error) console.error("whatsapp import lift phone:", error.message);
  }
  if (contactId) {
    const { error } = await supabaseAdmin
      .from("messaging_import_blocks")
      .delete()
      .eq("coach_id", input.coachId)
      .eq("channel", "whatsapp")
      .eq("contact_id", contactId);
    if (error) console.error("whatsapp import lift contact:", error.message);

    await supabaseAdmin
      .from("messaging_conversations")
      .update({ hidden_at: null })
      .eq("coach_id", input.coachId)
      .eq("contact_id", contactId)
      .eq("last_channel", "whatsapp")
      .not("hidden_at", "is", null);
  }
}
