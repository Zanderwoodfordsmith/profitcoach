import { NextResponse } from "next/server";
import { loadCoachFunnel, type FunnelCoach } from "@/lib/coachFunnel";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The coach funnel for the coaches on Getting live (they send who, when they joined and if they're live). */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { coaches?: FunnelCoach[] } | null;
  const coaches = (body?.coaches ?? [])
    .filter((c) => c && typeof c.id === "string")
    .slice(0, 500)
    .map((c) => ({ id: c.id, joined_at: typeof c.joined_at === "string" ? c.joined_at : null, live: Boolean(c.live) }));
  try {
    return NextResponse.json({ by_coach: await loadCoachFunnel(coaches) });
  } catch (err) {
    console.error("coach funnel:", err);
    return NextResponse.json({ error: "Could not load the funnel." }, { status: 500 });
  }
}
