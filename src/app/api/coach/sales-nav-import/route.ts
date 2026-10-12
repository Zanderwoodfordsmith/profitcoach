import { NextResponse } from "next/server";
import { SalesNavImportRejectedError } from "@/lib/salesNavigator/classifySalesNavUrl";
import { listActiveSalesNavImports } from "@/lib/salesNavigator/listActiveImports";
import {
  startSalesNavImport,
  type SalesNavImportRequest,
} from "@/lib/salesNavigator/startImport";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

/** Running imports for this coach, without lead snapshots. */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const imports = await listActiveSalesNavImports(auth.coachId);
    return NextResponse.json({ imports });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load imports.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const rejected = err instanceof SalesNavImportRejectedError;
    const status =
      rejected ||
      /Connect LinkedIn|disconnected|people-search URL|UNIPILE|Give the new list/i.test(
        message
      )
        ? 400
        : 500;
    return NextResponse.json(
      { error: message, support: rejected && err.support },
      { status }
    );
  }
}
