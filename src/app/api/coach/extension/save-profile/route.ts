import { NextResponse } from "next/server";
import { requireExtensionLinkedInAccess } from "@/lib/extensionLinkedIn/access";
import { upsertProspectFromLinkedIn } from "@/lib/extensionLinkedIn/upsertProspectFromLinkedIn";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";

type Body = {
  linkedinUrl?: string;
  fullName?: string;
  email?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  headline?: string | null;
  location?: string | null;
  about?: string | null;
  photoUrl?: string | null;
  prospectStatus?: string | null;
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

  try {
    const result = await upsertProspectFromLinkedIn(auth.userId, {
      linkedinUrl: body.linkedinUrl ?? "",
      fullName: body.fullName ?? "",
      email: body.email,
      jobTitle: body.jobTitle,
      businessName: body.businessName,
      headline: body.headline,
      location: body.location,
      about: body.about,
      photoUrl: body.photoUrl,
      prospectStatus: body.prospectStatus,
    });

    const workspacePath = prospectWorkspacePath(result.contactId);
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ok: true,
      contactId: result.contactId,
      created: result.created,
      linkedinUrl: result.linkedinUrl,
      workspacePath,
      workspaceUrl: `${origin}${workspacePath}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to save prospect.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
