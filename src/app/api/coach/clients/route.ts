import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
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
      "id, full_name, email, business_name, type, created_at"
    );

  if (contactsError) {
    console.error("coach/clients GET contacts:", contactsError);
    return NextResponse.json(
      { error: "Could not load clients." },
      { status: 500 }
    );
  }

  const clients = await enrichProspectRows(
    supabaseAdmin,
    contacts.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email ?? null,
      business_name: c.business_name ?? null,
      phone: c.phone ?? null,
      type: c.type ?? "client",
    }))
  );

  return NextResponse.json({ clients });
}
