import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request, { allowAdminSelf: true });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const coachId = authCheck.userId;

  const { data: contacts, error: contactsError } =
    await selectContactsWithOptionalPhone<{
      id: string;
      full_name: string;
      email: string | null;
      business_name: string | null;
      phone: string | null;
      job_title: string | null;
      linkedin_url: string | null;
      photo_url: string | null;
      headline: string | null;
      type: string;
      created_at: string;
    }>(
      async (columns) =>
        supabaseAdmin
          .from("contacts")
          .select(columns)
          .eq("coach_id", coachId)
          .eq("type", "client")
          .order("created_at", { ascending: false }),
      "id, full_name, email, business_name, job_title, linkedin_url, type, created_at",
      ["photo_url", "headline"]
    );

  if (contactsError) {
    console.error("coach/clients GET contacts:", contactsError);
    return NextResponse.json(
      { error: "Could not load clients." },
      { status: 500 }
    );
  }

  const enriched = await enrichProspectRows(
    supabaseAdmin,
    contacts.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email ?? null,
      business_name: c.business_name ?? null,
      phone: c.phone ?? null,
      job_title: c.job_title ?? null,
      linkedin_url: c.linkedin_url ?? null,
      type: c.type ?? "client",
    }))
  );

  const photoById = new Map(
    contacts.map((c) => [c.id, { photo_url: c.photo_url, headline: c.headline }])
  );

  const clients = enriched.map((row) => {
    const extra = photoById.get(row.id);
    return {
      ...row,
      photo_url: extra?.photo_url ?? null,
      headline: extra?.headline ?? null,
    };
  });

  return NextResponse.json({ clients });
}
