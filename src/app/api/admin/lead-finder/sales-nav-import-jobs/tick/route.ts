import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { syncAllRunningSalesNavImportJobs } from "@/lib/salesNavigator/importJob";

export const maxDuration = 300;

/** Finalize / progress-sync background Sales Nav imports (Apify .start()). */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllRunningSalesNavImportJobs(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Import job tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
