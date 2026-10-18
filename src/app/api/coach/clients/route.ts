import { NextResponse } from "next/server";
import { parseClientRosterCreate } from "@/lib/clientRoster/fields";
import { ClientSaveError, saveRosterClient } from "@/lib/clientRoster/save";
import {
  fetchAllSupabasePages,
  selectContactsWithOptionalPhone,
} from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RosterContact = {
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
  client_joined_on: string | null;
  client_fee_amount: number | string | null;
  client_problem_notes: string | null;
  client_sector?: string | null;
  client_revenue_band?: string | null;
  client_team_size?: string | null;
  client_source?: string | null;
  client_result?: string | null;
  client_fit?: number | null;
};

function readFee(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function authStatus(error: string | null | undefined): number {
  if (error === "Admin must pass x-impersonate-coach-id for this resource.") {
    return 400;
  }
  if (error === "Invalid access token.") return 401;
  return 403;
}

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
    await selectContactsWithOptionalPhone<RosterContact>(
      async (columns) =>
        fetchAllSupabasePages(async (from, to) =>
          supabaseAdmin
            .from("contacts")
            .select(columns)
            .eq("coach_id", coachId)
            .eq("type", "client")
            .order("created_at", { ascending: false })
            .range(from, to)
        ),
      "id, full_name, email, business_name, job_title, linkedin_url, type, created_at",
      [
        "photo_url",
        "headline",
        "client_joined_on",
        "client_fee_amount",
        "client_problem_notes",
        "client_sector",
        "client_revenue_band",
        "client_team_size",
        "client_source",
        "client_result",
        "client_fit",
      ]
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
    contacts.map((contact) => ({
      id: contact.id,
      full_name: contact.full_name,
      email: contact.email ?? null,
      business_name: contact.business_name ?? null,
      phone: contact.phone ?? null,
      job_title: contact.job_title ?? null,
      linkedin_url: contact.linkedin_url ?? null,
      type: contact.type ?? "client",
    }))
  );

  const rosterById = new Map(contacts.map((contact) => [contact.id, contact]));

  const clients = enriched.map((row) => {
    const extra = rosterById.get(row.id);
    return {
      ...row,
      photo_url: extra?.photo_url ?? null,
      headline: extra?.headline ?? null,
      client_joined_on: extra?.client_joined_on ?? null,
      client_fee_amount: readFee(extra?.client_fee_amount),
      client_problem_notes: extra?.client_problem_notes ?? null,
      client_sector: extra?.client_sector ?? null,
      client_revenue_band: extra?.client_revenue_band ?? null,
      client_team_size: extra?.client_team_size ?? null,
      client_source: extra?.client_source ?? null,
      client_result: extra?.client_result ?? null,
      client_fit: extra?.client_fit ?? null,
    };
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: authStatus(authCheck.error) }
    );
  }

  const coachId = authCheck.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let fields: ReturnType<typeof parseClientRosterCreate>;
  try {
    fields = parseClientRosterCreate(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const saved = await saveRosterClient(coachId, fields);
    return NextResponse.json(
      { ok: true, contactId: saved.contactId, created: saved.created },
      { status: saved.created ? 201 : 200 }
    );
  } catch (err) {
    if (err instanceof ClientSaveError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("coach/clients POST", err);
    const message = err instanceof Error ? err.message : "Unable to save client.";
    const safe = message.startsWith("Unable") ? message : "Unable to save client.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
