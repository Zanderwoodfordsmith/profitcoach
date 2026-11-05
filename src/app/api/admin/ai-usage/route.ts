import { NextResponse } from "next/server";

import { aiUsageThisMonth } from "@/lib/ai/usageLog";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";

/** Card 177: each coach's Ava and Create hub use this month (chats, cost), for Coaches → Projects. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }
  try {
    return NextResponse.json({ usage: await aiUsageThisMonth() });
  } catch (err) {
    console.error("ai usage:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load AI usage." }, { status: 500 });
  }
}
