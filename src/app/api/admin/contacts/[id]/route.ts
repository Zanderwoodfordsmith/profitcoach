import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  updateProspectFields,
  type ProspectFieldPatch,
} from "@/lib/prospects/updateProspectFields";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  let body: ProspectFieldPatch;
  try {
    body = (await request.json()) as ProspectFieldPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data: contact, error: fetchError } = await supabaseAdmin
    .from("contacts")
    .select("coach_id, type")
    .eq("id", contactId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Unable to load prospect." }, { status: 500 });
  }
  if (!contact?.coach_id || contact.type !== "prospect") {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  try {
    const updated = await updateProspectFields(
      contactId,
      contact.coach_id as string,
      body
    );
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update prospect.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const { data: contact, error: fetchError } = await supabaseAdmin
    .from("contacts")
    .select("id, type")
    .eq("id", contactId)
    .maybeSingle();

  if (fetchError) {
    console.error("admin/contacts/[id] DELETE fetch:", fetchError);
    return NextResponse.json(
      { error: "Unable to delete prospect." },
      { status: 500 }
    );
  }

  if (!contact) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  if (contact.type !== "prospect") {
    return NextResponse.json(
      { error: "Only prospects can be deleted here." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (deleteError) {
    console.error("admin/contacts/[id] DELETE:", deleteError);
    return NextResponse.json(
      { error: "Unable to delete prospect." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
