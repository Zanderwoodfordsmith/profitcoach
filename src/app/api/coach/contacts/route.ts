import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  email?: string;
  businessName?: string;
  sendInvite?: boolean;
  type?: "prospect" | "client";
};

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

  const { data: profile, error: profileError } = await supabaseAdmin
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

export async function POST(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId!;
  const body = (await request.json()) as Body;

  const fullName = body.fullName?.trim();
  const email = body.email?.trim() || null;
  const businessName = body.businessName?.trim() || null;
  const sendInvite = !!body.sendInvite;
  const contactType = body.type === "client" ? "client" : "prospect";

  if (!fullName) {
    return NextResponse.json(
      { error: contactType === "client" ? "Please provide client name." : "Please provide prospect name." },
      { status: 400 }
    );
  }

  try {
    const { data: coachRow, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("slug")
      .eq("id", coachId)
      .maybeSingle();

    if (coachError || !coachRow) {
      throw new Error("Coach record not found.");
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        coach_id: coachId,
        full_name: fullName,
        email,
        business_name: businessName,
        type: contactType,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      throw new Error(contactType === "client" ? "Unable to create client." : "Unable to create prospect.");
    }

    const slug = coachRow.slug as string;

    return NextResponse.json(
      {
        ok: true,
        contactId: inserted.id as string,
        coachSlug: slug,
        sendInvite,
        type: contactType,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}
