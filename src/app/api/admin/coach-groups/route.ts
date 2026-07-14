import type { CoachGroupSummary } from "@/lib/actionPlans/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const groups = data ?? [];
    const groupIds = groups.map((g) => g.id as string);

    const coachIdsByGroup = new Map<string, string[]>();
    for (const id of groupIds) coachIdsByGroup.set(id, []);

    if (groupIds.length > 0) {
      const { data: members, error: membersError } = await supabaseAdmin
        .from("coach_group_members")
        .select("group_id, coach_id")
        .in("group_id", groupIds);
      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 });
      }
      for (const row of members ?? []) {
        const groupId = row.group_id as string;
        const coachId = row.coach_id as string;
        const list = coachIdsByGroup.get(groupId);
        if (list) list.push(coachId);
      }
    }

    const summaries: CoachGroupSummary[] = groups.map((group) => {
      const coachIds = coachIdsByGroup.get(group.id as string) ?? [];
      return {
        id: group.id as string,
        name: group.name as string,
        description: (group.description as string | null) ?? null,
        memberCount: coachIds.length,
        coachIds,
        createdAt: group.created_at as string,
        updatedAt: group.updated_at as string,
      };
    });

    return NextResponse.json({ groups: summaries });
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

    const group: CoachGroupSummary = {
      id: data.id as string,
      name: data.name as string,
      description: (data.description as string | null) ?? null,
      memberCount: coachIds.length,
      coachIds,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };

    return NextResponse.json({ group });
  } catch (err) {
    console.error("admin/coach-groups POST error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
