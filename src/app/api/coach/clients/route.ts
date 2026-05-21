import { NextResponse } from "next/server";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { enrichProspectRows } from "@/lib/loadProspectTableRows";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireCoach(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { error: "Missing access token." as const, userId: null };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  const effectiveId =
    profile?.role === "admin" && impersonateId ? impersonateId : user.id;

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: effectiveId as string };
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
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
