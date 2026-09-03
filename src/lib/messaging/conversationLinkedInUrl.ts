import { listUnipileChatAttendees } from "@/lib/unipile/client";
import {
  counterpartFromAttendees,
  parseUnipileAttendee,
  type UnipileChatAttendee,
} from "@/lib/unipile/chatCounterpart";
import { hrefFromUnipileLinkedIn } from "@/lib/unipile/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function resolveConversationLinkedInUrl(input: {
  conversationId: string;
  contactId?: string | null;
  unipileChatId?: string | null;
  existing?: string | null;
  fetchAttendees?: boolean;
}): Promise<string | null> {
  const existing = hrefFromUnipileLinkedIn(input.existing);
  if (existing) return existing;

  if (input.contactId) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("linkedin_url")
      .eq("id", input.contactId)
      .maybeSingle();
    const fromContact = hrefFromUnipileLinkedIn(
      (contact?.linkedin_url as string | null) ?? null
    );
    if (fromContact) {
      await persist(input.conversationId, fromContact);
      return fromContact;
    }
  }

  if (input.unipileChatId) {
    const { data: lead } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("linkedin_url")
      .eq("unipile_chat_id", input.unipileChatId)
      .maybeSingle();
    const fromLead = hrefFromUnipileLinkedIn(
      (lead?.linkedin_url as string | null) ?? null
    );
    if (fromLead) {
      await persist(input.conversationId, fromLead);
      return fromLead;
    }
  }

  if (input.fetchAttendees !== false && input.unipileChatId) {
    const listed = await listUnipileChatAttendees({
      chat_id: input.unipileChatId,
    });
    if (listed.ok) {
      const attendees = (listed.data?.items ?? [])
        .map(parseUnipileAttendee)
        .filter((a): a is UnipileChatAttendee => Boolean(a));
      const url = counterpartFromAttendees(attendees).profileUrl;
      if (url) {
        await persist(input.conversationId, url);
        return url;
      }
    }
  }

  return null;
}

async function persist(conversationId: string, url: string): Promise<void> {
  await supabaseAdmin
    .from("messaging_conversations")
    .update({ prospect_linkedin_url: url })
    .eq("id", conversationId);
}
