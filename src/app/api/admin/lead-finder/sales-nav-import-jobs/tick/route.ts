import { NextResponse } from "next/server";
import { syncAllRunningSalesNavImportJobs } from "@/lib/salesNavigator/importJob";

export const maxDuration = 300;

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return !!bearer && secrets.includes(bearer);
}

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
