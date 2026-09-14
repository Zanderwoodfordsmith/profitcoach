import { shouldAutoMoveProspectToReplied } from "@/lib/prospectStatus";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Move a prospect into Replied when they send an inbound message.
 * No-ops if they are already interested, booked, follow-up, or closed.
 */
export async function markContactRepliedOnInbound(input: {
  coachId: string;
  contactId: string | null | undefined;
}): Promise<boolean> {
  const contactId = input.contactId?.trim();
  if (!contactId || !input.coachId) return false;

  try {
    const { data: contact, error } = await supabaseAdmin
      .from("contacts")
      .select("id, prospect_status, type")
      .eq("id", contactId)
      .eq("coach_id", input.coachId)
      .maybeSingle();
    if (error) {
      console.error("markContactRepliedOnInbound load:", error.message);
      return false;
    }
    if (!contact || contact.type !== "prospect") return false;
    if (
      !shouldAutoMoveProspectToReplied(
        (contact.prospect_status as string | null) ?? null
      )
    ) {
      return false;
    }

    const { error: updateError } = await supabaseAdmin
      .from("contacts")
      .update({ prospect_status: "replied" })
      .eq("id", contact.id)
      .eq("coach_id", input.coachId)
      .eq("type", "prospect");
    if (updateError) {
      console.error("markContactRepliedOnInbound update:", updateError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("markContactRepliedOnInbound:", err);
    return false;
  }
}
