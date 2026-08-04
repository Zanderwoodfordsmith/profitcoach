import { NextResponse } from "next/server";

import { getCalendarFeedBaseUrl } from "@/lib/appBaseUrl";
import {
  coachHasFeature,
  resolveCoachAccessForUserId,
} from "@/lib/coachAccess/resolveCoachAccess";
import {
  buildCommunityCalendarFeedUrls,
  ensureCommunityCalendarFeedToken,
  loadCommunityCalendarFeedOccurrencesForUser,
} from "@/lib/communityCalendarFeed";
import {
  buildCommunityCalendarIcs,
  communityCalendarIcsFileName,
  googleCalendarSubscribeUrl,
  isLocalCalendarFeedUrl,
  outlookCalendarSubscribeUrl,
} from "@/lib/communityCalendarIcs";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

async function requireCalendarSubscribeUser(request: Request): Promise<
  | { error: string; status: number; userId: null }
  | { error: null; status: null; userId: string }
> {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) {
    const status =
      auth.error === "Not authorized." ||
      auth.error === "Admin must pass x-impersonate-coach-id for this resource."
        ? 403
        : 401;
    return { error: auth.error, status, userId: null };
  }

  const access = await resolveCoachAccessForUserId(auth.userId);
  if (!coachHasFeature(access, "calendar.momentum_only")) {
    return {
      error: "Feature not available for your access tier.",
      status: 403,
      userId: null,
    };
  }

  return { error: null, status: null, userId: auth.userId };
}

/** JSON with subscribe deep links (+ flags for localhost / empty feeds). */
export async function GET(request: Request) {
  const auth = await requireCalendarSubscribeUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });
  }

  const url = new URL(request.url);
  const wantsDownload =
    url.searchParams.get("download") === "1" ||
    url.searchParams.get("format") === "ics";

  try {
    if (wantsDownload) {
      const { occurrences } =
        await loadCommunityCalendarFeedOccurrencesForUser(auth.userId);
      const ics = buildCommunityCalendarIcs(occurrences);
      const filename = communityCalendarIcsFileName();
      return new NextResponse(ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const token = await ensureCommunityCalendarFeedToken(auth.userId);
    const baseUrl = getCalendarFeedBaseUrl(request);
    const { httpsUrl, webcalUrl } = buildCommunityCalendarFeedUrls(
      token,
      baseUrl
    );
    const { occurrences } =
      await loadCommunityCalendarFeedOccurrencesForUser(auth.userId);
    const isLocal = isLocalCalendarFeedUrl(httpsUrl);

    return NextResponse.json({
      httpsUrl,
      webcalUrl,
      // HTTPS (not webcal) so Google reads X-WR-CALNAME instead of naming by host.
      googleUrl: googleCalendarSubscribeUrl(httpsUrl),
      outlookUrl: outlookCalendarSubscribeUrl(httpsUrl),
      appleUrl: webcalUrl,
      downloadUrl: "/api/coach/community/calendar/subscribe?download=1",
      calendarName: "Profit Coach Calls",
      isLocal,
      eventCount: occurrences.length,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CALENDAR_FEED_TOKEN_MIGRATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error:
            "Calendar subscribe is not available yet. Apply the latest database migration.",
        },
        { status: 503 }
      );
    }
    console.error("community calendar subscribe:", error);
    return NextResponse.json(
      { error: "Could not prepare calendar subscribe link." },
      { status: 500 }
    );
  }
}
