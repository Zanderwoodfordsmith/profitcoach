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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: contactId } = await context.params;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact || contact.coach_id !== authCheck.userId) {
    return NextResponse.json(
      { error: "Contact not found or not yours." },
      { status: 404 }
    );
  }

  const { data: rows } = await supabaseAdmin
    .from("client_playbook_unlocks")
    .select("playbook_ref")
    .eq("contact_id", contactId);

  const unlocks = (rows ?? []).map((r) => r.playbook_ref as string);

  return NextResponse.json({ unlocks });
}

export async function POST(request: Request, context: RouteContext) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: contactId } = await context.params;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact || contact.coach_id !== authCheck.userId) {
    return NextResponse.json(
      { error: "Contact not found or not yours." },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    playbook_ref?: string;
    unlocked?: boolean;
  };

  const playbookRef = body.playbook_ref?.trim();
  const unlocked = body.unlocked !== false;

  if (!playbookRef) {
    return NextResponse.json(
      { error: "Missing playbook_ref" },
      { status: 400 }
    );
  }

  if (unlocked) {
    const { error: insertError } = await supabaseAdmin
      .from("client_playbook_unlocks")
      .upsert(
        {
          contact_id: contactId,
          playbook_ref: playbookRef,
          unlocked_at: new Date().toISOString(),
        },
        {
          onConflict: "contact_id,playbook_ref",
          ignoreDuplicates: false,
        }
      );

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to unlock playbook" },
        { status: 500 }
      );
    }
  } else {
    const { error: deleteError } = await supabaseAdmin
      .from("client_playbook_unlocks")
      .delete()
      .eq("contact_id", contactId)
      .eq("playbook_ref", playbookRef);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to lock playbook" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    playbook_ref: playbookRef,
    unlocked,
  });
}
