import { NextResponse } from "next/server";
import {
  ensureCoachRowForUser,
  updateCoachCalendar,
} from "@/lib/booking/bookingService";
import type { CoachCalendarPatch } from "@/lib/booking/coachCalendars";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireSelfUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) return { error: "Missing access token." as const, userId: null };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: "Invalid access token." as const, userId: null };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  return { error: null, userId: user.id as string };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSelfUser(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing calendar id." }, { status: 400 });
  }

  let coach: { id: string };
  try {
    coach = await ensureCoachRowForUser(auth.userId);
  } catch {
    return NextResponse.json(
      { error: "Could not set up coach profile." },
      { status: 500 }
    );
  }

  let body: CoachCalendarPatch;
  try {
    body = (await request.json()) as CoachCalendarPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (
    body.location_mode !== undefined &&
    body.location_mode !== "google_meet" &&
    body.location_mode !== "phone" &&
    body.location_mode !== "custom"
  ) {
    return NextResponse.json(
      { error: "Invalid location_mode." },
      { status: 400 }
    );
  }

  try {
    const calendar = await updateCoachCalendar(coach.id, id.trim(), body);
    if (!calendar) {
      return NextResponse.json({ error: "Calendar not found." }, { status: 404 });
    }
    return NextResponse.json({ calendar });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
