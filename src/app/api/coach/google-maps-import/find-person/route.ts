import { NextResponse } from "next/server";
import { ensureCoachPool, isLeadListUuid } from "@/lib/leadLists/audienceLists";
import { createGoogleMapsFindPersonJob } from "@/lib/googleMaps/importJob";
import { GOOGLE_MAPS_FIND_PERSON_MAX } from "@/lib/googleMaps/cost";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    item_ids?: unknown;
  };
  const itemIds = Array.isArray(body.item_ids)
    ? body.item_ids.filter(
        (value): value is string =>
          typeof value === "string" && isLeadListUuid(value)
      )
    : [];
  if (!itemIds.length) {
    return NextResponse.json(
      { error: "Select businesses to find people for." },
      { status: 400 }
    );
  }

  try {
    const pool = await ensureCoachPool(auth.coachId);
    const job = await createGoogleMapsFindPersonJob({
      coachId: auth.coachId,
      listId: pool.id,
      itemIds: itemIds.slice(0, GOOGLE_MAPS_FIND_PERSON_MAX),
    });
    return NextResponse.json({
      jobId: job.jobId,
      status: "running" as const,
      targetCount: job.targetCount,
      estimatedCostUsd: job.estimatedCostUsd,
      progressCount: 0,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Find person failed.";
    const status = /already running|Select |LinkedIn campaigns|APIFY_TOKEN/i.test(
      message
    )
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
