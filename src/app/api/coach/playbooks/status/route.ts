import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    contact_id?: string;
    playbook_ref?: string;
    status?: "locked" | "in_progress" | "implemented";
  };

  const contactId = body.contact_id?.trim();
  const playbookRef = body.playbook_ref?.trim();
  const status = body.status;

  if (!contactId || !playbookRef) {
    return NextResponse.json(
      { error: "Missing contact_id or playbook_ref" },
      { status: 400 }
    );
  }

  const validStatuses = ["locked", "in_progress", "implemented"] as const;
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "status must be locked, in_progress, or implemented" },
      { status: 400 }
    );
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact || contact.coach_id !== authCheck.userId) {
    return NextResponse.json(
      { error: "Contact not found or not yours." },
      { status: 404 }
    );
  }

  const { error: upsertError } = await supabaseAdmin
    .from("client_playbook_unlocks")
    .upsert(
      {
        contact_id: contactId,
        playbook_ref: playbookRef,
        status,
        unlocked_at: new Date().toISOString(),
      },
      {
        onConflict: "contact_id,playbook_ref",
        ignoreDuplicates: false,
      }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to update status." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    contact_id: contactId,
    playbook_ref: playbookRef,
    status,
  });
}
