import { NextResponse } from "next/server";

import { chainState, toCheckItems, type ChainState } from "@/lib/launch/avaAuto";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/** Everything Ava has waiting for BCA, across coaches, oldest first, with each coach's launch chain (Launches → To check). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.error === "Server error." ? 500 : 401 });
  // ?coach=<id> (the coach page's Ava tab): that coach only, with their chain even when nothing waits.
  const only = new URL(request.url).searchParams.get("coach");
  try {
    const items = (await toCheckItems()).filter((i) => !only || i.coach_id === only);
    const coachIds = only ? [only] : [...new Set(items.map((i) => i.coach_id))];
    const chains: Record<string, ChainState[]> = {};
    await Promise.all(
      coachIds.map(async (id) => {
        chains[id] = await chainState(id).catch(() => []);
      })
    );
    return NextResponse.json({ items, chains });
  } catch (err) {
    console.error("to check:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load what's waiting." }, { status: 500 });
  }
}
