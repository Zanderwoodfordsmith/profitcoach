import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { createCampaignFromLibraryTemplate } from "@/lib/campaignLibrary/instantiate";
import {
  createCampaign,
  listArchivedCampaigns,
  listCampaigns,
} from "@/lib/unipile/campaigns";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const archivedOnly =
      new URL(request.url).searchParams.get("archived") === "1";
    const campaigns = archivedOnly
      ? await listArchivedCampaigns(auth.coachId)
      : await listCampaigns(auth.coachId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list campaigns." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    outreach_account_id?: string | null;
    channel?: "linkedin" | "email";
    library_template_id?: string;
  };
  try {
    if (typeof body.library_template_id === "string") {
      const campaign = await createCampaignFromLibraryTemplate(auth.coachId, {
        name: typeof body.name === "string" ? body.name : "",
        outreach_account_id: body.outreach_account_id ?? null,
        templateId: body.library_template_id,
      });
      return NextResponse.json({ campaign });
    }
    const campaign = await createCampaign(auth.coachId, {
      name: typeof body.name === "string" ? body.name : "",
      outreach_account_id: body.outreach_account_id ?? null,
      channel: body.channel === "email" ? "email" : "linkedin",
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    const status = message === "Template not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
