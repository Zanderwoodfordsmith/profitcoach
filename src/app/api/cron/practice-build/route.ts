import { NextResponse } from "next/server";

import { isCronRequest } from "@/lib/cronAuth";
import { workOpenBuildJobs } from "@/lib/practiceKnowledge/buildJobs";

/** Every minute: keep writing blueprints that the page started. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await workOpenBuildJobs()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Practice build tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
