import { NextResponse } from "next/server";

import { runNudgeScan } from "@/lib/ava/nudges";
import { isCronRequest } from "@/lib/cronAuth";

/** Daily: queue an Ava nudge for every stuck coach, for BCA to approve. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runNudgeScan()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ava nudge scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
