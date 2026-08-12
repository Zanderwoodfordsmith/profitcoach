import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/messaging/conversations
 * Admin: all threads. Coach: own threads.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  let coachId: string | null = null;

  if (admin.error === null) {
    coachId = null; // admin sees all
  } else {
    const coach = await requireCoachRequest(request);
    if (coach.error || !coach.userId) {
      return NextResponse.json(
        { error: coach.error || admin.error || "Not authorized." },
        { status: 401 }
      );
    }
    coachId = coach.userId;
  }

  let q = supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, last_message_at, created_at, starred, unread_count, last_preview, last_channel"
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (coachId) q = q.eq("coach_id", coachId);

  const { data, error } = await q;
  if (error) {
    console.error("messaging conversations list:", error);
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}
