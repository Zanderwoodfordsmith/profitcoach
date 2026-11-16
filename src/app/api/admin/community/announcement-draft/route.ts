import Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { addUsage, emptyTally, logAiUsage } from "@/lib/ai/usageLog";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropicModel";
import {
  ANNOUNCEMENT_WRITER_MAX_TOKENS,
  composeAnnouncementSystem,
  composeAnnouncementUserMessage,
  parseAnnouncementDraft,
  type UpcomingCall,
} from "@/lib/community/announcementWriter";
import {
  COMMUNITY_CALENDAR_EVENT_SELECT,
  COMMUNITY_CALENDAR_EXCEPTION_SELECT,
} from "@/lib/communityCalendarData";
import { expandCommunityCalendar } from "@/lib/communityCalendarExpand";
import type {
  CommunityCalendarEventExceptionRow,
  CommunityCalendarEventRow,
} from "@/lib/communityCalendarTypes";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { note, authorId? } → { title, body }
 * Admin only. Draft-only: the text goes into the post box for the admin to
 * edit and post.
 */
async function upcomingCalls(): Promise<UpcomingCall[]> {
  const [eventsRes, exceptionsRes] = await Promise.all([
    supabaseAdmin
      .from("community_calendar_events")
      .select(COMMUNITY_CALENDAR_EVENT_SELECT),
    supabaseAdmin
      .from("community_calendar_event_exceptions")
      .select(COMMUNITY_CALENDAR_EXCEPTION_SELECT),
  ]);
  if (eventsRes.error || exceptionsRes.error) return [];
  const now = DateTime.now();
  return expandCommunityCalendar(
    (eventsRes.data ?? []) as CommunityCalendarEventRow[],
    now,
    now.plus({ days: 7 }),
    (exceptionsRes.data ?? []) as CommunityCalendarEventExceptionRow[]
  )
    .filter((o) => !o.isCancelled && Date.parse(o.endsAtIso) > Date.now())
    .sort((a, b) => Date.parse(a.startsAtIso) - Date.parse(b.startsAtIso))
    .slice(0, 8)
    .map((o) => ({ title: o.title, startsAtIso: o.startsAtIso }));
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (!consumeReplyCopilotRateLimit(`announcement:${auth.userId}`)) {
    return NextResponse.json(
      { error: "Too many drafts. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    note?: unknown;
    authorId?: unknown;
  };
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) {
    return NextResponse.json(
      { error: "Type a rough note first." },
      { status: 400 }
    );
  }
  const senderId =
    typeof body.authorId === "string" && body.authorId.trim()
      ? body.authorId.trim()
      : auth.userId;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Ava drafts are not set up on this server." },
      { status: 503 }
    );
  }

  const [senderRes, overrides, upcoming] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name")
      .eq("id", senderId)
      .maybeSingle(),
    loadBrandKnowledgeOverrides(),
    upcomingCalls(),
  ]);
  const senderName =
    (senderRes.data?.first_name as string | null)?.trim() ||
    (senderRes.data?.full_name as string | null)?.trim() ||
    null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: ANNOUNCEMENT_WRITER_MAX_TOKENS,
      system: composeAnnouncementSystem(overrides),
      messages: [
        {
          role: "user",
          content: composeAnnouncementUserMessage({ note, senderName, upcoming }),
        },
      ],
    });
    const tally = emptyTally();
    addUsage(tally, DEFAULT_ANTHROPIC_MODEL, response.usage);
    await logAiUsage({
      surface: "ava",
      mode: "admin",
      actorUserId: auth.userId,
      coachId: null,
      chatId: null,
      skills: ["announcement-writer"],
      model: DEFAULT_ANTHROPIC_MODEL,
      tally,
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const draft = parseAnnouncementDraft(text);
    if (!draft) {
      return NextResponse.json(
        { error: "Ava couldn't write that one. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(draft);
  } catch (err) {
    console.error(
      "announcement-draft:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "Ava couldn't write that one. Try again." },
      { status: 502 }
    );
  }
}
