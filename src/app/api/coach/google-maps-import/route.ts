import { NextResponse } from "next/server";
import {
  createCoachAudienceList,
  defaultPoolImportListName,
  ensureCoachPool,
  MAX_LIST_ITEMS_TOTAL,
} from "@/lib/leadLists/audienceLists";
import { createGoogleMapsSearchJob } from "@/lib/googleMaps/importJob";
import { clampGoogleMapsMaxPlaces } from "@/lib/googleMaps/cost";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    searchTerm?: string;
    location?: string;
    maxPlaces?: number;
    saveListName?: string;
  };

  const searchTerm = body.searchTerm?.trim() || "";
  const location = body.location?.trim() || "";
  if (searchTerm.length < 2 || searchTerm.length > 120) {
    return NextResponse.json(
      { error: "Enter a search like plumbers or dental practices." },
      { status: 400 }
    );
  }
  if (location.length < 2 || location.length > 120) {
    return NextResponse.json(
      { error: "Enter a city or area, for example Manchester, UK." },
      { status: 400 }
    );
  }

  try {
    const pool = await ensureCoachPool(auth.coachId);
    const maxPlaces = clampGoogleMapsMaxPlaces(body.maxPlaces);
    const saveListName =
      body.saveListName?.trim() ||
      `${defaultPoolImportListName("google_maps")} · ${searchTerm}`;
    const saveList = await createCoachAudienceList({
      coachId: auth.coachId,
      name: saveListName.slice(0, 120),
      source: "google_maps",
      filters: {
        from_pool_import: true,
        search_term: searchTerm,
        location,
        max_places: maxPlaces,
        list_cap: MAX_LIST_ITEMS_TOTAL,
      },
    });
    const job = await createGoogleMapsSearchJob({
      coachId: auth.coachId,
      listId: pool.id,
      saveListId: saveList.id,
      searchTerm,
      location,
      maxPlaces,
      findPeople: true,
    });
    return NextResponse.json({
      jobId: job.jobId,
      status: "running" as const,
      targetCount: job.targetCount,
      estimatedCostUsd: job.estimatedCostUsd,
      progressCount: 0,
      saveListId: saveList.id,
      saveListName: saveList.name,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Google Maps import failed.";
    const status = /already running|Enter a |APIFY_TOKEN|Give the new list/i.test(
      message
    )
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
