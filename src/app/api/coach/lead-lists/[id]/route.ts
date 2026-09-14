import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  duplicateCoachAudienceList,
  isLeadListUuid,
  loadOwnedLeadList,
  mapLeadListToSummary,
} from "@/lib/leadLists/audienceLists";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "duplicate") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  try {
    const leadList = await duplicateCoachAudienceList({
      coachId: auth.userId,
      listId: id,
    });
    return NextResponse.json({ leadList, list: leadList });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not duplicate list.";
    const status =
      message === "List not found."
        ? 404
        : message.includes("cannot be duplicated")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const existing = await loadOwnedLeadList(auth.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Give this list a name." }, { status: 400 });
  }
  if (existing.kind === "blacklist") {
    return NextResponse.json(
      { error: "The blacklist cannot be renamed." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("coach_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not rename list." },
      { status: 500 }
    );
  }
  return NextResponse.json({ list: data, leadList: mapLeadListToSummary(data) });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const existing = await loadOwnedLeadList(auth.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }
  if (existing.kind === "blacklist") {
    return NextResponse.json(
      { error: "The blacklist cannot be deleted." },
      { status: 400 }
    );
  }
  if (existing.kind === "pool") {
    return NextResponse.json(
      { error: "The pool cannot be deleted." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("coach_lead_lists")
    .delete()
    .eq("id", id)
    .eq("coach_id", auth.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
