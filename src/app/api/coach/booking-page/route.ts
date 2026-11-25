import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import {
  loadCoachBySlug,
  loadCoachCalendarBySlug,
  updateCoachCalendar,
} from "@/lib/booking/bookingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * A coach's booking page (/book/[slug]/[calendar]), edited in place.
 * The coach edits their own page; admins may edit any coach's page.
 */
async function editorFor(request: Request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const calendarSlug = (url.searchParams.get("calendar") ?? "").trim().toLowerCase();

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Sign in to edit this page.", status: 401 } as const;
  const user = await verifyAccessToken(token);
  if (!user) return { error: "Sign in to edit this page.", status: 401 } as const;

  const coach = slug ? await loadCoachBySlug(slug) : null;
  const calendar = coach ? await loadCoachCalendarBySlug(coach.id, calendarSlug) : null;
  if (!coach || !calendar) return { error: "Page not found.", status: 404 } as const;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (coach.id !== user.id && !isAdmin) {
    return { error: "You can only edit your own page.", status: 403 } as const;
  }
  return { coach, calendar, actingAsAdmin: coach.id !== user.id } as const;
}

export async function GET(request: Request) {
  const ed = await editorFor(request);
  if ("error" in ed) return NextResponse.json({ error: ed.error }, { status: ed.status });
  return NextResponse.json({ coachId: ed.coach.id, actingAsAdmin: ed.actingAsAdmin });
}

const LENGTHS = new Set([15, 20, 30, 45, 60, 90]);

type Body = {
  name?: unknown;
  description?: unknown;
  meeting_duration_minutes?: unknown;
  directory_summary?: unknown;
  coach_business_name?: unknown;
  hidden?: unknown;
};

export async function PATCH(request: Request) {
  const ed = await editorFor(request);
  if ("error" in ed) return NextResponse.json({ error: ed.error }, { status: ed.status });
  const body = (await request.json().catch(() => ({}))) as Body;

  // The call itself: name, line, length.
  const patch: { name?: string; description?: string | null; meeting_duration_minutes?: number } =
    {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.description === "string") {
    patch.description = body.description.trim().slice(0, 400) || null;
  }
  if (typeof body.meeting_duration_minutes === "number") {
    if (!LENGTHS.has(body.meeting_duration_minutes)) {
      return NextResponse.json({ error: "Pick a call length from the list." }, { status: 400 });
    }
    patch.meeting_duration_minutes = body.meeting_duration_minutes;
  }
  if (Object.keys(patch).length) {
    const saved = await updateCoachCalendar(ed.coach.id, ed.calendar.id, patch);
    if (!saved) return NextResponse.json({ error: "That did not save. Try again." }, { status: 500 });
  }

  // Who they help: the same line as the directory page.
  if (typeof body.directory_summary === "string") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ directory_summary: body.directory_summary.trim().slice(0, 220) || null })
      .eq("id", ed.coach.id);
    if (error) return NextResponse.json({ error: "That did not save. Try again." }, { status: 500 });
  }

  // The name owners see (also on the directory page and booking emails).
  if (typeof body.coach_business_name === "string" && body.coach_business_name.trim()) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ coach_business_name: body.coach_business_name.trim().slice(0, 100) })
      .eq("id", ed.coach.id);
    if (error) return NextResponse.json({ error: "That did not save. Try again." }, { status: 500 });
  }

  // Which ways to reach the coach are shown.
  if (body.hidden && typeof body.hidden === "object") {
    const raw = body.hidden as Record<string, unknown>;
    const hidden = {
      phone: raw.phone === true,
      email: raw.email === true,
      whatsapp: raw.whatsapp === true,
    };
    const { data: row } = await supabaseAdmin
      .from("coach_calendars")
      .select("page")
      .eq("id", ed.calendar.id)
      .maybeSingle();
    const page = { ...((row?.page as Record<string, unknown> | null) ?? {}), hidden };
    const { error } = await supabaseAdmin
      .from("coach_calendars")
      .update({ page })
      .eq("id", ed.calendar.id)
      .eq("coach_id", ed.coach.id);
    if (error) return NextResponse.json({ error: "That did not save. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
