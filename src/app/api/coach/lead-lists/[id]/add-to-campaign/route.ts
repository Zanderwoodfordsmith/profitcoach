import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addCampaignLeads } from "@/lib/unipile/campaigns";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { normalizePoolEmail, normalizePoolPhone } from "@/lib/pool/identity";
import {
  isLeadListUuid,
  loadOwnedLeadList,
  MAX_LIST_ITEMS_PER_REQUEST,
} from "@/lib/leadLists/audienceLists";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const list = await loadOwnedLeadList(auth.userId, id);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }
  if (list.kind === "blacklist") {
    return NextResponse.json(
      { error: "Blacklisted people cannot be added to a campaign." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    campaign_id?: string;
    item_ids?: unknown;
  };
  const campaignId =
    typeof body.campaign_id === "string" ? body.campaign_id.trim() : "";
  if (!isLeadListUuid(campaignId)) {
    return NextResponse.json(
      { error: "Choose a campaign." },
      { status: 400 }
    );
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, channel")
    .eq("id", campaignId)
    .eq("coach_id", auth.userId)
    .maybeSingle();
  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  const campaignChannel =
    (campaign.channel as string | undefined) === "email" ? "email" : "linkedin";

  const itemIds = Array.isArray(body.item_ids)
    ? body.item_ids.filter(
        (value): value is string =>
          typeof value === "string" && isLeadListUuid(value)
      )
    : [];

  let query = supabaseAdmin
    .from("coach_lead_list_items")
    .select(
      "id, first_name, last_name, job_title, company, linkedin_url, email, phone, raw"
    )
    .eq("coach_id", auth.userId)
    .eq("list_id", id)
    .order("created_at", { ascending: true })
    .limit(MAX_LIST_ITEMS_PER_REQUEST);

  if (itemIds.length) {
    query = query.in("id", itemIds.slice(0, MAX_LIST_ITEMS_PER_REQUEST));
  }

  const { data: items, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leads = (items ?? [])
    .map((row) => {
      const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
      const email = normalizePoolEmail(
        typeof row.email === "string" ? row.email : null
      );
      const phone = normalizePoolPhone(
        typeof row.phone === "string" ? row.phone : null
      );
      const raw =
        row.raw && typeof row.raw === "object"
          ? (row.raw as Record<string, unknown>)
          : {};
      const provider =
        typeof raw.linkedin_provider_id === "string"
          ? raw.linkedin_provider_id
          : null;
      return {
        linkedin_url: url ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        company: row.company ?? null,
        title: row.job_title ?? null,
        linkedin_provider_id: provider,
        raw,
      };
    })
    .filter((row) => {
      if (campaignChannel === "email") {
        return Boolean(row.email);
      }
      return Boolean(row.linkedin_url || row.linkedin_provider_id);
    });

  if (!leads.length) {
    return NextResponse.json(
      {
        error:
          campaignChannel === "email"
            ? "None of those people have an email address to add."
            : "None of those people have a LinkedIn profile to add.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await addCampaignLeads(auth.userId, campaignId, leads);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add to campaign." },
      { status: 500 }
    );
  }
}
