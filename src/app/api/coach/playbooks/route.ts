import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClientPlaybookStatus = "locked" | "in_progress" | "implemented";

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name")
    .eq("coach_id", coachId)
    .eq("type", "client")
    .order("full_name");

  if (contactsError) {
    return NextResponse.json(
      { error: "Could not load clients." },
      { status: 500 }
    );
  }

  const clients = (contacts ?? []).map((c) => ({
    id: c.id as string,
    full_name: (c.full_name as string) || "Unnamed",
  }));

  const contactIds = clients.map((c) => c.id);
  if (contactIds.length === 0) {
    return NextResponse.json({
      clients,
      statusByKey: {} as Record<string, ClientPlaybookStatus>,
    });
  }

  const { data: rows, error: unlocksError } = await supabaseAdmin
    .from("client_playbook_unlocks")
    .select("contact_id, playbook_ref, status")
    .in("contact_id", contactIds);

  if (unlocksError) {
    return NextResponse.json(
      { error: "Could not load playbook status." },
      { status: 500 }
    );
  }

  const statusByKey: Record<string, ClientPlaybookStatus> = {};
  for (const row of rows ?? []) {
    const status = row.status as ClientPlaybookStatus;
    if (status && ["locked", "in_progress", "implemented"].includes(status)) {
      statusByKey[`${row.contact_id}:${row.playbook_ref}`] = status;
    } else {
      statusByKey[`${row.contact_id}:${row.playbook_ref}`] = "implemented";
    }
  }

  return NextResponse.json({ clients, statusByKey });
}
