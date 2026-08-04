import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapLeadListRow } from "@/lib/firstCampaign/mapApi";

const MAX_LIST_ITEMS = 250;
const INSERT_CHUNK_SIZE = 250;

type PostBody = {
  name?: string;
  icpId?: string;
  leadFinderIds?: string[];
  /** UI may send `leadIds` */
  leadIds?: string[];
  connectionIds?: string[];
  /** When true, use latest title-matched connections batch */
  useLatestConnectionMatches?: boolean;
  filters?: Record<string, unknown>;
  source?: string;
  count?: number;
};

function toChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const leadFinderIds = [
    ...new Set([...(body.leadFinderIds ?? []), ...(body.leadIds ?? [])].filter(Boolean)),
  ].slice(0, MAX_LIST_ITEMS);
  let connectionIds = [...new Set((body.connectionIds ?? []).filter(Boolean))].slice(
    0,
    MAX_LIST_ITEMS
  );

  if (connectionIds.length === 0 && body.useLatestConnectionMatches) {
    const { data: latest } = await supabaseAdmin
      .from("coach_linkedin_connections")
      .select("upload_batch_id")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const batchId = latest?.upload_batch_id as string | undefined;
    if (batchId) {
      const { data: matched } = await supabaseAdmin
        .from("coach_linkedin_connections")
        .select("id")
        .eq("coach_id", coachId)
        .eq("upload_batch_id", batchId)
        .eq("title_match", true)
        .limit(MAX_LIST_ITEMS);
      connectionIds = (matched ?? []).map((r) => r.id as string);
    }
  }

  if (leadFinderIds.length === 0 && connectionIds.length === 0) {
    return NextResponse.json(
      { error: "Provide leadFinderIds and/or connectionIds." },
      { status: 400 }
    );
  }

  let icpId = body.icpId?.trim();
  if (!icpId) {
    const { data: setup } = await supabaseAdmin
      .from("coach_campaign_setup")
      .select("selected_icp_id")
      .eq("coach_id", coachId)
      .maybeSingle();
    icpId = (setup?.selected_icp_id as string | undefined) ?? undefined;
  }

  const source =
    leadFinderIds.length > 0 && connectionIds.length > 0
      ? "mixed"
      : leadFinderIds.length > 0
        ? "lead_finder"
        : "connections";

  const { data: list, error: listError } = await supabaseAdmin
    .from("coach_lead_lists")
    .insert({
      coach_id: coachId,
      name: body.name?.trim() || `Starter list — ${new Date().toISOString().slice(0, 10)}`,
      source,
      icp_id: icpId ?? null,
      filters: body.filters ?? {},
    })
    .select("*")
    .single();

  if (listError || !list) {
    return NextResponse.json(
      { error: listError?.message ?? "Could not create lead list." },
      { status: 500 }
    );
  }

  const items: Record<string, unknown>[] = [];

  if (leadFinderIds.length > 0) {
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leadrocks_leads")
      .select(
        "id, full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, team_size, revenue_range, industry, raw"
      )
      .in("id", leadFinderIds);

    if (leadsError) {
      await supabaseAdmin.from("coach_lead_lists").delete().eq("id", list.id);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    for (const lead of leads ?? []) {
      items.push({
        list_id: list.id,
        coach_id: coachId,
        source: "lead_finder",
        leadrocks_id: lead.id,
        full_name: lead.full_name,
        first_name: lead.first_name,
        last_name: lead.last_name,
        job_title: lead.job_title,
        company: lead.company,
        linkedin_url: lead.linkedin_url,
        email: lead.email,
        phone: lead.phone,
        team_size: lead.team_size,
        revenue_range: lead.revenue_range,
        industry: lead.industry,
        match_reason: "Lead Finder match",
        raw: lead.raw ?? {},
      });
    }
  }

  if (connectionIds.length > 0) {
    const { data: connections, error: connError } = await supabaseAdmin
      .from("coach_linkedin_connections")
      .select("*")
      .eq("coach_id", coachId)
      .in("id", connectionIds);

    if (connError) {
      await supabaseAdmin.from("coach_lead_lists").delete().eq("id", list.id);
      return NextResponse.json({ error: connError.message }, { status: 500 });
    }

    for (const c of connections ?? []) {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
      items.push({
        list_id: list.id,
        coach_id: coachId,
        source: "connections",
        leadrocks_id: null,
        full_name: fullName,
        first_name: c.first_name,
        last_name: c.last_name,
        job_title: c.position,
        company: c.company,
        linkedin_url: c.linkedin_url,
        email: c.email,
        phone: null,
        team_size: c.team_size,
        revenue_range: c.revenue_range,
        industry: c.industry,
        match_reason: c.matched_titles?.length
          ? `Title match: ${(c.matched_titles as string[]).join(", ")}`
          : "Title match",
        raw: c.raw ?? {},
      });
    }
  }

  const capped = items.slice(0, MAX_LIST_ITEMS);

  for (const chunk of toChunks(capped, INSERT_CHUNK_SIZE)) {
    const { error: itemsError } = await supabaseAdmin
      .from("coach_lead_list_items")
      .insert(chunk);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  const { data: updatedList, error: updateError } = await supabaseAdmin
    .from("coach_lead_lists")
    .update({ item_count: capped.length, updated_at: new Date().toISOString() })
    .eq("id", list.id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("coach_campaign_setup")
    .update({
      selected_lead_list_id: list.id,
      step5_completed_at: new Date().toISOString(),
      current_step: 5,
      updated_at: new Date().toISOString(),
    })
    .eq("coach_id", coachId);

  return NextResponse.json({
    list: updatedList ?? list,
    leadList: mapLeadListRow((updatedList ?? list) as Parameters<typeof mapLeadListRow>[0]),
    itemCount: capped.length,
  });
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const listId = url.searchParams.get("listId");

  if (listId) {
    const [{ data: list }, { data: items }] = await Promise.all([
      supabaseAdmin
        .from("coach_lead_lists")
        .select("*")
        .eq("id", listId)
        .eq("coach_id", auth.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("coach_lead_list_items")
        .select("*")
        .eq("list_id", listId)
        .eq("coach_id", auth.userId)
        .order("created_at", { ascending: true }),
    ]);

    if (!list) {
      return NextResponse.json({ error: "Lead list not found." }, { status: 404 });
    }
    return NextResponse.json({ list, items: items ?? [] });
  }

  const { data: lists, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("*")
    .eq("coach_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lists: lists ?? [] });
}
