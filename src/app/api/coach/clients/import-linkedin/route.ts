import { NextResponse } from "next/server";
import { LinkedInProfileError } from "@/lib/apify/linkedinProfile";
import { upsertClientFromLinkedIn } from "@/lib/clientCoaching/upsertClientFromLinkedIn";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

type Body = {
  linkedinUrl?: string;
};

/**
 * POST /api/coach/clients/import-linkedin
 * Body: { linkedinUrl }
 * Scrapes the LinkedIn profile and creates/updates a client contact.
 */
export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const linkedinUrl = body.linkedinUrl?.trim();
  if (!linkedinUrl) {
    return NextResponse.json(
      { error: "Paste a LinkedIn profile URL." },
      { status: 400 }
    );
  }

  try {
    const result = await upsertClientFromLinkedIn(authCheck.userId, linkedinUrl);
    return NextResponse.json(
      {
        ok: true,
        contactId: result.contactId,
        created: result.created,
        linkedinUrl: result.linkedinUrl,
        contact: {
          fullName: result.snapshot.fullName,
          headline: result.snapshot.headline,
          photoUrl: result.snapshot.photoUrl,
          location: result.snapshot.location,
        },
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (err) {
    if (err instanceof LinkedInProfileError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "invalid_url"
            ? 400
            : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "Unable to import client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
