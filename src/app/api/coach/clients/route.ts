import { NextResponse } from "next/server";
import {
  clientRosterToContactPatch,
  parseClientRosterCreate,
} from "@/lib/clientRoster/fields";
import { tryUpdateContactStripping } from "@/lib/contactSchemaSafeInsert";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import {
  fetchAllSupabasePages,
  selectContactsWithOptionalPhone,
} from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { splitFullName } from "@/lib/splitFullName";
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
    if (fields.linkedinUrl) {
      const { data: hit, error: hitError } = await supabaseAdmin
        .from("contacts")
        .select("id, type")
        .eq("coach_id", coachId)
        .eq("linkedin_url", fields.linkedinUrl)
        .maybeSingle();
      if (
        hitError &&
        hitError.code !== "PGRST116" &&
        hitError.code !== "42703" &&
        hitError.code !== "PGRST204"
      ) {
        throw new Error("Unable to look up that LinkedIn profile.");
      }
      if (hit?.type === "prospect") {
        return NextResponse.json(
          {
            error:
              "This LinkedIn profile is already a prospect. Convert them from Prospects when they become a client.",
          },
          { status: 409 }
        );
      }
    }

    const { first_name, last_name } = splitFullName(fields.fullName);
    const resolved = await resolveOrCreateContact({
      coachId,
      fullName: fields.fullName,
      firstName: first_name,
      lastName: last_name,
      businessName: fields.businessName,
      linkedinUrl: fields.linkedinUrl,
      type: "client",
    });

    const { data: row, error: rowError } = await supabaseAdmin
      .from("contacts")
      .select("id, type, coach_id")
      .eq("id", resolved.contactId)
      .maybeSingle();
    if (rowError || !row || row.coach_id !== coachId) {
      throw new Error("Unable to save client.");
    }
    if (row.type === "prospect") {
      return NextResponse.json(
        {
          error:
            "This person is already a prospect. Convert them from Prospects when they become a client.",
        },
        { status: 409 }
      );
    }

    const dbPatch = clientRosterToContactPatch(fields);
    dbPatch.type = "client";
    if (!resolved.created) {
      if (!fields.businessName) delete dbPatch.business_name;
      if (!fields.joinedOn) delete dbPatch.client_joined_on;
      if (fields.feeAmount == null) delete dbPatch.client_fee_amount;
      if (!fields.problemNotes) delete dbPatch.client_problem_notes;
      if (!fields.linkedinUrl) delete dbPatch.linkedin_url;
    }

    const saved = await tryUpdateContactStripping(resolved.contactId, dbPatch);
    if (saved.error || !saved.data?.id) {
      console.error("coach/clients POST", saved.error);
      throw new Error("Unable to save client.");
    }

    return NextResponse.json(
      { ok: true, contactId: resolved.contactId, created: resolved.created },
      { status: resolved.created ? 201 : 200 }
    );
  } catch (err) {
    console.error("coach/clients POST", err);
    const message = err instanceof Error ? err.message : "Unable to save client.";
    const safe = message.startsWith("Unable") ? message : "Unable to save client.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
