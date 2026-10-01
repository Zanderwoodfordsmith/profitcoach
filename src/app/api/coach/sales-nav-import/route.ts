import { NextResponse } from "next/server";
import {
  startSalesNavImport,
  type SalesNavImportRequest,
} from "@/lib/salesNavigator/startImport";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

/**
 * Start a Unipile Sales Nav import into the coach pool.
 * Always creates a named audience list tab for the import batch.
 */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SalesNavImportRequest;

  try {
    const { job, poolId, saveList } = await startSalesNavImport(
      auth.coachId,
      body
    );
    return NextResponse.json({
      jobId: job.jobId,
      status: "running" as const,
      provider: "unipile" as const,
      takePages: job.takePages,
      requestedTakePages: job.requestedTakePages,
      targetCount: job.targetCount,
      progressCount: 0,
      estimatedCostUsd: 0,
      segmented: job.segmented,
      segmentTotal: job.segmentTotal,
      segmentLabels: job.segmentLabels,
      listId: poolId,
      saveListId: saveList.id,
      saveListName: saveList.name,
      async: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sales Navigator import failed.";
    const status =
      /Connect LinkedIn|disconnected|people-search URL|UNIPILE|Give the new list/i.test(
        message
      )
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
