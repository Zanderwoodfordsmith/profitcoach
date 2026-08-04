import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapConnectionRows } from "@/lib/firstCampaign/mapApi";

const MATCH_CAP = 250;

type MatchBody = {
  batchId?: string;
  enrich?: boolean;
};

function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    u.hash = "";
    u.search = "";
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase() || null;
  }
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const body = (await request.json().catch(() => ({}))) as MatchBody;

  let batchId = body.batchId?.trim();
  if (!batchId) {
    const { data: latest } = await supabaseAdmin
      .from("coach_linkedin_connections")
      .select("upload_batch_id, created_at")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    batchId = (latest?.upload_batch_id as string | undefined) ?? undefined;
  }

  if (!batchId) {
    return NextResponse.json({ error: "No connections upload found. Upload a Connections.csv first." }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("coach_linkedin_connections")
    .select("*")
    .eq("coach_id", coachId)
    .eq("upload_batch_id", batchId)
    .eq("title_match", true)
    .order("created_at", { ascending: true })
    .limit(MATCH_CAP);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matches = rows ?? [];

  if (!body.enrich || matches.length === 0) {
    const mapped = mapConnectionRows(matches);
    return NextResponse.json({
      batchId,
      total: mapped.length,
      matches: mapped,
      matched: mapped,
    });
  }

  const urlToConnection = new Map<string, (typeof matches)[number]>();
  const candidateUrls = new Set<string>();
  for (const row of matches) {
    const raw = (row.linkedin_url as string | null)?.trim();
    if (!raw) continue;
    const normalized = normalizeLinkedInUrl(raw);
    if (normalized) {
      urlToConnection.set(normalized, row);
      candidateUrls.add(raw);
      candidateUrls.add(normalized);
      candidateUrls.add(`${normalized}/`);
    }
  }

  if (candidateUrls.size > 0) {
    const { data: leads } = await supabaseAdmin
      .from("leadrocks_leads")
      .select("linkedin_url, team_size, revenue_range, industry, company, company_website")
      .in("linkedin_url", [...candidateUrls]);

    for (const lead of leads ?? []) {
      const normalized = normalizeLinkedInUrl(lead.linkedin_url as string | null);
      if (!normalized) continue;
      const connection = urlToConnection.get(normalized);
      if (!connection) continue;
      connection.team_size = lead.team_size ?? connection.team_size ?? null;
      connection.revenue_range = lead.revenue_range ?? connection.revenue_range ?? null;
      connection.industry = lead.industry ?? connection.industry ?? null;
      connection.enrich_status = "leadrocks";
    }

    const enrichedIds = matches
      .filter((m) => m.enrich_status === "leadrocks")
      .map((m) => m.id as string);
    if (enrichedIds.length > 0) {
      await supabaseAdmin
        .from("coach_linkedin_connections")
        .update({ enrich_status: "leadrocks" })
        .in("id", enrichedIds);
    }
  }

  const mapped = mapConnectionRows(matches);
  return NextResponse.json({
    batchId,
    total: mapped.length,
    matches: mapped,
    matched: mapped,
  });
}
