import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { fireLeadWebhook, getCoachLeadWebhookUrl } from "@/lib/leadWebhook";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  coachSlug?: string;
  from_landing?: "a" | "b";
  contact: {
    full_name?: string;
    email?: string;
    business_name?: string;
    phone?: string;
  };
  answers: Record<string, 0 | 1 | 2>;
  total_score: number;
};

const CENTRAL_SLUG = "BCA";
const CENTRAL_SLUG_LOWER = CENTRAL_SLUG.toLowerCase();

/**
 * Creates auth user + profile + coaches row for central marketing when no "bca" coach exists.
 * Set AUTO_PROVISION_CENTRAL_COACH=false to require manual Admin setup instead.
 */
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

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  // Central marketing: missing or empty slug defaults to BCA
  const coachSlug =
    typeof body.coachSlug === "string" && body.coachSlug.trim()
      ? body.coachSlug.trim().toLowerCase()
      : CENTRAL_SLUG_LOWER;

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

  // Look up coach; auto-provision central "bca" when missing (see provisionCentralCoachIfMissing).
  let {
    data: coach,
    error: coachError,
  } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", coachSlug)
    .maybeSingle();

  if (coachError) {
    console.error("assessments coach lookup:", coachError);
    return NextResponse.json(
      { error: "Unable to look up coach." },
      { status: 500 }
    );
  }

  if (!coach && coachSlug === CENTRAL_SLUG_LOWER) {
    const provisioned = await provisionCentralCoachIfMissing();
    if (provisioned) {
      coach = provisioned;
    }
  }

  if (!coach) {
    return NextResponse.json(
      {
        error:
          coachSlug === CENTRAL_SLUG_LOWER
            ? "Central assessment is not set up. Create a coach with slug \"BCA\" in Admin (or set CENTRAL_COACH_SYSTEM_EMAIL and ensure AUTO_PROVISION_CENTRAL_COACH is not false)."
            : "Coach not found for this link.",
      },
      { status: 400 }
    );
  }

  const coachId = coach.id as string;

  const fullName = body.contact?.full_name?.trim() || "Unknown";
  const email = body.contact?.email?.trim().toLowerCase() || null;
  const businessName = body.contact?.business_name?.trim() || null;
  const phone = body.contact?.phone?.trim() || null;

  // Upsert contact for this coach by email (if provided), otherwise always create
  let contactId: string | null = null;

  if (email) {
    const {
      data: existing,
      error: contactLookupError,
    } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("coach_id", coachId)
      .eq("email", email)
      .maybeSingle();

    if (!contactLookupError && existing) {
      contactId = existing.id as string;
    } else if (contactLookupError) {
      console.error("assessments contact lookup:", contactLookupError);
    }
  }

  if (!contactId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({
        coach_id: coachId,
        type: "prospect",
        full_name: fullName,
        email,
        business_name: businessName,
        phone,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // A lead-capture request may race this endpoint and insert the same
      // (coach_id, email) contact first. Recover by reloading that row.
      if (insertError?.code === "23505" && email) {
        const { data: raced, error: racedLookupError } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("coach_id", coachId)
          .eq("email", email)
          .maybeSingle();
        if (!racedLookupError && raced?.id) {
          contactId = raced.id as string;
        } else {
          console.error("assessments contact insert race lookup:", racedLookupError);
          return NextResponse.json(
            { error: "Failed to create contact" },
            { status: 500 }
          );
        }
      } else if (insertError?.code === "23502" && !email) {
        // Some deployments may still enforce NOT NULL on contacts.email.
        // Keep the assessment flow non-blocking by inserting with a safe
        // placeholder address.
        const placeholderEmail = `unknown+${randomUUID()}@noemail.local`;
        const { data: insertedWithPlaceholder, error: placeholderError } =
          await supabaseAdmin
            .from("contacts")
            .insert({
              coach_id: coachId,
              type: "prospect",
              full_name: fullName,
              email: placeholderEmail,
              business_name: businessName,
              phone,
            })
            .select("id")
            .single();
        if (!placeholderError && insertedWithPlaceholder?.id) {
          contactId = insertedWithPlaceholder.id as string;
        } else {
          console.error(
            "assessments contact insert placeholder retry:",
            placeholderError
          );
          return NextResponse.json(
            { error: "Failed to create contact" },
            { status: 500 }
          );
        }
      } else {
        console.error("assessments contact insert:", insertError);
        return NextResponse.json(
          { error: "Failed to create contact" },
          { status: 500 }
        );
      }
    }
    if (!contactId && inserted?.id) {
      contactId = inserted.id as string;
    }
  }

  const {
    data: assessment,
    error: assessmentError,
  } = await supabaseAdmin
    .from("assessments")
    .insert({
      coach_id: coachId,
      contact_id: contactId,
      source: "prospect_link",
      total_score: body.total_score,
      answers: body.answers,
    })
    .select("id, completed_at")
    .single();

  if (assessmentError || !assessment) {
    return NextResponse.json(
      { error: "Failed to save assessment" },
      { status: 500 }
    );
  }

  const fromLanding = body.from_landing === "a" || body.from_landing === "b" ? body.from_landing : null;
  if (fromLanding) {
    const { data: runningTest } = await supabaseAdmin
      .from("landing_tests")
      .select("id")
      .eq("status", "running")
      .limit(1)
      .maybeSingle();
    if (runningTest) {
      await supabaseAdmin.from("landing_events").insert({
        test_id: runningTest.id,
        variant: fromLanding,
        coach_slug: coachSlug,
        event_type: "finish",
        contact_id: contactId,
        assessment_id: assessment.id,
      });
    }
  }

  const webhookUrl = await getCoachLeadWebhookUrl(coachId);
  if (webhookUrl) {
    const { first_name, last_name } = splitFullName(fullName);
    void fireLeadWebhook(webhookUrl, {
      event: "assessment_completed",
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
    });
  }

  return NextResponse.json(
    {
      id: assessment.id,
      completed_at: assessment.completed_at,
    },
    { status: 201 }
  );
}

