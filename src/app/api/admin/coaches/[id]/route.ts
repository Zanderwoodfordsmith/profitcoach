import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { normalizeCoachAccessTier } from "@/lib/coachAccess/tiers";
import {
  isCoachRecurringPaymentStatus,
  type CoachRecurringPaymentStatus,
} from "@/lib/coachBilling";
import { coachHasActiveRecurringBilling } from "@/lib/coachRecurringBilling";
import { deriveCurrentLevelId, isValidLadderLevelId } from "@/lib/ladder";
import { defaultMonthlyIncomeForLevelId } from "@/lib/ladderIncomeGoal";
import {
  hasCalendarEmbed,
  isCalendarSyncReady,
  validateCrmLocationId,
} from "@/lib/ghlCalendarSync";
import type { PaymentForBillingKind } from "@/lib/paymentBillingKind";
import {
  resolveCommunityBio,
  resolveDirectoryBio,
  resolveDirectorySummary,
} from "@/lib/profileBioFields";
import { resolveCoachJoinedAt } from "@/lib/primaryCoach";
import { syncCoachActionAutoComplete } from "@/lib/actionPlans/syncAutoComplete";
import { formatPersonName } from "@/lib/formatPersonName";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LEVELS = new Set(["certified", "professional", "elite"]);
const CONFERENCE_STATUSES = new Set(["no", "maybe", "yes"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  try {
    const profileSelect =
      "profiles!inner(full_name, coach_business_name, avatar_url, linkedin_url, bio, community_bio, directory_summary, directory_bio, ladder_goal_level, ladder_goal_target_date, created_at, disco_community_joined_on, coaching_income_reported_2024)";
    const coachSelect = `
      id, slug, directory_listed, directory_level, conference_status, lead_webhook_url,
      crm_profile_name, crm_location_id, calendar_embed_code, access_tier, access_tier_locked,
      ghl_calendar_id, has_sales_robot_account, sales_robot_active_campaigns,
      sales_robot_paying_accounts, has_profit_coach_email_account, recurring_payment_status,
      stripe_customer_id, stripe_subscription_id, membership_status, membership_interval,
      membership_current_period_end, membership_cancel_at_period_end,
      ${profileSelect}
    `;

    const { data: row, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select(coachSelect)
      .eq("id", coachId)
      .maybeSingle();

    if (coachError) {
      console.error("admin/coaches/[id] GET coach error:", coachError);
      return NextResponse.json({ error: "Unable to load coach." }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    const profRaw = row.profiles as
      | Record<string, unknown>
      | Array<Record<string, unknown>>
      | undefined;
    const prof: Record<string, unknown> | undefined = Array.isArray(profRaw)
      ? profRaw[0]
      : profRaw;

    const [achRes, contactsRes, paymentsRes, authUserRes] = await Promise.all([
      supabaseAdmin
        .from("community_ladder_achievements")
        .select("level_id")
        .eq("user_id", coachId),
      supabaseAdmin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .eq("type", "client"),
      supabaseAdmin
        .from("coach_payments")
        .select(
          "id, stripe_payment_intent_id, customer_email, customer_company_name, amount_cents, currency, status, paid_at, assignment_method, decline_reason, description, notes, payment_source, billing_kind_override"
        )
        .eq("coach_id", coachId)
        .order("paid_at", { ascending: false }),
      supabaseAdmin.auth.admin.getUserById(coachId),
    ]);

    const achievements = (achRes.data ?? []).map((item) => ({
      level_id: item.level_id as string,
    }));
    const currentLevel = deriveCurrentLevelId(achievements);
    const bioFields = {
      bio: (prof?.bio as string | null) ?? null,
      community_bio: (prof?.community_bio as string | null) ?? null,
      directory_summary: (prof?.directory_summary as string | null) ?? null,
      directory_bio: (prof?.directory_bio as string | null) ?? null,
    };

    const succeededPayments = (paymentsRes.data ?? []).filter(
      (payment) => payment.status === "succeeded"
    ) as PaymentForBillingKind[];

    const coach = {
      id: row.id as string,
      slug: row.slug as string,
      email: authUserRes.data.user?.email ?? null,
      full_name: (prof?.full_name as string | null) ?? null,
      avatar_url: (prof?.avatar_url as string | null) ?? null,
      coach_business_name: (prof?.coach_business_name as string | null) ?? null,
      linkedin_url: (prof?.linkedin_url as string | null) ?? null,
      current_monthly_income: (() => {
        const raw = prof?.coaching_income_reported_2024;
        if (typeof raw !== "string") return null;
        const parsed = raw
          .trim()
          .replace(/,/g, "")
          .match(/-?\d+(?:\.\d+)?/);
        if (!parsed) return null;
        const numeric = Number(parsed[0]);
        return Number.isFinite(numeric) ? numeric : null;
      })(),
      goal_monthly_income:
        typeof prof?.ladder_goal_level === "string"
          ? defaultMonthlyIncomeForLevelId(prof.ladder_goal_level)
          : null,
      joined_at: resolveCoachJoinedAt(row.slug as string, {
        discoCommunityJoinedOn:
          (prof?.disco_community_joined_on as string | null) ?? null,
        profileCreatedAt: (prof?.created_at as string | null) ?? null,
      }),
      client_count: contactsRes.count ?? 0,
      directory_listed: !!row.directory_listed,
      directory_level: (row.directory_level as string | null) ?? null,
      lead_webhook_url: (row.lead_webhook_url as string | null) ?? null,
      conference_status: (row.conference_status as string | null) ?? null,
      crm_profile_name: (row.crm_profile_name as string | null) ?? null,
      crm_location_id: (row.crm_location_id as string | null) ?? null,
      has_calendar_embed: hasCalendarEmbed(
        row.calendar_embed_code as string | null,
        (row.ghl_calendar_id as string | null) ?? null
      ),
      calendar_sync_ready: isCalendarSyncReady({
        crmLocationId: row.crm_location_id as string | null,
        calendarEmbedCode: row.calendar_embed_code as string | null,
        ghlCalendarId: (row.ghl_calendar_id as string | null) ?? null,
        leadWebhookUrl: row.lead_webhook_url as string | null,
      }),
      has_lead_webhook: Boolean((row.lead_webhook_url as string | null)?.trim()),
      has_community_bio: Boolean(resolveCommunityBio(bioFields)),
      has_directory_summary: Boolean(resolveDirectorySummary(bioFields)),
      has_directory_bio: Boolean(resolveDirectoryBio(bioFields)),
      has_sales_robot_account: !!row.has_sales_robot_account,
      sales_robot_active_campaigns:
        typeof row.sales_robot_active_campaigns === "number"
          ? row.sales_robot_active_campaigns
          : row.sales_robot_active_campaigns != null
            ? Number(row.sales_robot_active_campaigns)
            : null,
      sales_robot_paying_accounts:
        typeof row.sales_robot_paying_accounts === "number"
          ? row.sales_robot_paying_accounts
          : row.sales_robot_paying_accounts != null
            ? Number(row.sales_robot_paying_accounts)
            : null,
      has_profit_coach_email_account: !!row.has_profit_coach_email_account,
      recurring_payment_status:
        (row.recurring_payment_status as string | null) ?? null,
      recurring_billing_active: coachHasActiveRecurringBilling({
        recurringPaymentStatus: isCoachRecurringPaymentStatus(
          (row.recurring_payment_status as string | null) ?? ""
        )
          ? ((row.recurring_payment_status as string) as CoachRecurringPaymentStatus)
          : null,
        payments: succeededPayments,
      }),
      access_tier: normalizeCoachAccessTier(row.access_tier) ?? "programme",
      access_tier_locked: Boolean(row.access_tier_locked),
      stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
      stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
      membership_status: (row.membership_status as string | null) ?? null,
      membership_interval: (row.membership_interval as string | null) ?? null,
      membership_current_period_end:
        (row.membership_current_period_end as string | null) ?? null,
      membership_cancel_at_period_end: Boolean(row.membership_cancel_at_period_end),
      ladder_level: currentLevel,
      ladder_goal_level: (prof?.ladder_goal_level as string | null) ?? null,
      ladder_goal_target_date:
        (prof?.ladder_goal_target_date as string | null) ?? null,
      last_login_at: authUserRes.data.user?.last_sign_in_at ?? null,
      community_bio: bioFields.community_bio,
      directory_summary: bioFields.directory_summary,
      directory_bio: bioFields.directory_bio,
    };

    const payments = (paymentsRes.data ?? []).map((payment) => ({
      id: payment.id as string,
      stripe_payment_intent_id:
        (payment.stripe_payment_intent_id as string | null) ?? null,
      customer_email: payment.customer_email as string,
      customer_company_name:
        (payment.customer_company_name as string | null) ?? null,
      amount_cents: payment.amount_cents as number,
      currency: payment.currency as string,
      status: payment.status as string,
      paid_at: payment.paid_at as string,
      assignment_method: payment.assignment_method as string,
      decline_reason: (payment.decline_reason as string | null) ?? null,
      description: (payment.description as string | null) ?? null,
      notes: (payment.notes as string | null) ?? null,
      payment_source: (payment.payment_source as string) ?? "stripe",
      billing_kind_override:
        (payment.billing_kind_override as string | null) ?? null,
    }));

    return NextResponse.json({ coach, payments });
  } catch (err) {
    console.error("admin/coaches/[id] GET catch:", err);
    return NextResponse.json({ error: "Unable to load coach." }, { status: 500 });
  }
}

type PatchBody = {
  directory_listed?: boolean;
  directory_level?: string | null;
  conference_status?: string | null;
  /** Convenience: admin marks the coach's current level. Upserts an achievement. */
  ladder_level?: string | null;
  ladder_goal_level?: string | null;
  ladder_goal_target_date?: string | null;
  /**
   * Admin-only outbound URL fired when a prospect captures contact info or
   * completes the assessment. Hidden from coaches by design.
   */
  lead_webhook_url?: string | null;
  /** Label of the CRM account/profile, shown in admin coaches table. */
  crm_profile_name?: string | null;
  /** CRM location id appended to Pro Coach Platform location URL. */
  crm_location_id?: string | null;
  has_sales_robot_account?: boolean;
  has_profit_coach_email_account?: boolean;
  recurring_payment_status?: string | null;
  access_tier?: string | null;
  access_tier_locked?: boolean;
  /** Coach profile fields editable by admin. */
  full_name?: string | null;
  coach_business_name?: string | null;
  linkedin_url?: string | null;
  /** Community member join date (profiles.disco_community_joined_on). */
  disco_community_joined_on?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const coachUpdates: Record<string, unknown> = {};
  if (body.directory_listed !== undefined) {
    coachUpdates.directory_listed = !!body.directory_listed;
  }
  if (body.directory_level !== undefined) {
    if (body.directory_level === null || body.directory_level === "") {
      coachUpdates.directory_level = null;
    } else if (typeof body.directory_level === "string" && LEVELS.has(body.directory_level)) {
      coachUpdates.directory_level = body.directory_level;
    } else {
      return NextResponse.json(
        { error: "directory_level must be certified, professional, elite, or null." },
        { status: 400 }
      );
    }
  }
  if (body.conference_status !== undefined) {
    if (body.conference_status === null || body.conference_status === "") {
      coachUpdates.conference_status = null;
    } else if (
      typeof body.conference_status === "string" &&
      CONFERENCE_STATUSES.has(body.conference_status)
    ) {
      coachUpdates.conference_status = body.conference_status;
    } else {
      return NextResponse.json(
        { error: "conference_status must be no, maybe, yes, or null." },
        { status: 400 }
      );
    }
  }
  if (body.lead_webhook_url !== undefined) {
    if (body.lead_webhook_url === null || body.lead_webhook_url === "") {
      coachUpdates.lead_webhook_url = null;
    } else if (typeof body.lead_webhook_url === "string") {
      const trimmed = body.lead_webhook_url.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json(
          { error: "Lead webhook URL must start with http:// or https://." },
          { status: 400 }
        );
      }
      coachUpdates.lead_webhook_url = trimmed;
    } else {
      return NextResponse.json(
        { error: "lead_webhook_url must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.crm_profile_name !== undefined) {
    if (body.crm_profile_name === null || body.crm_profile_name === "") {
      coachUpdates.crm_profile_name = null;
    } else if (typeof body.crm_profile_name === "string") {
      coachUpdates.crm_profile_name = body.crm_profile_name.trim();
    } else {
      return NextResponse.json(
        { error: "crm_profile_name must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.crm_location_id !== undefined) {
    if (body.crm_location_id === null || body.crm_location_id === "") {
      coachUpdates.crm_location_id = null;
    } else if (typeof body.crm_location_id === "string") {
      const validated = validateCrmLocationId(body.crm_location_id);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      coachUpdates.crm_location_id = validated.value;
    } else {
      return NextResponse.json(
        { error: "crm_location_id must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.has_sales_robot_account !== undefined) {
    coachUpdates.has_sales_robot_account = !!body.has_sales_robot_account;
  }
  if (body.has_profit_coach_email_account !== undefined) {
    coachUpdates.has_profit_coach_email_account =
      !!body.has_profit_coach_email_account;
  }
  if (body.recurring_payment_status !== undefined) {
    if (
      body.recurring_payment_status === null ||
      body.recurring_payment_status === ""
    ) {
      coachUpdates.recurring_payment_status = null;
    } else if (
      typeof body.recurring_payment_status === "string" &&
      isCoachRecurringPaymentStatus(body.recurring_payment_status)
    ) {
      coachUpdates.recurring_payment_status = body.recurring_payment_status;
    } else {
      return NextResponse.json(
        {
          error:
            "recurring_payment_status must be monthly, annual_prepaid, first_6_months, complimentary, overdue, or null.",
        },
        { status: 400 }
      );
    }
  }
  if (body.access_tier !== undefined) {
    if (body.access_tier === null || body.access_tier === "") {
      coachUpdates.access_tier = "programme";
    } else {
      const normalizedTier = normalizeCoachAccessTier(body.access_tier);
      if (normalizedTier) {
        coachUpdates.access_tier = normalizedTier;
      } else {
        return NextResponse.json(
          {
            error:
              "access_tier must be alumni, programme, core, premium, vip, early_exit, do_not_contact, or null.",
          },
          { status: 400 }
        );
      }
    }
  }
  if (body.access_tier_locked !== undefined) {
    coachUpdates.access_tier_locked = !!body.access_tier_locked;
  }
  if (
    coachUpdates.access_tier === "do_not_contact" ||
    coachUpdates.access_tier === "early_exit"
  ) {
    coachUpdates.access_tier_locked = true;
  }
  if (
    coachUpdates.access_tier === "programme" &&
    body.recurring_payment_status === undefined
  ) {
    coachUpdates.recurring_payment_status = "first_6_months";
  }
  if (coachUpdates.access_tier_locked === false) {
    const { data: existingCoach } = await supabaseAdmin
      .from("coaches")
      .select("access_tier")
      .eq("id", coachId)
      .maybeSingle();
    const nextTier =
      normalizeCoachAccessTier(coachUpdates.access_tier) ??
      normalizeCoachAccessTier(existingCoach?.access_tier);
    if (nextTier === "do_not_contact" || nextTier === "early_exit") {
      coachUpdates.access_tier_locked = true;
    }
  }

  const profileUpdates: Record<string, unknown> = {};
  if (body.full_name !== undefined) {
    if (body.full_name === null || body.full_name === "") {
      profileUpdates.full_name = null;
      profileUpdates.first_name = null;
      profileUpdates.last_name = null;
    } else if (typeof body.full_name === "string") {
      const formatted = formatPersonName(body.full_name);
      profileUpdates.full_name = formatted || null;
      const { first_name, last_name } = splitFullName(formatted);
      profileUpdates.first_name = first_name;
      profileUpdates.last_name = last_name;
    } else {
      return NextResponse.json(
        { error: "full_name must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.coach_business_name !== undefined) {
    if (body.coach_business_name === null || body.coach_business_name === "") {
      profileUpdates.coach_business_name = null;
    } else if (typeof body.coach_business_name === "string") {
      profileUpdates.coach_business_name = body.coach_business_name.trim();
    } else {
      return NextResponse.json(
        { error: "coach_business_name must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.linkedin_url !== undefined) {
    if (body.linkedin_url === null || body.linkedin_url === "") {
      profileUpdates.linkedin_url = null;
    } else if (typeof body.linkedin_url === "string") {
      const trimmed = body.linkedin_url.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json(
          { error: "LinkedIn URL must start with http:// or https://." },
          { status: 400 }
        );
      }
      profileUpdates.linkedin_url = trimmed;
    } else {
      return NextResponse.json(
        { error: "linkedin_url must be a string or null." },
        { status: 400 }
      );
    }
  }
  if (body.ladder_goal_level !== undefined) {
    if (body.ladder_goal_level === null || body.ladder_goal_level === "") {
      profileUpdates.ladder_goal_level = null;
    } else if (
      typeof body.ladder_goal_level === "string" &&
      isValidLadderLevelId(body.ladder_goal_level)
    ) {
      profileUpdates.ladder_goal_level = body.ladder_goal_level;
    } else {
      return NextResponse.json(
        { error: "ladder_goal_level must be a valid ladder id or null." },
        { status: 400 }
      );
    }
  }
  if (body.ladder_goal_target_date !== undefined) {
    if (
      body.ladder_goal_target_date === null ||
      body.ladder_goal_target_date === ""
    ) {
      profileUpdates.ladder_goal_target_date = null;
    } else if (
      typeof body.ladder_goal_target_date === "string" &&
      ISO_DATE_RE.test(body.ladder_goal_target_date)
    ) {
      profileUpdates.ladder_goal_target_date = body.ladder_goal_target_date;
    } else {
      return NextResponse.json(
        { error: "ladder_goal_target_date must be YYYY-MM-DD or null." },
        { status: 400 }
      );
    }
  }
  if (body.disco_community_joined_on !== undefined) {
    if (
      body.disco_community_joined_on === null ||
      body.disco_community_joined_on === ""
    ) {
      profileUpdates.disco_community_joined_on = null;
    } else if (
      typeof body.disco_community_joined_on === "string" &&
      ISO_DATE_RE.test(body.disco_community_joined_on)
    ) {
      profileUpdates.disco_community_joined_on = body.disco_community_joined_on;
    } else {
      return NextResponse.json(
        { error: "disco_community_joined_on must be YYYY-MM-DD or null." },
        { status: 400 }
      );
    }
  }

  // Admin can also "mark current level" — upserts an achievement (today's date).
  let currentLevelMark:
    | { kind: "set"; levelId: string }
    | { kind: "clear" }
    | null = null;
  if (body.ladder_level !== undefined) {
    if (body.ladder_level === null || body.ladder_level === "") {
      currentLevelMark = { kind: "clear" };
    } else if (
      typeof body.ladder_level === "string" &&
      isValidLadderLevelId(body.ladder_level)
    ) {
      currentLevelMark = { kind: "set", levelId: body.ladder_level };
    } else {
      return NextResponse.json(
        { error: "ladder_level must be a valid ladder id or null." },
        { status: 400 }
      );
    }
  }

  if (
    Object.keys(coachUpdates).length === 0 &&
    Object.keys(profileUpdates).length === 0 &&
    currentLevelMark === null
  ) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    if (Object.keys(profileUpdates).length > 0) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", coachId);

      if (pErr?.code === "42703") {
        return NextResponse.json(
          {
            error:
              "Ladder columns are missing. Deploy the latest database migration.",
          },
          { status: 500 }
        );
      }
      if (pErr) {
        console.error("admin/coaches/[id] profile update error:", pErr);
        return NextResponse.json(
          { error: "Unable to update coach ladder fields." },
          { status: 500 }
        );
      }
    }

    if (currentLevelMark) {
      if (currentLevelMark.kind === "set") {
        const today = new Date().toISOString().slice(0, 10);
        const { error: aErr } = await supabaseAdmin
          .from("community_ladder_achievements")
          .upsert(
            {
              user_id: coachId,
              level_id: currentLevelMark.levelId,
              achieved_on: today,
            },
            { onConflict: "user_id,level_id" }
          );
        if (aErr?.code === "42P01") {
          return NextResponse.json(
            {
              error:
                "Ladder achievements table is missing. Deploy the latest database migration.",
            },
            { status: 500 }
          );
        }
        if (aErr) {
          console.error("admin/coaches/[id] mark_achieved error:", aErr);
          return NextResponse.json(
            { error: "Unable to set current ladder level." },
            { status: 500 }
          );
        }
      } else {
        // Clear all achievements for this coach.
        const { error: aErr } = await supabaseAdmin
          .from("community_ladder_achievements")
          .delete()
          .eq("user_id", coachId);
        if (aErr?.code === "42P01") {
          return NextResponse.json(
            {
              error:
                "Ladder achievements table is missing. Deploy the latest database migration.",
            },
            { status: 500 }
          );
        }
        if (aErr) {
          console.error("admin/coaches/[id] clear achievements error:", aErr);
          return NextResponse.json(
            { error: "Unable to clear ladder achievements." },
            { status: 500 }
          );
        }
      }
    }
    if (Object.keys(coachUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from("coaches")
        .update(coachUpdates)
        .eq("id", coachId);
      if (error?.code === "42703") {
        const includesWebhook =
          Object.prototype.hasOwnProperty.call(coachUpdates, "lead_webhook_url");
        const includesCrm =
          Object.prototype.hasOwnProperty.call(coachUpdates, "crm_profile_name") ||
          Object.prototype.hasOwnProperty.call(coachUpdates, "crm_location_id");
        const includesConferenceStatus =
          Object.prototype.hasOwnProperty.call(coachUpdates, "conference_status");
        const includesAccountBilling =
          Object.prototype.hasOwnProperty.call(
            coachUpdates,
            "has_sales_robot_account"
          ) ||
          Object.prototype.hasOwnProperty.call(
            coachUpdates,
            "has_profit_coach_email_account"
          ) ||
          Object.prototype.hasOwnProperty.call(
            coachUpdates,
            "recurring_payment_status"
          );
        return NextResponse.json(
          {
            error: includesAccountBilling
              ? "Account and billing columns are missing. Deploy the latest database migration."
              : includesCrm
                ? "CRM columns are missing. Deploy the latest database migration."
                : includesConferenceStatus
                  ? "Conference status column is missing. Deploy the latest database migration."
                  : includesWebhook
                    ? "Lead webhook column is missing. Deploy the latest database migration."
                    : "Directory columns are missing. Deploy the latest database migration.",
          },
          { status: 500 }
        );
      }
      if (error?.code === "23514") {
        if (Object.prototype.hasOwnProperty.call(coachUpdates, "access_tier")) {
          return NextResponse.json(
            {
              error:
                "Could not save access tier. Apply the latest database migration (early_exit tier) and try again.",
            },
            { status: 400 }
          );
        }
        const includesConferenceStatus =
          Object.prototype.hasOwnProperty.call(coachUpdates, "conference_status");
        const includesRecurringPayment =
          Object.prototype.hasOwnProperty.call(
            coachUpdates,
            "recurring_payment_status"
          );
        return NextResponse.json(
          {
            error: includesRecurringPayment
              ? "recurring_payment_status must be monthly, annual_prepaid, first_6_months, complimentary, overdue, or null."
              : includesConferenceStatus
                ? "Conference status must be no, maybe, yes, or null."
                : "Lead webhook URL must be a valid http(s) URL.",
          },
          { status: 400 }
        );
      }
      if (error) {
        console.error("admin/coaches/[id] update error:", error);
        return NextResponse.json(
          { error: "Unable to update coach." },
          { status: 500 }
        );
      }
    }

    const autoCompleteFieldsChanged =
      body.crm_profile_name !== undefined ||
      body.crm_location_id !== undefined ||
      body.lead_webhook_url !== undefined;
    if (autoCompleteFieldsChanged) {
      try {
        await syncCoachActionAutoComplete(coachId);
      } catch (syncErr) {
        console.warn("admin/coaches/[id] auto-complete sync failed:", syncErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coaches/[id] catch:", err);
    return NextResponse.json(
      { error: "Unable to update coach." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  if (coachId === authCheck.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own admin profile." },
      { status: 400 }
    );
  }

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", coachId)
      .maybeSingle();

    if (profileError) {
      console.error("admin/coaches/[id] delete profile check error:", profileError);
      return NextResponse.json(
        { error: "Unable to verify coach profile." },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (profile.role !== "coach") {
      return NextResponse.json(
        { error: "Only coach profiles can be deleted here." },
        { status: 400 }
      );
    }

    const { error: coachDeleteError } = await supabaseAdmin
      .from("coaches")
      .delete()
      .eq("id", coachId);
    if (coachDeleteError) {
      console.error("admin/coaches/[id] delete coach row error:", coachDeleteError);
      return NextResponse.json(
        { error: "Unable to delete coach directory record." },
        { status: 500 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", coachId);
    if (profileDeleteError) {
      console.error("admin/coaches/[id] delete profile row error:", profileDeleteError);
      return NextResponse.json(
        { error: "Unable to delete coach profile." },
        { status: 500 }
      );
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(coachId);
    if (authDeleteError) {
      console.error("admin/coaches/[id] delete auth user error:", authDeleteError);
      return NextResponse.json(
        { error: "Coach profile deleted, but auth account could not be deleted." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coaches/[id] DELETE catch:", err);
    return NextResponse.json(
      { error: "Unable to delete coach profile." },
      { status: 500 }
    );
  }
}
