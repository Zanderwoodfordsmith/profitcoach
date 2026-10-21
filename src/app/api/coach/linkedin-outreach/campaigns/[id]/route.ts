import { after, NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { applyLibraryTemplateToCampaign } from "@/lib/campaignLibrary/instantiate";
import {
  addCampaignLeads,
  addCampaignLeadsFromContacts,
  applyCampaignPlaybook,
  campaignOwnedByCoach,
  deleteCampaign,
  deleteCampaignLead,
  deleteCampaignLeads,
  duplicateCampaign,
  enrollContactInCampaign,
  enqueuePendingJobsForCampaign,
  getCampaign,
  getCampaignJobs,
  moveCampaignLeads,
  pauseCampaignLeads,
  replaceCampaignSteps,
  removeContactFromCampaign,
  resumeCampaignLeads,
  setCampaignStatus,
  updateCampaign,
  type CampaignStepInput,
  type CampaignStatus,
} from "@/lib/unipile/campaigns";
import { placeCampaignAtTopOfList } from "@/lib/unipile/campaignListPlacement";
import { loadCampaignActivity } from "@/lib/unipile/activityHeatmap";
import { abStatsForCampaign } from "@/lib/unipile/interest";
import {
  loadCampaignLeadProfile,
  openCampaignLeadAsProspect,
} from "@/lib/unipile/campaignLeadProfile";

type Ctx = { params: Promise<{ id: string }> };

const LEAD_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const part = params.get("part");
  try {
    if (part === "lead") {
      const leadId = params.get("lead") ?? "";
      if (!LEAD_ID_RE.test(leadId)) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const profile = await loadCampaignLeadProfile(auth.coachId, id, leadId);
      if (!profile) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ profile });
    }
    if (part === "extras") {
      const owned = await campaignOwnedByCoach(auth.coachId, id);
      if (!owned) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const [jobs, ab, activity] = await Promise.all([
        getCampaignJobs(id),
        abStatsForCampaign(id),
        loadCampaignActivity(auth.coachId, id, 30),
      ]);
      return NextResponse.json({ jobs, ab, activity });
    }

    const detail = await getCampaign(auth.coachId, id, { includeJobs: false });
    if (!detail) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (part === "core") {
      return NextResponse.json(detail);
    }
    const [jobs, ab, activity] = await Promise.all([
      getCampaignJobs(id),
      abStatsForCampaign(id),
      loadCampaignActivity(auth.coachId, id, 30),
    ]);
    return NextResponse.json({ ...detail, jobs, ab, activity });
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
      const owned = await campaignOwnedByCoach(auth.coachId, id);
      if (!owned) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const releaseWaitPosition =
        typeof body.release_wait_position === "number" &&
        Number.isInteger(body.release_wait_position) &&
        body.release_wait_position >= 0
          ? body.release_wait_position
          : undefined;
      // Group test steps keep their fixed wording whatever the editor sends.
      const { lockedStepsById } = await import("@/lib/groupTests/store");
      const locked = await lockedStepsById(id);
      const incoming = (body.steps as CampaignStepInput[]).map((step) => {
        const fixed = step.id ? locked.get(step.id) : undefined;
        if (!fixed) return step;
        return {
          ...step,
          body: fixed.body,
          variants: (fixed.variants as CampaignStepInput["variants"]) ?? null,
          config: fixed.config,
        };
      });
      const steps = await replaceCampaignSteps(
        id,
        incoming,
        releaseWaitPosition != null ? { releaseWaitPosition } : undefined
      );
      return NextResponse.json({ steps });
    }

    if (typeof body.status === "string") {
      const nextStatus = body.status as CampaignStatus;
      if (nextStatus === "running") {
        // Don't let a campaign go live with something prospects would see broken.
        const { checkCampaignById } = await import("@/lib/campaigns/launchCheck");
        const blockers = (await checkCampaignById(auth.coachId, id)).filter((i) => i.level === "blocker");
        if (blockers.length) {
          return NextResponse.json(
            { error: blockers.map((b) => b.message).join(" "), issues: blockers },
            { status: 422 }
          );
        }
      }
      if ("outreach_account_id" in body) {
        await updateCampaign(auth.coachId, id, {
          outreach_account_id: body.outreach_account_id,
        });
      }
      const campaign = await setCampaignStatus(auth.coachId, id, nextStatus);
      // Enqueue after the response so turning On stays snappy on large pools.
      if (nextStatus === "running" && auth.coachId) {
        const coachId = auth.coachId;
        after(() => {
          void enqueuePendingJobsForCampaign(coachId, id).catch((err) => {
            console.error("enqueuePendingJobsForCampaign after turn-on:", err);
          });
        });
      }
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

    if (
      body.action === "apply_library_template" &&
      typeof body.library_template_id === "string"
    ) {
      const result = await applyLibraryTemplateToCampaign(
        auth.coachId,
        id,
        body.library_template_id
      );
      return NextResponse.json(result);
    }

    if (body.action === "open_lead" && typeof body.lead_id === "string") {
      if (!LEAD_ID_RE.test(body.lead_id)) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const result = await openCampaignLeadAsProspect({
        coachId: auth.coachId,
        campaignId: id,
        leadId: body.lead_id,
      });
      return NextResponse.json(result);
    }

    if (body.action === "add_leads" && Array.isArray(body.leads)) {
      const result = await addCampaignLeads(
        auth.coachId,
        id,
        body.leads as Array<{
          linkedin_url?: string;
          first_name?: string;
          last_name?: string;
          company?: string;
          title?: string;
          linkedin_provider_id?: string;
        }>
      );
      return NextResponse.json(result);
    }

    if (
      body.action === "add_from_contacts" &&
      Array.isArray(body.contact_ids)
    ) {
      const result = await addCampaignLeadsFromContacts(
        auth.coachId,
        id,
        body.contact_ids
      );
      return NextResponse.json(result);
    }

    if (body.action === "enroll_contact" && typeof body.contact_id === "string") {
      const result = await enrollContactInCampaign(
        auth.coachId,
        id,
        body.contact_id
      );
      return NextResponse.json(result);
    }

    if (body.action === "remove_contact" && typeof body.contact_id === "string") {
      await removeContactFromCampaign(auth.coachId, id, body.contact_id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete_lead" && typeof body.lead_id === "string") {
      await deleteCampaignLead(auth.coachId, id, body.lead_id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete_leads") {
      const result = await deleteCampaignLeads(auth.coachId, id, body.lead_ids);
      return NextResponse.json(result);
    }

    if (body.action === "pause_leads") {
      const result = await pauseCampaignLeads(auth.coachId, id, body.lead_ids);
      return NextResponse.json(result);
    }

    if (body.action === "resume_leads") {
      const result = await resumeCampaignLeads(auth.coachId, id, body.lead_ids);
      return NextResponse.json(result);
    }

    if (body.action === "move_leads" && typeof body.target_campaign_id === "string") {
      const result = await moveCampaignLeads(
        auth.coachId,
        id,
        body.lead_ids,
        body.target_campaign_id
      );
      return NextResponse.json(result);
    }

    if (body.action === "duplicate") {
      const campaign = await duplicateCampaign(auth.coachId, id);
      return NextResponse.json({ campaign });
    }

    if (body.action === "delete") {
      const deleted = await deleteCampaign(auth.coachId, id);
      if (!deleted) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "archive") {
      const campaign = await setCampaignStatus(auth.coachId, id, "archived");
      return NextResponse.json({ campaign });
    }

    if (body.action === "unarchive") {
      const campaign = await setCampaignStatus(auth.coachId, id, "paused");
      await placeCampaignAtTopOfList(auth.coachId, id);
      return NextResponse.json({ campaign });
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
