import { NextResponse } from "next/server";
import {
  clientRosterToContactPatch,
  parseClientRosterPatch,
} from "@/lib/clientRoster/fields";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

function authStatus(error: string | null | undefined): number {
  if (error === "Admin must pass x-impersonate-coach-id for this resource.") {
    return 400;
  }
  if (error === "Invalid access token.") return 401;
  return 403;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: authStatus(authCheck.error) }
    );
  }

  const coachId = authCheck.userId;
  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing client id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let fields: ReturnType<typeof parseClientRosterPatch>;
  try {
    fields = parseClientRosterPatch(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: row, error: rowError } = await supabaseAdmin
    .from("contacts")
    .select("id, type, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (rowError) {
    console.error("coach/clients PATCH", rowError);
    return NextResponse.json({ error: "Unable to save client." }, { status: 500 });
  }
  if (!row || row.coach_id !== coachId || row.type !== "client") {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const saved = await tryUpdateContactStripping(
    contactId,
    clientRosterToContactPatch(fields)
  );
  if (saved.error || !saved.data?.id) {
    console.error("coach/clients PATCH", saved.error);
    return NextResponse.json({ error: "Unable to save client." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, contactId });
}
