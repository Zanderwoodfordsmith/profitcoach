import { NextResponse } from "next/server";

import {
  PROGRAMME_INTAKE_GOALS,
  PROGRAMME_INTAKE_SITUATIONS,
  PROGRAMME_INTAKE_TIME_COMMITMENTS,
  type ProgrammeIntakeGoal,
} from "@/config/programmeIntake";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly { value: T }[]
): value is T {
  return (
    typeof value === "string" &&
    allowed.some((option) => option.value === value)
  );
}

/**
 * POST — save optional programme intake for the signed-in coach.
 * Partial answers are fine; booking already happened.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
  }

  let body: {
    linkedinUrl?: string | null;
    situation?: string | null;
    goals?: string[] | null;
    goal?: string | null;
    timeCommitment?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const linkedinUrl =
    typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() : "";
  const situation = isOneOf(body.situation, PROGRAMME_INTAKE_SITUATIONS)
    ? body.situation
    : null;
  const timeCommitment = isOneOf(
    body.timeCommitment,
    PROGRAMME_INTAKE_TIME_COMMITMENTS
  )
    ? body.timeCommitment
    : null;

  const rawGoals = Array.isArray(body.goals)
    ? body.goals
    : body.goal
      ? [body.goal]
      : [];
  const goals = rawGoals.filter((value): value is ProgrammeIntakeGoal =>
    isOneOf(value, PROGRAMME_INTAKE_GOALS)
  );

  if (linkedinUrl) {
    await supabaseAdmin
      .from("profiles")
      .update({ linkedin_url: linkedinUrl })
      .eq("id", user.id);
  }

  const intake = {
    linkedin_url: linkedinUrl || null,
    situation,
    goals,
    time_commitment: timeCommitment,
    updated_at: new Date().toISOString(),
  };

  const { error: coachError } = await supabaseAdmin
    .from("coaches")
    .update({ programme_intake: intake })
    .eq("id", user.id);

  if (coachError) {
    console.error("welcome-intake:", coachError);
    return NextResponse.json(
      { error: "Unable to save intake." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
