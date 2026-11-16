import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { continueListImports } from "@/lib/launch/avaAuto";
import { syncAllRunningSalesNavImportJobs } from "@/lib/salesNavigator/importJob";

export const maxDuration = 300;

/** Finalize / progress-sync background Sales Nav imports (Apify .start()). */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllRunningSalesNavImportJobs(20);
    // Ava's plans import one list at a time: start the next once the last has finished.
    const nextLists = await continueListImports().catch(() => 0);
    return NextResponse.json({ ok: true, ...result, nextLists });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Import job tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
