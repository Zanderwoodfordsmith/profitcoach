import { after, NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  cancelBuildJobs,
  latestBuildJob,
  startBuildJob,
  workBuildJob,
} from "@/lib/practiceKnowledge/buildJobs";

/**
 * Writes blueprint sections on the server. POST { keys } starts a job (and
 * replaces any open one); POST { cancel: true } stops it; GET reports progress.
 * The job keeps going after the page closes: this request writes what fits,
 * then the practice-build cron carries on.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ job: await latestBuildJob(check.userId) });
  } catch (err) {
    console.error("practice build-all GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load progress." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { keys?: unknown; cancel?: unknown };
  const coachId = check.userId;
  try {
    if (body.cancel === true) {
      await cancelBuildJobs(coachId);
      return NextResponse.json({ job: await latestBuildJob(coachId) });
    }
    const keys = Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === "string")
      : [];
    const job = await startBuildJob({ coachId, requestedBy: null, keys });
    after(() =>
      workBuildJob(job.id).catch((err) => {
        console.error("practice build-all work:", err instanceof Error ? err.message : "failed");
      })
    );
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    console.error("practice build-all POST:", message);
    return NextResponse.json(
      { error: message === "Nothing to write." ? message : "Could not start writing. Try again." },
      { status: message === "Nothing to write." ? 400 : 500 }
    );
  }
}
