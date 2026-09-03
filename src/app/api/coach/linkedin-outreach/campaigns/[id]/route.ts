import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  addCampaignLeads,
  applyCampaignPlaybook,
  deleteCampaignLead,
  getCampaign,
  replaceCampaignSteps,
  setCampaignStatus,
  updateCampaign,
  type CampaignStepInput,
  type CampaignStatus,
} from "@/lib/unipile/campaigns";
import { abStatsForCampaign } from "@/lib/unipile/interest";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const detail = await getCampaign(auth.coachId, id);
    if (!detail) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const ab = await abStatsForCampaign(id);
    return NextResponse.json({ ...detail, ab });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Load failed." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  try {
    if (Array.isArray(body.steps)) {
      const steps = await replaceCampaignSteps(
        id,
        body.steps as CampaignStepInput[]
      );
      return NextResponse.json({ steps });
    }

    if (typeof body.status === "string") {
      const campaign = await setCampaignStatus(
        auth.coachId,
        id,
        body.status as CampaignStatus
      );
      return NextResponse.json({ campaign });
    }

    if (body.action === "apply_playbook" && typeof body.playbook_id === "string") {
      const result = await applyCampaignPlaybook(
        auth.coachId,
        id,
        body.playbook_id
      );
      return NextResponse.json(result);
    }

    if (body.action === "add_leads" && Array.isArray(body.leads)) {
      const result = await addCampaignLeads(
        auth.coachId,
        id,
        body.leads as Array<{
          linkedin_url: string;
          first_name?: string;
          last_name?: string;
          company?: string;
          title?: string;
        }>
      );
      return NextResponse.json(result);
    }

    if (body.action === "delete_lead" && typeof body.lead_id === "string") {
      await deleteCampaignLead(auth.coachId, id, body.lead_id);
      return NextResponse.json({ ok: true });
    }

    const campaign = await updateCampaign(auth.coachId, id, body);
    if (!campaign) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 }
    );
  }
}
