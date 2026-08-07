import { NextResponse } from "next/server";
import { requireExtensionLinkedInAccess } from "@/lib/extensionLinkedIn/access";
import {
  draftLinkedInNotesForProspect,
  type DraftNoteKind,
} from "@/lib/extensionLinkedIn/draftNote";

type Body = {
  kind?: DraftNoteKind;
  fullName?: string;
  firstName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  headline?: string | null;
  location?: string | null;
  about?: string | null;
  linkedinUrl?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireExtensionLinkedInAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      {
        error: auth.error ?? "Unauthorized",
        code:
          auth.error === "Feature not available for your access tier."
            ? "tier_required"
            : auth.error === "Extension not enabled for this account yet."
              ? "allowlist"
              : auth.error === "Pick a coach to act as."
                ? "need_coach"
                : "auth",
        coaches: auth.coaches,
        upgradePath: "/coach/membership",
      },
      { status: auth.status ?? 403 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind = body.kind === "dm" ? "dm" : body.kind === "connector" ? "connector" : null;
  if (!kind) {
    return NextResponse.json(
      { error: 'kind must be "connector" or "dm".' },
      { status: 400 }
    );
  }

  const fullName = body.fullName?.trim();
  if (!fullName) {
    return NextResponse.json(
      { error: "Please provide prospect name." },
      { status: 400 }
    );
  }

  try {
    const { variants } = await draftLinkedInNotesForProspect({
      coachId: auth.userId,
      kind,
      profile: {
        fullName,
        firstName: body.firstName,
        jobTitle: body.jobTitle,
        businessName: body.businessName,
        headline: body.headline,
        location: body.location,
        about: body.about,
        linkedinUrl: body.linkedinUrl,
      },
    });

    return NextResponse.json({ ok: true, kind, variants });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to draft notes.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
