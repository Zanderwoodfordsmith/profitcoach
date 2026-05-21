import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { data: group, error: groupError } = await supabaseAdmin
      .from("coach_groups")
      .select("id, name, description, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (groupError) {
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }
    if (!group) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("coach_group_members")
      .select("coach_id, coaches!inner(id, slug, profiles!inner(full_name, coach_business_name))")
      .eq("group_id", id);
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    return NextResponse.json({ group, members: members ?? [] });
  } catch (err) {
    console.error("admin/coach-groups/[id] GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      updates.name = name;
    }
    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null;
    }

    if (Object.keys(updates).length > 1) {
      const { error } = await supabaseAdmin
        .from("coach_groups")
        .update(updates)
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (Array.isArray(body.coachIds)) {
      const coachIds = body.coachIds.filter(
        (coachId: unknown): coachId is string => typeof coachId === "string",
      );
      await supabaseAdmin.from("coach_group_members").delete().eq("group_id", id);
      if (coachIds.length) {
        const { error: membersError } = await supabaseAdmin
          .from("coach_group_members")
          .insert(coachIds.map((coachId: string) => ({ group_id: id, coach_id: coachId })));
        if (membersError) {
          return NextResponse.json({ error: membersError.message }, { status: 500 });
        }
      }
    }

    return GET(request, context);
  } catch (err) {
    console.error("admin/coach-groups/[id] PATCH error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { error } = await supabaseAdmin.from("coach_groups").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coach-groups/[id] DELETE error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
