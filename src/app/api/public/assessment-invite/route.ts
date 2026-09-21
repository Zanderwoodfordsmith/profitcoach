import { NextResponse } from "next/server";
import { findContactByAssessmentInviteToken } from "@/lib/assessmentInviteToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public, token-gated: should this personalised assessment ask for email/phone?
 * Does not return the stored email or phone.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("c");
  const coachSlug = url.searchParams.get("coach")?.trim().toLowerCase() ?? "";
  if (!token || !coachSlug) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", coachSlug)
    .maybeSingle();
  if (!coach?.id) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const contact = await findContactByAssessmentInviteToken({
    token,
    coachId: coach.id as string,
  });
  if (!contact) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    firstName: contact.firstName,
    hasEmail: Boolean(contact.email),
    hasPhone: Boolean(contact.phone),
  });
}
