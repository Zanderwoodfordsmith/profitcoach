import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  email?: string;
  jobTitle?: string;
  businessName?: string;
  sendInvite?: boolean;
  type?: "prospect" | "client";
};

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
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
  const jobTitle = body.jobTitle?.trim() || null;
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
        job_title: jobTitle,
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
