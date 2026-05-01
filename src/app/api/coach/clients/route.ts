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

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  const { data: contactsData, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, email, business_name, type, created_at")
    .eq("coach_id", coachId)
    .eq("type", "client")
    .order("created_at", { ascending: false });

  if (contactsError) {
    return NextResponse.json(
      { error: "Could not load clients." },
      { status: 500 }
    );
  }

  const contacts = contactsData ?? [];
  const contactIds = contacts.map((c) => c.id as string);

  let latestByContact: Record<
    string,
    { total_score: number; completed_at: string }
  > = {};

  if (contactIds.length > 0) {
    const { data: assessments } = await supabaseAdmin
      .from("assessments")
      .select("contact_id, total_score, completed_at")
      .in("contact_id", contactIds)
      .order("completed_at", { ascending: false });

    for (const row of assessments ?? []) {
      const cid = (row as { contact_id: string }).contact_id;
      if (!latestByContact[cid]) {
        latestByContact[cid] = {
          total_score: (row as { total_score: number }).total_score,
          completed_at: (row as { completed_at: string }).completed_at,
        };
      }
    }
  }

  const clients = contacts.map((c) => {
    const latest = latestByContact[c.id as string];
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email ?? null,
      business_name: c.business_name ?? null,
      type: (c.type as string) ?? "client",
      last_score: latest?.total_score ?? null,
      last_completed_at: latest?.completed_at ?? null,
    };
  });

  return NextResponse.json({ clients });
}
