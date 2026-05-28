import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  qualifyingToWebhookFields,
  type ScorecardAnswers,
} from "@/lib/bossScorecardScores";
import { buildBossScorecardGhlCustomFields } from "@/lib/ghlLeadWebhookCustomFields";
import type { QualifyingData } from "@/lib/bossScorecardQuestions";
import {
  tryInsertContactStripping,
  tryUpdateContactStripping,
} from "@/lib/contactSchemaSafeInsert";
import {
  fireLeadWebhook,
  getCoachLeadWebhookUrl,
  resolveLeadWebhookStatus,
  type AssessmentType,
} from "@/lib/leadWebhook";
import { splitFullName } from "@/lib/splitFullName";
import {
  ensurePrimaryCoachRow,
  primaryCoachSetupErrorMessage,
  resolvePrimaryCoachSlug,
} from "@/lib/primaryCoach";
import { resolveLandingEventTestId } from "@/lib/landingEvergreenTest";
import { buildScorecardReportUrl } from "@/lib/scorecardReportLink";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachSlug?: string;
  from_landing?: "a" | "b" | "c" | "d";
  /** Analytics only: explicit coach from landing URL; omit when brand /score. */
  landing_coach_slug?: string | null;
  landing_brand?: boolean;
  assessment_type?: AssessmentType;
  contact: {
    full_name?: string;
    email?: string;
    business_name?: string;
    phone?: string;
  };
  answers: Record<string, number>;
  total_score: number;
  methodology_version?: number;
  boss_level?: string;
  qualifying_data?: Record<string, unknown>;
  open_text?: string | null;
  last_screen_reached?: number;
};

const CENTRAL_SLUG = "BCA";
const CENTRAL_SLUG_LOWER = CENTRAL_SLUG.toLowerCase();

async function provisionCentralCoachIfMissing(): Promise<{ id: string } | null> {
  if (process.env.AUTO_PROVISION_CENTRAL_COACH === "false") {
    return null;
  }

  const { data: existing } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", CENTRAL_SLUG_LOWER)
    .maybeSingle();
  if (existing?.id) return { id: existing.id as string };

  const email =
    process.env.CENTRAL_COACH_SYSTEM_EMAIL?.trim() ||
    "central-marketing-coach@profitcoach.internal";

  const password = `${randomUUID()}Aa1!`;
  const fullName = "Central (BCA)";
  const { first_name, last_name } = splitFullName(fullName);

  const {
    data: authData,
    error: authError,
  } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { profit_coach_central_placeholder: true },
  });

  if (authError || !authData?.user) {
    const { data: raced } = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("slug", CENTRAL_SLUG_LOWER)
      .maybeSingle();
    if (raced?.id) return { id: raced.id as string };
    console.error("Central coach provision (auth):", authError);
    return null;
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    role: "coach",
    full_name: fullName,
    first_name,
    last_name,
    coach_business_name: "Profit Coach Central",
  });

  if (profileError) {
    console.error("Central coach provision (profile):", profileError);
    return null;
  }

  const { error: coachInsertError } = await supabaseAdmin
    .from("coaches")
    .insert({ id: userId, slug: CENTRAL_SLUG_LOWER });

  if (coachInsertError) {
    const { data: raced } = await supabaseAdmin
      .from("coaches")
      .select("id")
      .eq("slug", CENTRAL_SLUG_LOWER)
      .maybeSingle();
    if (raced?.id) return { id: raced.id as string };
    console.error("Central coach provision (coaches):", coachInsertError);
    return null;
  }

  return { id: userId };
}

const GENERAL_SCORE_SLUGS = new Set([CENTRAL_SLUG_LOWER, "bca"]);

async function lookupCoachBySlug(
  slug: string
): Promise<{ id: string } | null> {
  const { data: coach, error } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("assessments coach lookup:", error);
    throw error;
  }

  return coach?.id ? { id: coach.id as string } : null;
}

/** Resolves coach for scorecard: primary coach for general/BCA/missing/invalid slugs. */
async function resolveCoachForAssessment(
  coachSlugInput?: string
): Promise<{ coachId: string; coachSlug: string } | NextResponse> {
  const primarySlug = await resolvePrimaryCoachSlug();
  let coachSlug =
    typeof coachSlugInput === "string" && coachSlugInput.trim()
      ? coachSlugInput.trim().toLowerCase()
      : primarySlug;

  if (GENERAL_SCORE_SLUGS.has(coachSlug)) {
    coachSlug = primarySlug;
  }

  let coach: { id: string } | null = null;

  try {
    coach = await lookupCoachBySlug(coachSlug);
  } catch {
    return NextResponse.json(
      { error: "Unable to look up coach." },
      { status: 500 }
    );
  }

  if (!coach && coachSlug === CENTRAL_SLUG_LOWER) {
    coach = await provisionCentralCoachIfMissing();
  }

  if (!coach && coachSlug !== primarySlug) {
    try {
      coach = await lookupCoachBySlug(primarySlug);
      if (coach) coachSlug = primarySlug;
    } catch {
      return NextResponse.json(
        { error: "Unable to look up coach." },
        { status: 500 }
      );
    }
  }

  if (!coach && coachSlug === primarySlug) {
    coach = await ensurePrimaryCoachRow();
  }

  if (!coach) {
    return NextResponse.json(
      {
        error:
          coachSlug === CENTRAL_SLUG_LOWER || coachSlug === primarySlug
            ? primaryCoachSetupErrorMessage()
            : "Coach not found for this link.",
      },
      { status: 400 }
    );
  }

  return { coachId: coach.id, coachSlug };
}

async function patchExistingContactFields(
  contactId: string,
  existing: { full_name?: string | null; business_name?: string | null },
  fullName: string,
  businessName: string | null,
  phone: string | null
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (
    fullName &&
    (existing.full_name == null || existing.full_name === "Unknown")
  ) {
    patch.full_name = fullName;
  }
  if (phone) patch.phone = phone;
  if (businessName && !existing.business_name) {
    patch.business_name = businessName;
  }
  if (Object.keys(patch).length > 0) {
    await tryUpdateContactStripping(contactId, patch);
  }
}

async function resolveOrCreateContact(
  coachId: string,
  fullName: string,
  email: string | null,
  businessName: string | null,
  phone: string | null
): Promise<{ contactId: string | null; error?: NextResponse }> {
  let contactId: string | null = null;
  let existingContact: {
    id: string;
    full_name?: string | null;
    business_name?: string | null;
  } | null = null;

  if (email) {
    const { data: existing, error: contactLookupError } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, business_name")
      .eq("coach_id", coachId)
      .eq("email", email)
      .maybeSingle();

    if (!contactLookupError && existing) {
      contactId = existing.id as string;
      existingContact = existing as {
        id: string;
        full_name?: string | null;
        business_name?: string | null;
      };
    } else if (contactLookupError) {
      console.error("assessments contact lookup:", contactLookupError);
    }
  }

  if (contactId && existingContact) {
    await patchExistingContactFields(
      contactId,
      existingContact,
      fullName,
      businessName,
      phone
    );
    return { contactId };
  }

  const baseInsert: Record<string, unknown> = {
    coach_id: coachId,
    type: "prospect",
    full_name: fullName,
    email,
    business_name: businessName,
    phone,
  };
  const { first_name, last_name } = splitFullName(fullName);
  if (first_name) baseInsert.first_name = first_name;
  if (last_name) baseInsert.last_name = last_name;

  let { data: inserted, error: insertError } =
    await tryInsertContactStripping(baseInsert);

  if (insertError || !inserted) {
    if (insertError?.code === "23505" && email) {
      const { data: raced, error: racedLookupError } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("coach_id", coachId)
        .eq("email", email)
        .maybeSingle();
      if (!racedLookupError && raced?.id) {
        const racedId = raced.id as string;
        await patchExistingContactFields(
          racedId,
          {},
          fullName,
          businessName,
          phone
        );
        return { contactId: racedId };
      }
      return {
        contactId: null,
        error: NextResponse.json(
          { error: "Failed to create contact" },
          { status: 500 }
        ),
      };
    }
    if (insertError?.code === "23502") {
      const placeholderEmail = email
        ? email
        : `unknown+${randomUUID()}@noemail.local`;
      const { data: insertedWithPlaceholder, error: placeholderError } =
        await tryInsertContactStripping({
          ...baseInsert,
          email: placeholderEmail,
        });
      if (!placeholderError && insertedWithPlaceholder?.id) {
        return { contactId: insertedWithPlaceholder.id as string };
      }
    }
    return {
      contactId: null,
      error: NextResponse.json(
        { error: "Failed to create contact", detail: insertError?.message },
        { status: 500 }
      ),
    };
  }

  return { contactId: inserted.id as string };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const coachResolved = await resolveCoachForAssessment(body.coachSlug);
  if (coachResolved instanceof NextResponse) return coachResolved;
  const { coachId, coachSlug } = coachResolved;

  const assessmentType: AssessmentType =
    body.assessment_type === "boss_scorecard"
      ? "boss_scorecard"
      : "diagnostic_50";

  if (
    typeof body.total_score !== "number" ||
    body.total_score < 0 ||
    body.total_score > 100
  ) {
    return NextResponse.json(
      { error: "Invalid total_score" },
      { status: 400 }
    );
  }

  const fullName = body.contact?.full_name?.trim() || "Unknown";
  const email = body.contact?.email?.trim().toLowerCase() || null;
  const businessName = body.contact?.business_name?.trim() || null;
  const phone = body.contact?.phone?.trim() || null;

  const contactResult = await resolveOrCreateContact(
    coachId,
    fullName,
    email,
    businessName,
    phone
  );
  if (contactResult.error) return contactResult.error;
  const contactId = contactResult.contactId;

  const assessmentInsert: Record<string, unknown> = {
    coach_id: coachId,
    contact_id: contactId,
    source: "prospect_link",
    total_score: body.total_score,
    answers: body.answers,
    assessment_type: assessmentType,
    methodology_version:
      assessmentType === "diagnostic_50"
        ? (body.methodology_version ?? 2)
        : 2,
  };

  if (assessmentType === "boss_scorecard") {
    assessmentInsert.qualifying_data = body.qualifying_data ?? null;
    assessmentInsert.open_text = body.open_text ?? null;
    assessmentInsert.boss_level = body.boss_level ?? null;
    assessmentInsert.last_screen_reached = body.last_screen_reached ?? 16;
    assessmentInsert.report_token = randomUUID();
  }

  const { data: assessment, error: assessmentError } = await supabaseAdmin
    .from("assessments")
    .insert(assessmentInsert)
    .select("id, completed_at, report_token")
    .single();

  if (assessmentError || !assessment) {
    console.error("assessments insert:", assessmentError);
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 }
    );
  }

  const fromLanding =
    body.from_landing === "a" ||
    body.from_landing === "b" ||
    body.from_landing === "c" ||
    body.from_landing === "d"
      ? body.from_landing
      : null;

  if (fromLanding) {
    const testId = await resolveLandingEventTestId();
    const landingTrackCoachSlug = body.landing_brand
      ? null
      : typeof body.landing_coach_slug === "string"
        ? body.landing_coach_slug.trim() || null
        : coachSlug;
    const finishRow: Record<string, unknown> = {
      variant: fromLanding,
      coach_slug: landingTrackCoachSlug,
      event_type: "finish",
      contact_id: contactId,
      assessment_id: assessment.id,
    };
    if (testId) finishRow.test_id = testId;
    const { error: finishError } = await supabaseAdmin
      .from("landing_events")
      .insert(finishRow);
    if (finishError) {
      console.error("landing finish insert failed:", finishError.message, {
        variant: fromLanding,
        code: finishError.code,
      });
    }
  }

  const reportToken =
    assessmentType === "boss_scorecard"
      ? ((assessment as { report_token?: string | null }).report_token as
          | string
          | null)
      : null;
  const reportLink =
    reportToken && assessmentType === "boss_scorecard"
      ? buildScorecardReportUrl(coachSlug, reportToken, getAppBaseUrl(request))
      : null;

  const webhookUrl = await getCoachLeadWebhookUrl(coachId);
  if (webhookUrl) {
    const { first_name, last_name } = splitFullName(fullName);
    const completedAt =
      (assessment as { completed_at?: string }).completed_at ??
      new Date().toISOString();

    const event = "assessment_completed" as const;
    const basePayload = {
      event,
      status: resolveLeadWebhookStatus(event),
      coach_slug: coachSlug,
      coach_id: coachId,
      contact: {
        contact_id: contactId,
        full_name: fullName === "Unknown" ? null : fullName,
        first_name,
        last_name,
        email,
        phone,
        business_name: businessName,
      },
      total_score: body.total_score,
      assessment_id: assessment.id as string,
      source: "prospect_link",
      fired_at: new Date().toISOString(),
      assessment_type: assessmentType,
    };

    if (assessmentType === "boss_scorecard") {
      const qualifyingData = (body.qualifying_data ?? {}) as QualifyingData;
      const qualifying = qualifyingToWebhookFields(qualifyingData);
      const ghlCustomFields = buildBossScorecardGhlCustomFields({
        qualifying_data: qualifyingData,
        answers: (body.answers ?? {}) as ScorecardAnswers,
        boss_score: body.total_score,
        boss_level: body.boss_level ?? null,
        open_text: body.open_text ?? null,
        report_link: reportLink,
      });
      void fireLeadWebhook(webhookUrl, {
        ...basePayload,
        ...ghlCustomFields,
        report_link: reportLink,
        boss_score: body.total_score,
        boss_level: body.boss_level ?? null,
        answers: body.answers,
        qualifying,
        open_text: body.open_text ?? null,
        completed_at: completedAt,
        last_screen_reached: body.last_screen_reached ?? 16,
      });
    } else {
      void fireLeadWebhook(webhookUrl, basePayload);
    }
  }

  return NextResponse.json(
    {
      id: assessment.id,
      completed_at: assessment.completed_at,
      report_token: reportToken,
      report_link: reportLink,
    },
    { status: 201 }
  );
}
