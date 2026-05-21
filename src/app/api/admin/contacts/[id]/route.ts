import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: "Not authorized." as const };
  }

  return { error: null };
}

type RouteContext = { params: Promise<{ id: string }> };

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
