import { NextResponse } from "next/server";
import { chunkArray } from "@/lib/chunkArray";
import { moveProspectsToPool } from "@/lib/pool/moveProspectsToPool";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 1000;

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

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
      { error: `Move up to ${MAX_IDS} prospects at a time.` },
      { status: 400 }
    );
  }

  try {
    const byCoach = new Map<string, string[]>();
    for (const chunk of chunkArray(ids, 80)) {
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select("id, coach_id")
        .in("id", chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (typeof row.id !== "string" || typeof row.coach_id !== "string") continue;
        const list = byCoach.get(row.coach_id) ?? [];
        list.push(row.id);
        byCoach.set(row.coach_id, list);
      }
    }

    const moved: string[] = [];
    for (const [coachId, contactIds] of byCoach) {
      moved.push(...(await moveProspectsToPool({ coachId, contactIds })));
    }
    return NextResponse.json({ moved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to move prospects to Pool.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
