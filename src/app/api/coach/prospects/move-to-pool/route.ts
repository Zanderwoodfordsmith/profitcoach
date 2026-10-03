import { NextResponse } from "next/server";
import { moveProspectsToPool } from "@/lib/pool/moveProspectsToPool";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 1000;

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
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
    const moved = await moveProspectsToPool({
      coachId: authCheck.userId,
      contactIds: ids,
    });
    return NextResponse.json({ moved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to move prospects to Pool.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
