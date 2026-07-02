import { NextResponse } from "next/server";
import { deriveCurrentLevelId } from "@/lib/ladder";
import { defaultMonthlyIncomeForLevelId } from "@/lib/ladderIncomeGoal";
import { createCoachProfileAndRow } from "@/lib/createCoachAccountRecords";
import { splitFullName } from "@/lib/splitFullName";
import {
  hasCalendarEmbed,
  isCalendarSyncReady,
} from "@/lib/ghlCalendarSync";
import {
  resolveCommunityBio,
  resolveDirectoryBio,
  resolveDirectorySummary,
} from "@/lib/profileBioFields";
import { coachHasActiveRecurringBilling } from "@/lib/coachRecurringBilling";
import {
  isCoachRecurringPaymentStatus,
  type CoachRecurringPaymentStatus,
} from "@/lib/coachBilling";
import type { PaymentForBillingKind } from "@/lib/paymentBillingKind";
import { resolveCoachJoinedAt } from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  businessName?: string;
  email: string;
  slug: string;
};

async function requireAdmin(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized." | "Server error."; userId: null }
  | { error: null; userId: string }
> {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return { error: "Missing access token." as const, userId: null };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { error: "Invalid access token." as const, userId: null };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return { error: "Not authorized." as const, userId: null };
    }

    return { error: null, userId: user.id as string };
  } catch (err) {
    console.error("admin/coaches requireAdmin error:", err);
    return { error: "Server error." as const, userId: null };
  }
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  try {
    type CoachQueryRow = Record<string, unknown>;
    type QueryResult = {
      data: CoachQueryRow[] | null;
      error: { code?: string } | null;
    };

    const runSelect = async (selectStr: string): Promise<QueryResult> => {
      const r = await supabaseAdmin
        .from("coaches")
        .select(selectStr)
        .order("slug", { ascending: true });
      return {
        data: (r.data as unknown as CoachQueryRow[] | null) ?? null,
        error: r.error as { code?: string } | null,
      };
    };

    const profileFull =
      "profiles!inner(full_name, coach_business_name, avatar_url, linkedin_url, bio, community_bio, directory_summary, directory_bio, ladder_goal_level, ladder_goal_target_date, created_at, disco_community_joined_on, coaching_income_reported_2024)";
    const billingCols =
      "has_sales_robot_account, sales_robot_active_campaigns, sales_robot_paying_accounts, has_profit_coach_email_account, recurring_payment_status, membership_status, membership_interval, membership_current_period_end, stripe_subscription_id";
    const coachCore =
      "id, slug, directory_listed, directory_level, conference_status, lead_webhook_url, crm_profile_name, crm_location_id, calendar_embed_code";

    let res = await runSelect(
      `${coachCore}, access_tier, access_tier_locked, ghl_calendar_id, ${billingCols}, ${profileFull}`
    );

    let calendarEmbedMissing = false;
    let webhookMissing = false;
    let crmMissing = false;
    let conferenceStatusMissing = false;
    let accountBillingMissing = false;
    let accessTierMissing = false;
    let ghlCalendarMissing = false;

    if (res.error?.code === "42703") {
      res = await runSelect(
        `${coachCore}, ${billingCols}, ${profileFull}`
      );
      accessTierMissing = true;
      ghlCalendarMissing = true;
    }
    if (res.error?.code === "42703") {
      res = await runSelect(
        `id, slug, directory_listed, directory_level, conference_status, lead_webhook_url, crm_profile_name, crm_location_id, ${billingCols}, ${profileFull}`
      );
      calendarEmbedMissing = true;
      accessTierMissing = true;
      ghlCalendarMissing = true;
    }
    if (res.error?.code === "42703") {
      res = await runSelect(
        `id, slug, directory_listed, directory_level, lead_webhook_url, crm_profile_name, crm_location_id, ${billingCols}, ${profileFull}`
      );
      calendarEmbedMissing = true;
      conferenceStatusMissing = true;
      accessTierMissing = true;
      ghlCalendarMissing = true;
    }
    if (res.error?.code === "42703") {
      res = await runSelect(
        `id, slug, directory_listed, directory_level, ${profileFull}`
      );
      webhookMissing = true;
      crmMissing = true;
      conferenceStatusMissing = true;
      calendarEmbedMissing = true;
      accessTierMissing = true;
      ghlCalendarMissing = true;
      accountBillingMissing = true;
    }

    let goalDateMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, directory_listed, directory_level, profiles!inner(full_name, coach_business_name, avatar_url, linkedin_url, ladder_goal_level, created_at, disco_community_joined_on, coaching_income_reported_2024)"
      );
      goalDateMissing = true;
      webhookMissing = true;
    }

    let directoryMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, profiles!inner(full_name, coach_business_name, avatar_url, linkedin_url, bio, community_bio, directory_summary, directory_bio, ladder_goal_level, created_at, disco_community_joined_on, coaching_income_reported_2024)"
      );
      directoryMissing = true;
    }

    let goalLevelMissing = false;
    if (res.error?.code === "42703") {
      res = await runSelect(
        "id, slug, profiles!inner(full_name, coach_business_name, avatar_url, linkedin_url, bio, community_bio, directory_summary, directory_bio, created_at, disco_community_joined_on, coaching_income_reported_2024)"
      );
      goalLevelMissing = true;
      directoryMissing = true;
    }

    if (res.error) {
      return NextResponse.json(
        { error: "Unable to load coaches." },
        { status: 500 }
      );
    }

    const rows: CoachQueryRow[] = res.data ?? [];
    const ids = rows.map((r) => r.id as string);
    const idSet = new Set(ids);
    const lastLoginByUserId = new Map<string, string | null>();

    if (ids.length > 0) {
      const authUsersRes = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (!authUsersRes.error) {
        for (const user of authUsersRes.data.users ?? []) {
          if (idSet.has(user.id)) {
            lastLoginByUserId.set(user.id, user.last_sign_in_at ?? null);
          }
        }
      }
    }

    // Pull achievements in one query and group by user.
    const achievementsByUser = new Map<string, Array<{ level_id: string }>>();
    if (ids.length > 0) {
      const achRes = await supabaseAdmin
        .from("community_ladder_achievements")
        .select("user_id, level_id")
        .in("user_id", ids);
      if (achRes.error?.code !== "42P01" && !achRes.error) {
        for (const r of achRes.data ?? []) {
          const list =
            achievementsByUser.get(r.user_id as string) ??
            ([] as Array<{ level_id: string }>);
          list.push({ level_id: r.level_id as string });
          achievementsByUser.set(r.user_id as string, list);
        }
      }
    }

    const clientCountByCoachId = new Map<string, number>();
    if (ids.length > 0) {
      const contactsRes = await supabaseAdmin
        .from("contacts")
        .select("coach_id")
        .in("coach_id", ids);
      if (contactsRes.error?.code !== "42P01" && !contactsRes.error) {
        for (const row of contactsRes.data ?? []) {
          const coachId = row.coach_id as string | null;
          if (!coachId) continue;
          clientCountByCoachId.set(
            coachId,
            (clientCountByCoachId.get(coachId) ?? 0) + 1
          );
        }
      }
    }

    const paymentsByCoachId = new Map<string, PaymentForBillingKind[]>();
    if (ids.length > 0) {
      const paymentsRes = await supabaseAdmin
        .from("coach_payments")
        .select(
          "id, customer_email, coach_id, amount_cents, currency, status, description, paid_at, billing_kind_override"
        )
        .in("coach_id", ids)
        .eq("status", "succeeded");
      if (paymentsRes.error?.code !== "42P01" && !paymentsRes.error) {
        for (const payment of paymentsRes.data ?? []) {
          const coachId = payment.coach_id as string | null;
          if (!coachId) continue;
          const list = paymentsByCoachId.get(coachId) ?? [];
          list.push(payment as PaymentForBillingKind);
          paymentsByCoachId.set(coachId, list);
        }
      }
    }

    const coaches = rows.map((row) => {
      const profRaw = row.profiles as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined;
      const prof: Record<string, unknown> | undefined = Array.isArray(profRaw)
        ? profRaw[0]
        : profRaw;
      const id = row.id as string;
      const ach = achievementsByUser.get(id) ?? [];
      const currentLevel = deriveCurrentLevelId(ach);
      const bioFields = {
        bio: (prof?.bio as string | null) ?? null,
        community_bio: (prof?.community_bio as string | null) ?? null,
        directory_summary: (prof?.directory_summary as string | null) ?? null,
        directory_bio: (prof?.directory_bio as string | null) ?? null,
      };
      return {
        id,
        slug: row.slug as string,
        full_name: (prof?.full_name as string | null) ?? null,
        avatar_url: (prof?.avatar_url as string | null) ?? null,
        coach_business_name:
          (prof?.coach_business_name as string | null) ?? null,
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
        client_count: clientCountByCoachId.get(id) ?? 0,
        directory_listed: directoryMissing ? false : !!row.directory_listed,
        directory_level: directoryMissing
          ? null
          : (row.directory_level as string | null) ?? null,
        lead_webhook_url: webhookMissing
          ? null
          : (row.lead_webhook_url as string | null) ?? null,
        conference_status: conferenceStatusMissing
          ? null
          : (row.conference_status as string | null) ?? null,
        crm_profile_name: crmMissing
          ? null
          : (row.crm_profile_name as string | null) ?? null,
        crm_location_id: crmMissing
          ? null
          : (row.crm_location_id as string | null) ?? null,
        has_calendar_embed: calendarEmbedMissing
          ? false
          : hasCalendarEmbed(
              row.calendar_embed_code as string | null,
              ghlCalendarMissing
                ? null
                : (row.ghl_calendar_id as string | null)
            ),
        calendar_sync_ready: calendarEmbedMissing
          ? false
          : isCalendarSyncReady({
              crmLocationId: row.crm_location_id as string | null,
              calendarEmbedCode: row.calendar_embed_code as string | null,
              ghlCalendarId: ghlCalendarMissing
                ? null
                : (row.ghl_calendar_id as string | null),
              leadWebhookUrl: row.lead_webhook_url as string | null,
            }),
        has_lead_webhook: webhookMissing
          ? false
          : Boolean((row.lead_webhook_url as string | null)?.trim()),
        has_community_bio: Boolean(resolveCommunityBio(bioFields)),
        has_directory_summary: Boolean(resolveDirectorySummary(bioFields)),
        has_directory_bio: Boolean(resolveDirectoryBio(bioFields)),
        has_sales_robot_account: accountBillingMissing
          ? false
          : !!row.has_sales_robot_account,
        sales_robot_active_campaigns: accountBillingMissing
          ? null
          : typeof row.sales_robot_active_campaigns === "number"
            ? row.sales_robot_active_campaigns
            : row.sales_robot_active_campaigns != null
              ? Number(row.sales_robot_active_campaigns)
              : null,
        sales_robot_paying_accounts: accountBillingMissing
          ? null
          : typeof row.sales_robot_paying_accounts === "number"
            ? row.sales_robot_paying_accounts
            : row.sales_robot_paying_accounts != null
              ? Number(row.sales_robot_paying_accounts)
              : null,
        has_profit_coach_email_account: accountBillingMissing
          ? false
          : !!row.has_profit_coach_email_account,
        recurring_payment_status: accountBillingMissing
          ? null
          : (row.recurring_payment_status as string | null) ?? null,
        recurring_billing_active: accountBillingMissing
          ? false
          : coachHasActiveRecurringBilling({
              recurringPaymentStatus: isCoachRecurringPaymentStatus(
                (row.recurring_payment_status as string | null) ?? ""
              )
                ? ((row.recurring_payment_status as string) as CoachRecurringPaymentStatus)
                : null,
              payments: paymentsByCoachId.get(id) ?? [],
            }),
        access_tier: accessTierMissing
          ? "premium"
          : ((row.access_tier as string | null) ?? "premium"),
        access_tier_locked: accessTierMissing
          ? false
          : Boolean(row.access_tier_locked),
        ladder_level: currentLevel,
        ladder_goal_level: goalLevelMissing
          ? null
          : (prof?.ladder_goal_level as string | null) ?? null,
        ladder_goal_target_date: goalDateMissing
          ? null
          : (prof?.ladder_goal_target_date as string | null) ?? null,
        last_login_at: lastLoginByUserId.get(id) ?? null,
      };
    });

    return NextResponse.json({ coaches });
  } catch (err) {
    console.error("admin/coaches GET error:", err);
    return NextResponse.json(
      { error: "Unable to load coaches." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const body = (await request.json()) as Body;

  const fullName = body.fullName?.trim();
  const businessName = body.businessName?.trim() || null;
  const email = body.email?.trim().toLowerCase();
  const slug = body.slug?.toLowerCase().trim();

  if (!fullName || !email || !slug) {
    return NextResponse.json(
      { error: "Please fill in name, email, and slug." },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      {
        error:
          "Slug can only contain lowercase letters, numbers, and hyphens.",
      },
      { status: 400 }
    );
  }

  try {
    let userId: string | null = null;

    const {
      data,
      error: inviteError,
    } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !data?.user) {
      throw new Error(
        inviteError?.message ?? "Unable to send invite email."
      );
    }
    userId = data.user.id;

    if (!userId) {
      throw new Error("User id missing after creating coach account.");
    }

    const { first_name, last_name } = splitFullName(fullName);

    const coachRecordsError = await createCoachProfileAndRow({
      userId,
      fullName,
      firstName: first_name,
      lastName: last_name,
      businessName: businessName,
      slug,
    });

    if (coachRecordsError) {
      throw new Error(coachRecordsError);
    }

    return NextResponse.json(
      { ok: true, coachUserId: userId, slug },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}
