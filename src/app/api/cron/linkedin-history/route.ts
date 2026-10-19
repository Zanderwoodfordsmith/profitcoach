import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { coachesDueForHistoryImport, importLinkedInHistory } from "@/lib/linkedinHistory/importHistory";
import { requireAdmin } from "@/lib/requireAdmin";

export const maxDuration = 300;

/**
 * Refresh coaches' LinkedIn history once a day, a few coaches per run so each
 * account is read gently. Auth: Vercel cron / CRON_SECRET, or an admin session.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    const admin = await requireAdmin(request);
    if (admin.error) return NextResponse.json({ error: admin.error }, { status: 401 });
  }
  const due = await coachesDueForHistoryImport(24, 3);
  const results: Array<{ coach_id: string; ok: boolean; detail: unknown }> = [];
  const started = Date.now();
  for (const coachId of due) {
    // A first import walks a whole history; leave room inside maxDuration.
    if (Date.now() - started > 150_000) break;
    const result = await importLinkedInHistory(coachId, { maxBodies: 10 });
    results.push({ coach_id: coachId, ok: result.ok, detail: result });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
