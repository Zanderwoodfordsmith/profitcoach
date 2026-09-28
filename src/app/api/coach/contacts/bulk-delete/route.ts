import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 2000;
/** Keeps the PostgREST `in.(…)` filter well under URL limits. */
const CHUNK = 100;

/** Delete many of this coach's prospects. Clients and other coaches' rows are skipped. */
export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }
  const coachId = authCheck.userId;

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
  } | null;
  const ids = [
    ...new Set(
      (Array.isArray(body?.ids) ? body.ids : []).filter(
        (id): id is string => typeof id === "string" && UUID_RE.test(id)
      )
    ),
  ];
  if (!ids.length) {
    return NextResponse.json({ error: "No prospects selected." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Delete up to ${MAX_IDS} prospects at a time.` },
      { status: 400 }
    );
  }

  const deleted: string[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("coach_id", coachId)
      .eq("type", "prospect")
      .in("id", chunk)
      .select("id");
    if (error) {
      console.error("coach/contacts/bulk-delete:", error);
      return NextResponse.json(
        {
          error: "Unable to delete prospects.",
          deleted,
        },
        { status: 500 }
      );
    }
    for (const row of data ?? []) deleted.push(row.id as string);
  }

  return NextResponse.json({
    ok: true,
    deleted,
    skipped: ids.length - deleted.length,
  });
}
