import { NextResponse } from "next/server";
import {
  findDuplicateContactsFor,
  mergeContacts,
} from "@/lib/contacts/mergeContacts";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  survivorId?: string;
  mergedId?: string;
};

/**
 * Coach (or impersonating admin) via requireCoachRequest.
 * Bare admin: derive coach_id from the contact being acted on.
 */
async function resolveMergeCoachId(
  request: Request,
  contactId: string
): Promise<{ coachId: string } | { error: string; status: number }> {
  const authCheck = await requireCoachRequest(request);
  if (!authCheck.error && authCheck.userId) {
    return { coachId: authCheck.userId };
  }

  if (
    authCheck.error !==
    "Admin must pass x-impersonate-coach-id for this resource."
  ) {
    return {
      error: authCheck.error ?? "Unauthorized",
      status: authCheck.error === "Invalid access token." ? 401 : 403,
    };
  }

  const token = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: "Not authorized.", status: 403 };
  }

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("coach_id")
    .eq("id", contactId)
    .maybeSingle();
  const coachId = (contact?.coach_id as string | null) ?? null;
  if (!coachId) return { error: "Contact not found.", status: 404 };
  return { coachId };
}

/**
 * POST /api/coach/contacts/merge
 * Absorb mergedId into survivorId (same coach). Repoints FKs, deletes loser.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const survivorId = body.survivorId?.trim() || "";
  const mergedId = body.mergedId?.trim() || "";
  if (!survivorId || !mergedId) {
    return NextResponse.json(
      { error: "survivorId and mergedId are required." },
      { status: 400 }
    );
  }

  const resolved = await resolveMergeCoachId(request, survivorId);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  try {
    const result = await mergeContacts({
      coachId: resolved.coachId,
      survivorId,
      mergedId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to merge contacts.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * GET /api/coach/contacts/merge?contactId=…
 * List duplicate candidates sharing phone / email / LinkedIn.
 */
export async function GET(request: Request) {
  const contactId =
    new URL(request.url).searchParams.get("contactId")?.trim() || "";
  if (!contactId) {
    return NextResponse.json(
      { error: "contactId is required." },
      { status: 400 }
    );
  }

  const resolved = await resolveMergeCoachId(request, contactId);
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const duplicates = await findDuplicateContactsFor(
    resolved.coachId,
    contactId
  );
  return NextResponse.json({
    duplicates: duplicates.map((d) => ({
      id: d.id,
      full_name: d.full_name,
      email: d.email,
      phone: d.phone,
      linkedin_url: d.linkedin_url,
      business_name: d.business_name,
      type: d.type ?? null,
      created_at: d.created_at ?? null,
    })),
  });
}
