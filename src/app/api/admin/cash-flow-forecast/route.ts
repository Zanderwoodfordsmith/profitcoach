import { NextResponse } from "next/server";

import {
  buildCashFlowForecast,
  defaultExpenseSections,
} from "@/lib/cashFlowForecast/buildForecast";
import type {
  CashFlowForecastSettings,
  ForecastExpenseRow,
  ForecastPaymentInput,
} from "@/lib/cashFlowForecast/types";
import {
  buildPaymentBillingKindIndex,
  type PaymentForBillingKind,
} from "@/lib/paymentBillingKind";
import { requireForecastAccess } from "@/lib/requireForecastAccess";
import { loadCoachDirectory } from "@/lib/stripePaymentsSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isMondayIso } from "@/lib/scorecardWeeks";

function parseExpenseRows(value: unknown): ForecastExpenseRow[] {
  if (!Array.isArray(value)) return defaultExpenseSections();
  const rows: ForecastExpenseRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.label !== "string") continue;
    rows.push({
      id: row.id,
      label: row.label,
      section: typeof row.section === "string" ? row.section : "Other",
      amountsByWeek:
        row.amountsByWeek && typeof row.amountsByWeek === "object"
          ? (row.amountsByWeek as Record<string, number>)
          : {},
      note: typeof row.note === "string" ? row.note : null,
    });
  }
  return rows.length > 0 ? rows : defaultExpenseSections();
}

function parseExcludedStreamKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadSettings(userId: string): Promise<CashFlowForecastSettings> {
  const { data, error } = await supabaseAdmin
    .from("cash_flow_forecast_settings")
    .select(
      "opening_balance_cents, stripe_balance_cents, stripe_balance_as_of, start_monday, expense_rows, excluded_stream_keys"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      openingBalanceCents: 0,
      stripeBalanceCents: 0,
      stripeBalanceAsOf: null,
      startMonday: null,
      expenseRows: defaultExpenseSections(),
      excludedStreamKeys: [],
    };
  }

  return {
    openingBalanceCents: Number(data.opening_balance_cents) || 0,
    stripeBalanceCents: Number(data.stripe_balance_cents) || 0,
    stripeBalanceAsOf: (data.stripe_balance_as_of as string | null) ?? null,
    startMonday: (data.start_monday as string | null) ?? null,
    expenseRows: parseExpenseRows(data.expense_rows),
    excludedStreamKeys: parseExcludedStreamKeys(data.excluded_stream_keys),
  };
}

async function loadForecastPayments(): Promise<ForecastPaymentInput[]> {
  const { data, error } = await supabaseAdmin
    .from("coach_payments")
    .select(
      "id, customer_email, customer_company_name, coach_id, amount_cents, currency, status, description, paid_at, billing_kind_override"
    )
    .order("paid_at", { ascending: false })
    .limit(5000);

  if (error || !data) return [];

  const billingIndex = buildPaymentBillingKindIndex(
    data as PaymentForBillingKind[]
  );

  return data.map((row) => ({
    id: row.id as string,
    customer_email: row.customer_email as string,
    customer_company_name: (row.customer_company_name as string | null) ?? null,
    coach_id: (row.coach_id as string | null) ?? null,
    amount_cents: row.amount_cents as number,
    currency: row.currency as string,
    status: row.status as string,
    description: (row.description as string | null) ?? null,
    paid_at: row.paid_at as string,
    billing_kind: billingIndex.get(row.id as string) ?? "other",
  }));
}

export async function GET(request: Request) {
  const check = await requireForecastAccess(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const settings = await loadSettings(check.userId);
    const payments = await loadForecastPayments();
    const directory = await loadCoachDirectory(supabaseAdmin);

    const { data: billingRows } = await supabaseAdmin
      .from("coaches")
      .select("id, recurring_payment_status");

    const billingById = new Map(
      (billingRows ?? []).map((row) => [
        row.id as string,
        (row.recurring_payment_status as string | null) ?? null,
      ])
    );

    const coachById = new Map(
      directory.coaches.map((coach) => [
        coach.id,
        {
          recurring_payment_status: billingById.get(coach.id) ?? null,
          full_name: coach.full_name,
          coach_business_name: coach.coach_business_name,
          email: coach.email,
        },
      ])
    );

    const forecast = buildCashFlowForecast({
      payments,
      coachById,
      openingBalanceCents: settings.openingBalanceCents,
      stripeBalanceCents: settings.stripeBalanceCents,
      stripeBalanceAsOf: settings.stripeBalanceAsOf,
      expenseRows: settings.expenseRows,
      excludedStreamKeys: settings.excludedStreamKeys,
      startMonday: settings.startMonday,
    });

    return NextResponse.json({
      settings,
      ...forecast,
      excludedStreamKeys: settings.excludedStreamKeys,
    });
  } catch (err) {
    console.error("GET /api/admin/cash-flow-forecast error:", err);
    return NextResponse.json({ error: "Unable to load forecast." }, { status: 500 });
  }
}

type PatchBody = {
  openingBalanceCents?: number;
  stripeBalanceCents?: number;
  stripeBalanceAsOf?: string | null;
  startMonday?: string | null;
  expenseRows?: ForecastExpenseRow[];
  excludedStreamKeys?: string[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: Request) {
  const check = await requireForecastAccess(request);
  if (check.error) {
    const status = check.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: check.error }, { status });
  }

  try {
    const body = (await request.json().catch(() => null)) as PatchBody | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const current = await loadSettings(check.userId);
    let openingBalanceCents =
      typeof body.openingBalanceCents === "number" &&
      Number.isFinite(body.openingBalanceCents) &&
      body.openingBalanceCents >= 0
        ? Math.round(body.openingBalanceCents)
        : current.openingBalanceCents;

    let stripeBalanceCents = current.stripeBalanceCents;
    let stripeBalanceAsOf = current.stripeBalanceAsOf;

    if (body.openingBalanceCents !== undefined) {
      stripeBalanceCents = 0;
      stripeBalanceAsOf = null;
    } else if (
      typeof body.stripeBalanceCents === "number" &&
      Number.isFinite(body.stripeBalanceCents) &&
      body.stripeBalanceCents >= 0
    ) {
      stripeBalanceCents = Math.round(body.stripeBalanceCents);
    }
    if (body.stripeBalanceAsOf === null) {
      stripeBalanceAsOf = null;
    } else if (typeof body.stripeBalanceAsOf === "string") {
      if (!ISO_DATE_RE.test(body.stripeBalanceAsOf)) {
        return NextResponse.json(
          { error: "stripeBalanceAsOf must be YYYY-MM-DD." },
          { status: 400 }
        );
      }
      stripeBalanceAsOf = body.stripeBalanceAsOf;
    } else if (
      body.stripeBalanceCents !== undefined &&
      stripeBalanceCents !== current.stripeBalanceCents
    ) {
      stripeBalanceAsOf = new Date().toISOString().slice(0, 10);
    }

    let startMonday = current.startMonday;
    if (body.startMonday === null) {
      startMonday = null;
    } else if (typeof body.startMonday === "string") {
      if (!isMondayIso(body.startMonday)) {
        return NextResponse.json(
          { error: "startMonday must be a Monday (YYYY-MM-DD)." },
          { status: 400 }
        );
      }
      startMonday = body.startMonday;
    }

    const expenseRows = body.expenseRows
      ? parseExpenseRows(body.expenseRows)
      : current.expenseRows;
    const excludedStreamKeys = body.excludedStreamKeys
      ? parseExcludedStreamKeys(body.excludedStreamKeys)
      : current.excludedStreamKeys;

    const { error } = await supabaseAdmin.from("cash_flow_forecast_settings").upsert(
      {
        user_id: check.userId,
        opening_balance_cents: openingBalanceCents,
        stripe_balance_cents: stripeBalanceCents,
        stripe_balance_as_of: stripeBalanceAsOf,
        start_monday: startMonday,
        expense_rows: expenseRows,
        excluded_stream_keys: excludedStreamKeys,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("PATCH cash_flow_forecast_settings error:", error);
      return NextResponse.json({ error: "Unable to save settings." }, { status: 500 });
    }

    return NextResponse.json({
      settings: {
        openingBalanceCents,
        stripeBalanceCents,
        stripeBalanceAsOf,
        startMonday,
        expenseRows,
        excludedStreamKeys,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/cash-flow-forecast error:", err);
    return NextResponse.json({ error: "Unable to save forecast." }, { status: 500 });
  }
}
