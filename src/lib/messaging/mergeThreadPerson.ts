import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { normalizeContactEmail } from "@/lib/contacts/identity";
import { mergeContacts } from "@/lib/contacts/mergeContacts";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { looksLikePersonName } from "@/lib/messaging/conversationDisplay";
import { bestPersonName } from "@/lib/messaging/threadIdentity";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CONVERSATION_COLUMNS =
  "id, coach_id, contact_id, prospect_name, prospect_email, prospect_phone, prospect_linkedin_url, prospect_linkedin_provider_id, prospect_avatar_url, prospect_business_name";

type ConversationIdentity = {
  id: string;
  coach_id: string;
  contact_id: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_linkedin_url: string | null;
  prospect_linkedin_provider_id: string | null;
  prospect_avatar_url: string | null;
  prospect_business_name: string | null;
};

type ContactIdentity = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_provider_id: string | null;
  photo_url: string | null;
  business_name: string | null;
};

export type MergeThreadPersonResult = {
  contactId: string;
  mergedContactId: string | null;
};

/**
 * Make two inbox threads the same person.
 * Attaches a thread that has no contact, or merges two contact records,
 * and keeps a real name ahead of Unknown or an email address.
 */
export async function mergeThreadPerson(input: {
  coachId: string;
  conversationId: string;
  contactId?: string | null;
  otherConversationId?: string | null;
}): Promise<MergeThreadPersonResult> {
  const source = await loadConversation(input.conversationId, input.coachId);
  if (!source) throw new Error("Conversation not found.");

  const other = input.otherConversationId
    ? await loadConversation(input.otherConversationId, input.coachId)
    : null;
  if (input.otherConversationId && !other) {
    throw new Error("The other conversation was not found.");
  }
  if (other && other.id === source.id) {
    throw new Error("Choose a different conversation.");
  }

  let targetContactId =
    input.contactId?.trim() || other?.contact_id || source.contact_id || null;
  if (input.contactId?.trim() || other?.contact_id) {
    const target = await loadContact(targetContactId || "", input.coachId);
    if (!target) throw new Error("That person was not found.");
  }

  if (!targetContactId) {
    targetContactId = await createContactFromThreads(input.coachId, [
      source,
      other,
    ]);
  }

  const sourceContactId = source.contact_id;
  let mergedContactId: string | null = null;
  if (sourceContactId && sourceContactId !== targetContactId) {
    await absorbConversationNames(input.coachId, targetContactId, [source, other]);
    await absorbConversationNames(input.coachId, sourceContactId, [source, other]);
    await mergeContacts({
      coachId: input.coachId,
      survivorId: targetContactId,
      mergedId: sourceContactId,
    });
    mergedContactId = sourceContactId;
  }

  await attachConversation(source, targetContactId);
  if (other) await attachConversation(other, targetContactId);
  await absorbConversationNames(input.coachId, targetContactId, [source, other]);
  await refreshConversationIdentity(input.coachId, targetContactId);

  return { contactId: targetContactId, mergedContactId };
}

async function loadConversation(
  id: string,
  coachId: string
): Promise<ConversationIdentity | null> {
  const { data } = await supabaseAdmin
    .from("messaging_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", id)
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data as ConversationIdentity | null) ?? null;
}

async function loadContact(
  id: string,
  coachId: string
): Promise<ContactIdentity | null> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, email, phone, linkedin_url, linkedin_provider_id, photo_url, business_name"
    )
    .eq("id", id)
    .eq("coach_id", coachId)
    .maybeSingle();
  return (data as ContactIdentity | null) ?? null;
}

async function createContactFromThreads(
  coachId: string,
  threads: Array<ConversationIdentity | null>
): Promise<string> {
  const rows = threads.filter((row): row is ConversationIdentity => Boolean(row));
  const name = bestPersonName(rows.map((row) => row.prospect_name));
  const email =
    rows.map((row) => normalizeContactEmail(row.prospect_email)).find(Boolean) ||
    null;
  const phone = rows.map((row) => row.prospect_phone?.trim()).find(Boolean) || null;
  const linkedin =
    rows.map((row) => row.prospect_linkedin_url?.trim()).find(Boolean) || null;
  const provider =
    rows
      .map((row) => row.prospect_linkedin_provider_id?.trim())
      .find(Boolean) || null;
  const split = name ? splitFullName(name) : { first_name: null, last_name: null };
  const created = await resolveOrCreateContact({
    coachId,
    email,
    phone,
    linkedinUrl: linkedin,
    linkedinProviderId: provider,
    fullName: name || email || "Unknown",
    firstName: split.first_name,
    lastName: split.last_name,
    type: "prospect",
    prospectSource: "inbox",
  });
  return created.contactId;
}

async function attachConversation(
  conversation: ConversationIdentity,
  contactId: string
): Promise<void> {
  if (conversation.contact_id === contactId) return;
  await supabaseAdmin
    .from("messaging_conversations")
    .update({ contact_id: contactId })
    .eq("id", conversation.id)
    .eq("coach_id", conversation.coach_id);
  conversation.contact_id = contactId;
}

async function absorbConversationNames(
  coachId: string,
  contactId: string,
  threads: Array<ConversationIdentity | null>
): Promise<void> {
  const contact = await loadContact(contactId, coachId);
  if (!contact) return;
  const rows = threads.filter((row): row is ConversationIdentity => Boolean(row));
  const name = bestPersonName([
    contact.full_name,
    ...rows.map((row) => row.prospect_name),
  ]);
  const patch: Record<string, unknown> = {};
  if (name && !looksLikePersonName(contact.full_name)) {
    const split = splitFullName(name);
    patch.full_name = name;
    if (!looksLikePersonName(contact.first_name)) {
      patch.first_name = split.first_name;
      patch.last_name = split.last_name;
    }
  }
  if (!normalizeContactEmail(contact.email)) {
    const email = rows
      .map((row) => normalizeContactEmail(row.prospect_email))
      .find(Boolean);
    if (email) patch.email = email;
  }
  if (!contact.phone?.trim()) {
    const phone = rows.map((row) => row.prospect_phone?.trim()).find(Boolean);
    if (phone) patch.phone = phone;
  }
  if (!contact.linkedin_url?.trim()) {
    const url = rows
      .map((row) => row.prospect_linkedin_url?.trim())
      .find(Boolean);
    if (url) patch.linkedin_url = url;
  }
  if (!contact.linkedin_provider_id?.trim()) {
    const provider = rows
      .map((row) => row.prospect_linkedin_provider_id?.trim())
      .find(Boolean);
    if (provider) patch.linkedin_provider_id = provider;
  }
  if (!contact.photo_url?.trim()) {
    const photo = rows
      .map((row) => row.prospect_avatar_url?.trim())
      .find(Boolean);
    if (photo) patch.photo_url = photo;
  }
  if (!contact.business_name?.trim()) {
    const business = rows
      .map((row) => row.prospect_business_name?.trim())
      .find(Boolean);
    if (business) patch.business_name = business;
  }
  if (Object.keys(patch).length) {
    await tryUpdateContactStripping(contactId, patch);
  }
}

async function refreshConversationIdentity(
  coachId: string,
  contactId: string
): Promise<void> {
  const contact = await loadContact(contactId, coachId);
  if (!contact) return;
  const patch: Record<string, unknown> = {};
  if (looksLikePersonName(contact.full_name)) {
    patch.prospect_name = contact.full_name;
  }
  const email = normalizeContactEmail(contact.email);
  if (email) patch.prospect_email = email;
  if (contact.phone?.trim()) patch.prospect_phone = contact.phone.trim();
  if (contact.linkedin_url?.trim()) {
    patch.prospect_linkedin_url = contact.linkedin_url.trim();
  }
  if (contact.linkedin_provider_id?.trim()) {
    patch.prospect_linkedin_provider_id = contact.linkedin_provider_id.trim();
  }
  if (contact.photo_url?.trim()) patch.prospect_avatar_url = contact.photo_url.trim();
  if (contact.business_name?.trim()) {
    patch.prospect_business_name = contact.business_name.trim();
  }
  if (!Object.keys(patch).length) return;
  await supabaseAdmin
    .from("messaging_conversations")
    .update(patch)
    .eq("coach_id", coachId)
    .eq("contact_id", contactId);
}
