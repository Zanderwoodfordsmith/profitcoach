import { NextResponse } from "next/server";
import {
  loadLatestPremiumDiagnosticByContactId,
  loadPremiumSessionScoresByContactId,
} from "@/lib/prospectAssessmentSummary";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type WorkshopContactPickerRow = {
  id: string;
  full_name: string;
  business_name: string | null;
  job_title: string | null;
  type: string;
  boss_score_premium: number | null;
};

/**
 * Lightweight contact list for BOSS Pro session picker.
 * Avoids full prospect/client table enrichment (calls, next actions, etc.).
 */
export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status =
      authCheck.error ===
      "Admin must pass x-impersonate-coach-id for this resource."
        ? 400
        : 401;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

  const coachId = authCheck.userId;

  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, business_name, job_title, type")
    .eq("coach_id", coachId)
    .in("type", ["prospect", "client"])
    .order("full_name", { ascending: true });

  if (contactsError) {
    console.error("coach/workshop-contacts GET:", contactsError);
    return NextResponse.json(
      { error: "Unable to load contacts." },
      { status: 500 }
    );
  }

  const rows = contacts ?? [];
  const contactIds = rows.map((row) => row.id as string);

  const [diagnosticByContact, sessionByContact] = await Promise.all([
    loadLatestPremiumDiagnosticByContactId(supabaseAdmin, contactIds),
    loadPremiumSessionScoresByContactId(supabaseAdmin, contactIds),
  ]);

  const contactsOut: WorkshopContactPickerRow[] = rows.map((row) => {
    const id = row.id as string;
    const session = sessionByContact[id];
    const diagnostic = diagnosticByContact[id];
    const boss_score_premium =
      session?.total_score ?? diagnostic?.total_score ?? null;

    return {
      id,
      full_name: (row.full_name as string) ?? "",
      business_name: (row.business_name as string | null) ?? null,
      job_title: (row.job_title as string | null) ?? null,
      type: (row.type as string) ?? "prospect",
      boss_score_premium,
    };
  });

  return NextResponse.json({ contacts: contactsOut });
}
