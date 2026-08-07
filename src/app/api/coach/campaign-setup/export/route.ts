import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const coachId = auth.userId;

  const url = new URL(request.url);
  const listId =
    url.searchParams.get("listId") ??
    (
      await supabaseAdmin
        .from("coach_campaign_setup")
        .select("selected_lead_list_id")
        .eq("coach_id", coachId)
        .maybeSingle()
    ).data?.selected_lead_list_id;

  if (!listId) {
    return NextResponse.json(
      { error: "No lead list selected. Save a starter list first." },
      { status: 400 }
    );
  }

  const [{ data: list }, { data: items }, { data: messages }, { data: setup }] =
    await Promise.all([
      supabaseAdmin
        .from("coach_lead_lists")
        .select("*")
        .eq("id", listId)
        .eq("coach_id", coachId)
        .maybeSingle(),
      supabaseAdmin
        .from("coach_lead_list_items")
        .select("*")
        .eq("list_id", listId)
        .eq("coach_id", coachId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("coach_campaign_messages")
        .select("*")
        .eq("coach_id", coachId)
        .not("approved_at", "is", null)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("coach_campaign_setup")
        .select("selected_icp_id")
        .eq("coach_id", coachId)
        .maybeSingle(),
    ]);

  if (!list) {
    return NextResponse.json({ error: "Lead list not found." }, { status: 404 });
  }

  const icpId = setup?.selected_icp_id as string | null;
  const approvedMessages = (messages ?? []).filter(
    (m) => !icpId || m.icp_id === icpId
  );

  const header = [
    "full_name",
    "first_name",
    "last_name",
    "job_title",
    "company",
    "linkedin_url",
    "email",
    "phone",
    "team_size",
    "revenue_range",
    "industry",
    "source",
    "match_reason",
  ];

  const rows = (items ?? []).map((item) =>
    [
      item.full_name,
      item.first_name,
      item.last_name,
      item.job_title,
      item.company,
      item.linkedin_url,
      item.email,
      item.phone,
      item.team_size,
      item.revenue_range,
      item.industry,
      item.source,
      item.match_reason,
    ]
      .map((v) => csvEscape(v as string | null))
      .join(",")
  );

  const messageBlock =
    approvedMessages.length > 0
      ? [
          "",
          "# Approved outreach messages",
          ...approvedMessages.map(
            (m) =>
              `# [${m.message_type}] ${m.variant_label}\n# ${String(m.body)
                .split("\n")
                .join("\n# ")}`
          ),
        ]
      : [];

  const csv = [header.join(","), ...rows, ...messageBlock].join("\n");
  const filename = `${String(list.name || "starter-list")
    .replace(/[^\w\-]+/g, "-")
    .slice(0, 60)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
