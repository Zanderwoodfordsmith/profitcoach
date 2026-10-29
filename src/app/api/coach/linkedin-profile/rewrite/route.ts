import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadProfileWriterInputs, rewriteProfilePart } from "@/lib/linkedinProfileOptimizer/rewritePart";
import {
  FIELD_LIMITS,
  PROFILE_SECTIONS,
  REWRITE_COOLDOWN_MS,
  type ProfileSectionId,
} from "@/lib/linkedinProfileOptimizer/types";

export const runtime = "nodejs";

function parseSection(value: unknown): ProfileSectionId | null {
  if (typeof value !== "string") return null;
  return (PROFILE_SECTIONS as readonly string[]).includes(value)
    ? (value as ProfileSectionId)
    : null;
}

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request, {
    allowAdminSelf: true,
  });
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  // Writing the profile from the Blueprint is BCA's job; coaches edit by hand.
  if (!authCheck.callerIsAdmin) {
    return NextResponse.json({ error: "Our team writes your profile." }, { status: 403 });
  }

  const coachId = authCheck.userId;
  const body = (await request.json().catch(() => null)) as {
    section?: unknown;
    instruction?: unknown;
    experienceIndex?: unknown;
  } | null;

  const section = parseSection(body?.section);
  if (!section) {
    return NextResponse.json({ error: "Choose a profile section." }, { status: 400 });
  }

  const instruction =
    typeof body?.instruction === "string"
      ? body.instruction.trim().slice(0, FIELD_LIMITS.instruction)
      : "";

  const experienceIndex =
    typeof body?.experienceIndex === "number" &&
    Number.isInteger(body.experienceIndex) &&
    body.experienceIndex >= 0
      ? Math.min(body.experienceIndex, 30)
      : 0;

  // The same inputs Ava writes the profile from: the LinkedIn is imported first when we can find it.
  let inputs: Awaited<ReturnType<typeof loadProfileWriterInputs>>;
  try {
    inputs = await loadProfileWriterInputs(coachId);
  } catch {
    return NextResponse.json(
      { error: "Could not load your LinkedIn profile." },
      { status: 500 }
    );
  }
  const { snapshot } = inputs;
  if (!snapshot) {
    return NextResponse.json(
      { error: "Import your LinkedIn profile first." },
      { status: 404 }
    );
  }

  // Admins writing a coach's profile in one pass fire several sections at once.
  if (inputs.rewrittenAt && !authCheck.callerIsAdmin) {
    const elapsed = Date.now() - Date.parse(inputs.rewrittenAt);
    if (Number.isFinite(elapsed) && elapsed < REWRITE_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((REWRITE_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: "Give the rewrite a moment, then try again.",
          retryAfterSec,
        },
        { status: 429 }
      );
    }
  }

  const variants = await rewriteProfilePart(
    { ...inputs, snapshot },
    { section, instruction: instruction || null, experienceIndex }
  );
  if (variants.length === 0) {
    return NextResponse.json(
      { error: "Could not rewrite that section. Try again." },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const { error: stampError } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .update({ optimizer_rewritten_at: now })
    .eq("coach_id", coachId);

  if (stampError) {
    console.error("linkedin-profile rewrite stamp failed");
  }

  return NextResponse.json({ variants });
}
