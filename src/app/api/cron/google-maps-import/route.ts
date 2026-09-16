import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { syncAllRunningGoogleMapsImportJobs } from "@/lib/googleMaps/importJob";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllRunningGoogleMapsImportJobs(10);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Maps import tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
