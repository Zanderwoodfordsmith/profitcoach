import { NextResponse } from "next/server";
import { loadGettingLive, saveGettingLive, type GettingLiveUpdate } from "@/lib/gettingLive";
import { GETTING_LIVE_STEPS } from "@/lib/gettingLiveSteps";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Coaches → Getting live: every coach we are getting live and the step they are on. ?coach_id= for one coach's tab. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const coachId = new URL(request.url).searchParams.get("coach_id")?.trim() || undefined;
  try {
    return NextResponse.json(await loadGettingLive({ coachId }));
  } catch (err) {
    console.error("getting live:", err);
    return NextResponse.json({ error: "Could not load Getting live." }, { status: 500 });
  }
}

const STEP_KEYS = new Set<string>(GETTING_LIVE_STEPS.map((s) => s.key));

/** Tick a step by hand, change the comment thread, add a coach to the list or take one off. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<GettingLiveUpdate> | null;
  if (!body?.coach_id || typeof body.coach_id !== "string") {
    return NextResponse.json({ error: "Which coach?" }, { status: 400 });
  }
  if (body.tick && (!STEP_KEYS.has(body.tick.step) || typeof body.tick.on !== "boolean")) {
    return NextResponse.json({ error: "That step does not exist." }, { status: 400 });
  }
  const update: GettingLiveUpdate = {
    coach_id: body.coach_id,
    tick: body.tick,
    comments: Array.isArray(body.comments) ? body.comments : undefined,
    hidden: typeof body.hidden === "boolean" ? body.hidden : undefined,
    add: body.add === true,
  };

  try {
    const saved = await saveGettingLive(update, auth.userId);
    if (saved === "no_table") {
      return NextResponse.json({ error: "Ticks can't be saved yet: the database table isn't set up." }, { status: 503 });
    }
    if (saved === "no_comments") {
      return NextResponse.json({ error: "Comments can't be saved yet: the database change for comments isn't applied." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("getting live save:", err);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
