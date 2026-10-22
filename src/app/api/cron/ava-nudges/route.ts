import { NextResponse } from "next/server";

import { postApprovedNudges, runNudgeScan } from "@/lib/ava/nudges";
import { isCronRequest } from "@/lib/cronAuth";

/** Hourly: post approved nudges. At 06:00 UTC also queue a nudge for every stuck coach. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const scan = new Date().getUTCHours() === 6 ? await runNudgeScan() : null;
    return NextResponse.json({ ok: true, scan, post: await postApprovedNudges() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ava nudge scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
