import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id");
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export type ClientPlaybookStatus = "locked" | "in_progress" | "implemented";

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
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
