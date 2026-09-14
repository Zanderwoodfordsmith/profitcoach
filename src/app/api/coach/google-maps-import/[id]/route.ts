import { NextResponse } from "next/server";
import {
  googleMapsImportJobPayload,
  loadGoogleMapsImportJob,
  syncGoogleMapsImportJob,
} from "@/lib/googleMaps/importJob";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await ctx.params;
  const job = await loadGoogleMapsImportJob(id?.trim() || "");
  if (!job || job.coach_id !== auth.coachId) {
    return NextResponse.json({ error: "Import not found." }, { status: 404 });
  }

  let next = job;
  if (job.status === "pending" || job.status === "running") {
    try {
      next = await syncGoogleMapsImportJob(job.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sync import.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(googleMapsImportJobPayload(next));
}
