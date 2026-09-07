import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  loadActivityHeatmap,
  parseActivityDays,
} from "@/lib/unipile/activityHeatmap";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseActivityDays(searchParams.get("days"));

  try {
    const activity = await loadActivityHeatmap(auth.coachId, days);
    return NextResponse.json(activity);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load activity.",
      },
      { status: 500 }
    );
  }
}
