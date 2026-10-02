import { NextResponse } from "next/server";
import { loadLeadComposePreview } from "@/lib/unipile/composePreview";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

/** Next recommended campaign message for a lead, ready for the inbox composer. */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const leadId = new URL(request.url).searchParams.get("leadId")?.trim() || "";
  if (!leadId) {
    return NextResponse.json({ error: "leadId required." }, { status: 400 });
  }
  try {
    const preview = await loadLeadComposePreview(auth.coachId, leadId);
    if (!preview) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load message." },
      { status: 500 }
    );
  }
}
