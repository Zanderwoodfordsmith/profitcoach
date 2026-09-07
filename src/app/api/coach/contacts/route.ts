import { NextResponse } from "next/server";
import { normalizeLinkedInProfileUrl } from "@/lib/apify/linkedinProfile";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  businessName?: string;
  linkedinUrl?: string;
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
  const phone = body.phone?.trim() || null;
  const jobTitle = body.jobTitle?.trim() || null;
  const businessName = body.businessName?.trim() || null;
  const sendInvite = !!body.sendInvite;
  const contactType = body.type === "client" ? "client" : "prospect";

  let linkedinUrl: string | null = null;
  if (body.linkedinUrl?.trim()) {
    linkedinUrl = normalizeLinkedInProfileUrl(body.linkedinUrl);
    if (!linkedinUrl) {
      return NextResponse.json(
        { error: "Invalid LinkedIn profile URL." },
        { status: 400 }
      );
    }
  }

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

    const { first_name, last_name } = splitFullName(fullName);
    const resolved = await resolveOrCreateContact({
      coachId,
      fullName,
      firstName: first_name,
      lastName: last_name,
      email,
      phone,
      linkedinUrl,
      jobTitle,
      businessName,
      type: contactType,
      prospectSource: contactType === "prospect" ? "manual" : null,
    });

    const slug = coachRow.slug as string;

    return NextResponse.json(
      {
        ok: true,
        contactId: resolved.contactId,
        created: resolved.created,
        matchedBy: resolved.matchedBy,
        coachSlug: slug,
        sendInvite,
        type: contactType,
      },
      { status: resolved.created ? 201 : 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
