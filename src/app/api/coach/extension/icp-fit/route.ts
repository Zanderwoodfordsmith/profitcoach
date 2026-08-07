import { NextResponse } from "next/server";
import { requireExtensionLinkedInAccess } from "@/lib/extensionLinkedIn/access";
import { extensionAuthErrorPayload } from "@/lib/extensionLinkedIn/httpErrors";
import { scoreProspectIcpFit } from "@/lib/extensionLinkedIn/icpFit";

type Body = {
  fullName?: string;
  firstName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  headline?: string | null;
  location?: string | null;
  about?: string | null;
  linkedinUrl?: string | null;
  connectionDegree?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireExtensionLinkedInAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(extensionAuthErrorPayload(auth), {
      status: auth.status ?? 403,
    });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fullName = body.fullName?.trim();
  if (!fullName) {
    return NextResponse.json(
      { error: "Please provide prospect name." },
      { status: 400 }
    );
  }

  try {
    const fit = await scoreProspectIcpFit({
      coachId: auth.userId,
      profile: {
        fullName,
        firstName: body.firstName,
        jobTitle: body.jobTitle,
        businessName: body.businessName,
        headline: body.headline,
        location: body.location,
        about: body.about,
        linkedinUrl: body.linkedinUrl,
        connectionDegree: body.connectionDegree,
      },
    });
    return NextResponse.json({ ok: true, fit });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to score ICP fit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
