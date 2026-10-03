import { NextResponse } from "next/server";
import {
  planGoogleSearchImport,
  startGoogleSearchImport,
} from "@/lib/googleSearch/startImport";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    searchTerm?: string;
    searchTerms?: string[];
    location?: string;
    city?: string;
    countryCode?: string;
    countryName?: string;
    stateCode?: string;
    maxResults?: number;
    maxPlaces?: number;
    saveListName?: string;
  };

  const plan = planGoogleSearchImport({
    searchTerm: body.searchTerm,
    searchTerms: body.searchTerms,
    city: body.city,
    countryCode: body.countryCode,
    countryName: body.countryName,
    stateCode: body.stateCode,
    location: body.location,
    maxResults: body.maxResults ?? body.maxPlaces,
    saveListName: body.saveListName,
  });
  if ("error" in plan) {
    return NextResponse.json({ error: plan.error }, { status: 400 });
  }

  try {
    const started = await startGoogleSearchImport(auth.coachId, plan);
    return NextResponse.json({
      jobId: started.jobId,
      status: "running" as const,
      targetCount: started.targetCount,
      estimatedCostUsd: started.estimatedCostUsd,
      progressCount: 0,
      saveListId: started.saveListId,
      saveListName: started.saveListName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Search import failed.";
    const status = /already running|Enter a |APIFY_TOKEN|Give the new list/i.test(
      message
    )
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
