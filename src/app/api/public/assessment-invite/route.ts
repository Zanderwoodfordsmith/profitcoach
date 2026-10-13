import { NextResponse } from "next/server";
import {
  isDeliverableAssessmentEmail,
  knownAssessmentPersonName,
} from "@/lib/assessmentContactParams";
import { findContactByAssessmentInviteToken } from "@/lib/assessmentInviteToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public, token-gated: which identity fields does this invite already have?
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

  const invitedName = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ");

  return NextResponse.json({
    ok: true,
    firstName: contact.firstName,
    hasName: knownAssessmentPersonName(contact.fullName, invitedName) != null,
    hasEmail: isDeliverableAssessmentEmail(contact.email),
    hasPhone: Boolean(contact.phone?.trim()),
  });
}
