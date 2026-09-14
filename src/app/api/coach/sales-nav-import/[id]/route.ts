import { NextResponse } from "next/server";
import {
  loadImportJob,
  syncSalesNavImportJob,
} from "@/lib/salesNavigator/importJob";
import { salesNavImportJobPayload } from "@/lib/salesNavigator/importJobPayload";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Poll a Sales Nav import the signed-in coach owns.
 * Syncs Unipile/Apify while the job is still running.
 */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const job = await loadImportJob(id.trim());
  if (!job || job.coach_id !== auth.coachId) {
    return NextResponse.json({ error: "Import not found." }, { status: 404 });
  }

  let next = job;
  if (job.status === "pending" || job.status === "running") {
    try {
      next = await syncSalesNavImportJob(job.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sync import job.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const includeLeads = new URL(request.url).searchParams.get("leads") === "1";
  return NextResponse.json(
    salesNavImportJobPayload(next, { includeLeads })
  );
}
