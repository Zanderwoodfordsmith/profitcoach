import type { CoachGroupSummary } from "@/lib/actionPlans/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function buildGroupSummary(group: {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}): Promise<CoachGroupSummary> {
  const { count } = await supabaseAdmin
    .from("coach_group_members")
    .select("coach_id", { count: "exact", head: true })
    .eq("group_id", group.id);

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount: count ?? 0,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
  };
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("coach_groups")
      .select("id, name, description, created_at, updated_at")
      .order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groups = await Promise.all((data ?? []).map((row) => buildGroupSummary(row)));
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("admin/coach-groups GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const coachIds = Array.isArray(body.coachIds)
      ? body.coachIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("coach_groups")
      .insert({
        name,
        description: description || null,
        created_by: authCheck.userId,
      })
      .select("id, name, description, created_at, updated_at")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (coachIds.length) {
      const { error: membersError } = await supabaseAdmin
        .from("coach_group_members")
        .insert(coachIds.map((coachId: string) => ({ group_id: data.id, coach_id: coachId })));
      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ group: await buildGroupSummary(data) });
  } catch (err) {
    console.error("admin/coach-groups POST error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
