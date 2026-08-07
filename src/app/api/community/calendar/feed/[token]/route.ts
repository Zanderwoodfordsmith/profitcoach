import { NextResponse } from "next/server";

import {
  loadCommunityCalendarFeedOccurrencesForUser,
  resolveCommunityCalendarFeedUserId,
} from "@/lib/communityCalendarFeed";
import {
  buildCommunityCalendarIcs,
  communityCalendarIcsFileName,
} from "@/lib/communityCalendarIcs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params;

  try {
    const userId = await resolveCommunityCalendarFeedUserId(rawToken);
    if (!userId) {
      return new NextResponse("Calendar feed not found.", { status: 404 });
    }

    const { occurrences } =
      await loadCommunityCalendarFeedOccurrencesForUser(userId);
    const ics = buildCommunityCalendarIcs(occurrences);
    const filename = communityCalendarIcsFileName();

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CALENDAR_FEED_TOKEN_MIGRATION_REQUIRED"
    ) {
      return new NextResponse("Calendar feed is not available yet.", {
        status: 503,
      });
    }
    console.error("community calendar feed:", error);
    return new NextResponse("Could not load calendar feed.", { status: 500 });
  }
}
