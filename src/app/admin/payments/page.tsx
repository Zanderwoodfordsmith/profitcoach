"use client";

import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { PaymentsMonthlyBarChart } from "@/components/admin/PaymentsMonthlyBarChart";
import { StickyPageHeader } from "@/components/layout";
import { DataTableColumnsMenu } from "@/components/table/DataTableColumnsMenu";
import { TableToolbarAddButton } from "@/components/table/TableToolbarAddButton";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { formatDateDisplay } from "@/lib/formatDateDisplay";
import { formatPersonName } from "@/lib/formatPersonName";
import { moveKeyInOrder } from "@/hooks/usePersistedColumnSettings";
import {
  buildPaymentBillingKindIndex,
  establishedCustomerPriorTotalCents,
  isProgrammeUpfrontAmount,
  paymentBillingKindBadgeClass,
  paymentBillingKindLabel,
  PAYMENT_BILLING_KINDS,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import {
  isRevolutTransferPlaceholderEmail,
  revolutTransferCustomerDisplayLabel,
} from "@/lib/revolutDirectPaymentsCsvImport";
import {
  inferInstallmentCount,
  ongoingPlanInstallmentCents,
} from "@/lib/cashFlowForecast/paymentPlanInference";
import { paymentSourceLabel } from "@/lib/paymentSource";
import { supabaseClient } from "@/lib/supabaseClient";

type CoachOption = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
  joined_at: string | null;
};

type PaymentRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_charge_id: string | null;
  customer_email: string;
  customer_company_name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string;
  assignment_method: string;
  decline_reason: string | null;
  description: string | null;
  notes: string | null;
  payment_source: string;
  billing_kind_override: PaymentBillingKind | null;
  matched: boolean;
  assigned_coach: CoachOption | null;
  suggested_coach: CoachOption | null;
};

type StatusFilter = "all" | "succeeded" | "failed" | "canceled" | "refunded";
type CoachAssignmentFilter = "all" | "assigned" | "unassigned";
type SourceFilter =
  | "all"
  | "stripe"
  | "stripe_stryv_us"
  | "revolut_merchant"
  | "revolut_direct";
type PaymentSort = "recent_first" | "oldest_first" | "customer_az";
type PaymentGroupBy = "none" | "coach";

type PaymentGroupUpfrontSummary = {
  succeededCentsByCurrency: Record<string, number>;
  expectedCentsByCurrency: Record<string, number>;
};

type PaymentGroupRecurringSummary = {
  succeededCentsByCurrency: Record<string, number>;
  paymentCountByCurrency: Record<string, number>;
};

type PaymentGroupSummary = {
  upfront: PaymentGroupUpfrontSummary;
  recurring: PaymentGroupRecurringSummary;
};

/** Known 6-month / programme upfront totals (minor units). */
const KNOWN_UPFRONT_PROGRAMME_TOTALS_CENTS: Record<string, number[]> = {
  gbp: [780_000, 960_000],
  usd: [780_000, 960_000],
};

type PaymentGroup = {
  key: string;
  label: string;
  payments: PaymentRowWithBilling[];
  summary: PaymentGroupSummary;
};

type PaymentRowWithBilling = PaymentRow & {
  billing_kind: PaymentBillingKind;
  inferred_billing_kind: PaymentBillingKind;
};

type PaymentTableColumnVisibility = {
  date: boolean;
  amount: boolean;
  status: boolean;
  billingKind: boolean;
  customer: boolean;
  company: boolean;
  source: boolean;
  declineReason: boolean;
  coach: boolean;
  suggested: boolean;
};

type PersistedPaymentTableSettings = {
  statusFilter: StatusFilter;
  sourceFilter: SourceFilter;
  coachAssignmentFilter: CoachAssignmentFilter;
  needsActionOnly: boolean;
  dateSort: PaymentSort;
  groupBy: PaymentGroupBy;
  columnVisibility: PaymentTableColumnVisibility;
  columnOrder: Array<keyof PaymentTableColumnVisibility>;
};

const PAYMENTS_TABLE_SETTINGS_STORAGE_KEY = "admin-payments-table-settings-v1";

const DEFAULT_PAYMENT_TABLE_COLUMNS: PaymentTableColumnVisibility = {
  date: true,
  amount: true,
  status: true,
  billingKind: true,
  customer: true,
  company: false,
  source: false,
  declineReason: false,
  coach: true,
  suggested: false,
};

const PAYMENT_TABLE_COLUMN_OPTIONS: Array<{
  key: keyof PaymentTableColumnVisibility;
  label: string;
}> = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "billingKind", label: "Billing" },
  { key: "customer", label: "Customer" },
  { key: "company", label: "Company" },
  { key: "source", label: "Source" },
  { key: "declineReason", label: "Decline reason" },
  { key: "coach", label: "Coach" },
  { key: "suggested", label: "Suggested" },
];

const PAYMENT_TABLE_COLUMN_OPTION_BY_KEY = new Map(
  PAYMENT_TABLE_COLUMN_OPTIONS.map((option) => [option.key, option] as const)
);
const PAYMENT_TABLE_COLUMN_KEYS = PAYMENT_TABLE_COLUMN_OPTIONS.map(
  (option) => option.key
);

/** Fixed width so every billing dropdown matches (incl. "Recurring *"). */
const BILLING_COLUMN_WIDTH_CLASS = "w-[7.75rem]";

function isStatusFilter(value: unknown): value is StatusFilter {
  return (
    value === "all" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "canceled" ||
    value === "refunded"
  );
}

function isSourceFilter(value: unknown): value is SourceFilter {
  return (
    value === "all" ||
    value === "stripe" ||
    value === "stripe_stryv_us" ||
    value === "revolut_merchant" ||
    value === "revolut_direct"
  );
}

function normalizeCoachAssignmentFilter(value: unknown): CoachAssignmentFilter {
  if (value === "assigned" || value === "matched") return "assigned";
  if (value === "unassigned" || value === "unmatched") return "unassigned";
  return "all";
}

function isCoachAssignmentFilter(value: unknown): value is CoachAssignmentFilter {
  return value === "all" || value === "assigned" || value === "unassigned";
}

function isPaymentSort(value: unknown): value is PaymentSort {
  return (
    value === "recent_first" ||
    value === "oldest_first" ||
    value === "customer_az"
  );
}

function isPaymentGroupBy(value: unknown): value is PaymentGroupBy {
  return value === "none" || value === "coach";
}

function addCentsToCurrencyMap(
  map: Record<string, number>,
  currency: string,
  cents: number
): void {
  const key = currency.trim().toLowerCase() || "gbp";
  map[key] = (map[key] ?? 0) + cents;
}

function isRecurringGroupPayment(payment: PaymentRowWithBilling): boolean {
  return payment.billing_kind === "recurring";
}

function formatGroupPaymentCount(payments: PaymentRowWithBilling[]): string {
  let upfrontCount = 0;
  let recurringCount = 0;

  for (const payment of payments) {
    if (isRecurringGroupPayment(payment)) {
      recurringCount += 1;
    } else {
      upfrontCount += 1;
    }
  }

  const parts: string[] = [];
  if (upfrontCount > 0) {
    parts.push(
      `${upfrontCount} payment${upfrontCount === 1 ? "" : "s"}`
    );
  }
  if (recurringCount > 0) {
    parts.push(`${recurringCount} recurring`);
  }

  return parts.join(", ") || "0 payments";
}

function applyProgrammePlanExpected(
  upfrontPayments: PaymentRowWithBilling[],
  expectedCentsByCurrency: Record<string, number>
): void {
  const currencies = new Set(
    upfrontPayments.map(
      (payment) => payment.currency.trim().toLowerCase() || "gbp"
    )
  );

  for (const currency of currencies) {
    const currencyPayments = upfrontPayments.filter(
      (payment) =>
        (payment.currency.trim().toLowerCase() || "gbp") === currency
    );
    const programmeTotalCents = establishedCustomerPriorTotalCents(currency);
    const hasElevateInstallment = currencyPayments.some((payment) =>
      isProgrammeUpfrontAmount(payment.amount_cents, payment.currency)
    );
    const allPaymentsTotalCents = currencyPayments.reduce(
      (sum, payment) => sum + payment.amount_cents,
      0
    );
    const succeededTotalCents = currencyPayments
      .filter((payment) => payment.status === "succeeded")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);

    if (
      hasElevateInstallment ||
      allPaymentsTotalCents === programmeTotalCents ||
      succeededTotalCents === programmeTotalCents
    ) {
      expectedCentsByCurrency[currency] = programmeTotalCents;
    }
  }
}

function applyKnownUpfrontProgrammeTotals(
  upfrontPayments: PaymentRowWithBilling[],
  expectedCentsByCurrency: Record<string, number>
): void {
  const currencies = new Set(
    upfrontPayments.map(
      (payment) => payment.currency.trim().toLowerCase() || "gbp"
    )
  );

  for (const currency of currencies) {
    const currencyPayments = upfrontPayments.filter(
      (payment) =>
        (payment.currency.trim().toLowerCase() || "gbp") === currency
    );
    const knownTotals = KNOWN_UPFRONT_PROGRAMME_TOTALS_CENTS[currency] ?? [];

    for (const totalCents of knownTotals) {
      const hasMatchingPayment = currencyPayments.some(
        (payment) =>
          payment.status === "succeeded" && payment.amount_cents === totalCents
      );
      if (hasMatchingPayment) {
        expectedCentsByCurrency[currency] = totalCents;
        break;
      }
    }
  }
}

function computeUpfrontSummary(
  upfrontPayments: PaymentRowWithBilling[]
): PaymentGroupUpfrontSummary {
  const succeededCentsByCurrency: Record<string, number> = {};
  const expectedCentsByCurrency: Record<string, number> = {};

  for (const payment of upfrontPayments) {
    if (payment.status === "succeeded") {
      addCentsToCurrencyMap(
        succeededCentsByCurrency,
        payment.currency,
        payment.amount_cents
      );
    }
  }

  const succeededInstallments = upfrontPayments.filter(
    (payment) =>
      payment.status === "succeeded" && payment.billing_kind === "installment"
  );

  if (succeededInstallments.length > 0) {
    const installmentAmountsByCurrency = new Map<string, number[]>();
    for (const payment of succeededInstallments) {
      const currency = payment.currency.trim().toLowerCase() || "gbp";
      const amounts = installmentAmountsByCurrency.get(currency) ?? [];
      amounts.push(payment.amount_cents);
      installmentAmountsByCurrency.set(currency, amounts);
    }

    for (const [currency, amounts] of installmentAmountsByCurrency) {
      const ongoing = ongoingPlanInstallmentCents(amounts);
      if (ongoing > 0) {
        const installmentCount = inferInstallmentCount(ongoing, amounts.length);
        addCentsToCurrencyMap(
          expectedCentsByCurrency,
          currency,
          ongoing * installmentCount
        );
      }
    }
  }

  applyKnownUpfrontProgrammeTotals(upfrontPayments, expectedCentsByCurrency);
  applyProgrammePlanExpected(upfrontPayments, expectedCentsByCurrency);

  if (Object.keys(expectedCentsByCurrency).length === 0) {
    for (const payment of upfrontPayments) {
      addCentsToCurrencyMap(
        expectedCentsByCurrency,
        payment.currency,
        payment.amount_cents
      );
    }
  }

  for (const [currency, paid] of Object.entries(succeededCentsByCurrency)) {
    const expected = expectedCentsByCurrency[currency] ?? 0;
    if (expected > 0 && paid > expected) {
      expectedCentsByCurrency[currency] = paid;
    }
  }

  return { succeededCentsByCurrency, expectedCentsByCurrency };
}

function computeRecurringSummary(
  recurringPayments: PaymentRowWithBilling[]
): PaymentGroupRecurringSummary {
  const succeededCentsByCurrency: Record<string, number> = {};
  const paymentCountByCurrency: Record<string, number> = {};

  for (const payment of recurringPayments) {
    if (payment.status !== "succeeded") continue;
    const currency = payment.currency.trim().toLowerCase() || "gbp";
    addCentsToCurrencyMap(
      succeededCentsByCurrency,
      payment.currency,
      payment.amount_cents
    );
    paymentCountByCurrency[currency] =
      (paymentCountByCurrency[currency] ?? 0) + 1;
  }

  return { succeededCentsByCurrency, paymentCountByCurrency };
}

function computeGroupPaymentSummary(
  payments: PaymentRowWithBilling[]
): PaymentGroupSummary {
  const upfrontPayments = payments.filter(
    (payment) => !isRecurringGroupPayment(payment)
  );
  const recurringPayments = payments.filter(isRecurringGroupPayment);

  return {
    upfront: computeUpfrontSummary(upfrontPayments),
    recurring: computeRecurringSummary(recurringPayments),
  };
}

type PaymentGroupUpfrontProgressRow = {
  kind: "upfront";
  currency: string;
  paidCents: number;
  expectedCents: number;
  percent: number;
};

type PaymentGroupRecurringProgressRow = {
  kind: "recurring";
  currency: string;
  paidCents: number;
  paymentCount: number;
};

type PaymentGroupCurrencyProgress = {
  currency: string;
  upfront: PaymentGroupUpfrontProgressRow | null;
  recurring: PaymentGroupRecurringProgressRow | null;
};

function getGroupCurrencyProgress(
  summary: PaymentGroupSummary
): PaymentGroupCurrencyProgress[] {
  const currencies = [
    ...new Set([
      ...Object.keys(summary.upfront.succeededCentsByCurrency),
      ...Object.keys(summary.upfront.expectedCentsByCurrency),
      ...Object.keys(summary.recurring.succeededCentsByCurrency),
    ]),
  ].sort();

  return currencies
    .map((currency) => {
      const paidCents = summary.upfront.succeededCentsByCurrency[currency] ?? 0;
      const expectedCents =
        summary.upfront.expectedCentsByCurrency[currency] ?? 0;
      const recurringPaid =
        summary.recurring.succeededCentsByCurrency[currency] ?? 0;
      const recurringCount =
        summary.recurring.paymentCountByCurrency[currency] ?? 0;

      let upfront: PaymentGroupUpfrontProgressRow | null = null;
      if (paidCents > 0 || expectedCents > 0) {
        const targetCents = Math.max(expectedCents, paidCents, 1);
        upfront = {
          kind: "upfront",
          currency,
          paidCents,
          expectedCents: Math.max(expectedCents, paidCents),
          percent: Math.min(100, (paidCents / targetCents) * 100),
        };
      }

      const recurring =
        recurringPaid > 0
          ? {
              kind: "recurring" as const,
              currency,
              paidCents: recurringPaid,
              paymentCount: recurringCount,
            }
          : null;

      if (!upfront && !recurring) return null;

      return { currency, upfront, recurring };
    })
    .filter((row): row is PaymentGroupCurrencyProgress => row !== null);
}

const PAYMENT_GROUP_UPFRONT_COLUMN_CLASS = "w-[6.75rem] shrink-0 sm:w-[7.25rem]";
const PAYMENT_GROUP_RECURRING_COLUMN_CLASS = "w-[6.75rem] shrink-0 sm:w-[7.25rem]";

function PaymentGroupUpfrontColumn({
  currency,
  upfront,
}: {
  currency: string;
  upfront: PaymentGroupUpfrontProgressRow;
}) {
  return (
    <div className={PAYMENT_GROUP_UPFRONT_COLUMN_CLASS}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-slate-200/80"
        role="progressbar"
        aria-valuenow={Math.round(upfront.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatMoney(upfront.paidCents, currency)} paid of ${formatMoney(upfront.expectedCents, currency)}`}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${upfront.percent}%` }}
        />
      </div>
      <p className="mt-0.5 truncate text-right text-[10px] font-medium normal-case tracking-normal text-slate-600">
        {formatMoney(upfront.paidCents, currency)}
        <span className="text-slate-400">
          {" "}
          of {formatMoney(upfront.expectedCents, currency)}
        </span>
      </p>
    </div>
  );
}

function PaymentGroupRecurringColumn({
  currency,
  recurring,
}: {
  currency: string;
  recurring: PaymentGroupRecurringProgressRow;
}) {
  return (
    <div className={PAYMENT_GROUP_RECURRING_COLUMN_CLASS}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100 ring-1 ring-sky-200/90"
        role="img"
        aria-label={`${formatMoney(recurring.paidCents, currency)} recurring across ${recurring.paymentCount} payments`}
      >
        <div className="h-full w-full rounded-full bg-sky-400/90" />
      </div>
      <p className="mt-0.5 truncate text-right text-[10px] font-medium normal-case tracking-normal text-sky-700">
        {formatMoney(recurring.paidCents, currency)}
        <span className="text-sky-500/80">
          {" "}
          recurring · {recurring.paymentCount}
        </span>
      </p>
    </div>
  );
}

function PaymentGroupProgress({ summary }: { summary: PaymentGroupSummary }) {
  const currencyProgress = getGroupCurrencyProgress(summary);
  if (currencyProgress.length === 0) return null;

  return (
    <div className="ml-auto flex shrink-0 flex-col gap-1.5">
      {currencyProgress.map(({ currency, upfront, recurring }) => (
        <div
          key={currency}
          className="grid grid-cols-[6.75rem_6.75rem] items-start gap-x-3 sm:grid-cols-[7.25rem_7.25rem]"
        >
          <div className={PAYMENT_GROUP_UPFRONT_COLUMN_CLASS}>
            {upfront ? (
              <PaymentGroupUpfrontColumn currency={currency} upfront={upfront} />
            ) : null}
          </div>
          <div className={PAYMENT_GROUP_RECURRING_COLUMN_CLASS}>
            {recurring ? (
              <PaymentGroupRecurringColumn
                currency={currency}
                recurring={recurring}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildPaymentGroups(
  payments: PaymentRowWithBilling[],
  groupBy: PaymentGroupBy
): PaymentGroup[] {
  if (groupBy === "none") {
    return [
      {
        key: "__all__",
        label: "",
        payments,
        summary: computeGroupPaymentSummary(payments),
      },
    ];
  }

  const byCoach = new Map<string, PaymentRowWithBilling[]>();
  for (const payment of payments) {
    const key = payment.assigned_coach?.id ?? "__unassigned__";
    const list = byCoach.get(key) ?? [];
    list.push(payment);
    byCoach.set(key, list);
  }

  const groups: PaymentGroup[] = [];
  const coachIds = [...byCoach.keys()].filter((k) => k !== "__unassigned__");
  coachIds.sort((a, b) => {
    const coachA = byCoach.get(a)?.[0]?.assigned_coach;
    const coachB = byCoach.get(b)?.[0]?.assigned_coach;
    const labelA = coachA ? coachLabel(coachA) : a;
    const labelB = coachB ? coachLabel(coachB) : b;
    return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
  });

  for (const coachId of coachIds) {
    const groupPayments = byCoach.get(coachId) ?? [];
    const coach = groupPayments[0]?.assigned_coach;
    groups.push({
      key: coachId,
      label: coach ? coachLabel(coach) : coachId,
      payments: groupPayments,
      summary: computeGroupPaymentSummary(groupPayments),
    });
  }

  const unassigned = byCoach.get("__unassigned__");
  if (unassigned?.length) {
    groups.push({
      key: "__unassigned__",
      label: "Unassigned",
      payments: unassigned,
      summary: computeGroupPaymentSummary(unassigned),
    });
  }

  return groups;
}

function parsePersistedPaymentTableSettings(
  raw: string
): PersistedPaymentTableSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPaymentTableSettings>;
    if (
      !parsed ||
      !isStatusFilter(parsed.statusFilter) ||
      !isSourceFilter(parsed.sourceFilter) ||
      typeof parsed.needsActionOnly !== "boolean" ||
      !isPaymentSort(parsed.dateSort) ||
      !parsed.columnVisibility ||
      !parsed.columnOrder
    ) {
      return null;
    }

    const visibility = PAYMENT_TABLE_COLUMN_KEYS.reduce((acc, key) => {
      const rawValue = parsed.columnVisibility?.[key];
      acc[key] =
        typeof rawValue === "boolean"
          ? rawValue
          : DEFAULT_PAYMENT_TABLE_COLUMNS[key];
      return acc;
    }, {} as PaymentTableColumnVisibility);

    const legacy = parsed as {
      matchedFilter?: unknown;
      coachAssignmentFilter?: unknown;
    };
    const coachAssignmentFilter = isCoachAssignmentFilter(
      legacy.coachAssignmentFilter
    )
      ? legacy.coachAssignmentFilter
      : normalizeCoachAssignmentFilter(legacy.matchedFilter);

    const seen = new Set<keyof PaymentTableColumnVisibility>();
    const orderedKeys: Array<keyof PaymentTableColumnVisibility> = [];
    for (const rawKey of parsed.columnOrder as string[]) {
      if (rawKey === "matched") continue;
      const key = rawKey as keyof PaymentTableColumnVisibility;
      if (PAYMENT_TABLE_COLUMN_OPTION_BY_KEY.has(key) && !seen.has(key)) {
        seen.add(key);
        orderedKeys.push(key);
      }
    }
    for (const key of PAYMENT_TABLE_COLUMN_KEYS) {
      if (!seen.has(key)) orderedKeys.push(key);
    }

    return {
      statusFilter: parsed.statusFilter,
      sourceFilter: parsed.sourceFilter,
      coachAssignmentFilter,
      needsActionOnly: parsed.needsActionOnly,
      dateSort: parsed.dateSort,
      groupBy: isPaymentGroupBy(parsed.groupBy) ? parsed.groupBy : "none",
      columnVisibility: visibility,
      columnOrder: orderedKeys,
    };
  } catch {
    return null;
  }
}

function formatMoney(amountCents: number, currency: string): string {
  const code = currency.toUpperCase();
  const locale = code === "USD" ? "en-US" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function formatPaymentDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const date = new Date(parsed);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  }).format(date);
}

function coachLabel(coach: CoachOption): string {
  const formatted = formatPersonName(coach.full_name);
  return formatted || coach.slug;
}

function formatJoinDate(value: string | null): string | null {
  if (!value) return null;
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateDisplay(date);
}

function coachOptionLabel(coach: CoachOption): string {
  const name = coachLabel(coach);
  const joinDate = formatJoinDate(coach.joined_at);
  return joinDate ? `${name} (${joinDate})` : name;
}

function statusLabel(status: string): string {
  switch (status) {
    case "succeeded":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "refunded":
      return "Refunded";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    case "canceled":
      return "bg-amber-100 text-amber-900";
    case "refunded":
      return "bg-slate-200 text-slate-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const filtersMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("gbp");
  const [paidAt, setPaidAt] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [notes, setNotes] = useState("");
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [importingCsv, setImportingCsv] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<string | null>(null);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [coachAssignmentFilter, setCoachAssignmentFilter] =
    useState<CoachAssignmentFilter>("all");
  const [coachAssignPaymentId, setCoachAssignPaymentId] = useState<string | null>(
    null
  );
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [paymentSort, setPaymentSort] = useState<PaymentSort>("recent_first");
  const [paymentGroupBy, setPaymentGroupBy] = useState<PaymentGroupBy>("none");
  const [expandedPaymentGroups, setExpandedPaymentGroups] = useState<
    Set<string>
  >(() => new Set());

  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [draggingColumnKey, setDraggingColumnKey] =
    useState<keyof PaymentTableColumnVisibility | null>(null);
  const [columnVisibility, setColumnVisibility] =
    useState<PaymentTableColumnVisibility>(DEFAULT_PAYMENT_TABLE_COLUMNS);
  const [columnOrder, setColumnOrder] = useState<
    Array<keyof PaymentTableColumnVisibility>
  >(PAYMENT_TABLE_COLUMN_OPTIONS.map((option) => option.key));
  const [hasLoadedPersistedSettings, setHasLoadedPersistedSettings] =
    useState(false);

  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [assignmentNotice, setAssignmentNotice] = useState<string | null>(null);
  const [savingBillingId, setSavingBillingId] = useState<string | null>(null);

  const coachOptions = useMemo(
    () =>
      [...coaches]
        .sort((a, b) =>
          coachLabel(a).localeCompare(coachLabel(b), undefined, {
            sensitivity: "base",
          })
        )
        .map((coach) => ({
          value: coach.id,
          label: coachOptionLabel(coach),
        })),
    [coaches]
  );

  const paymentsWithBilling = useMemo((): PaymentRowWithBilling[] => {
    const forBilling = (payment: PaymentRow) => ({
      id: payment.id,
      customer_email: payment.customer_email,
      coach_id: payment.assigned_coach?.id ?? null,
      amount_cents: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      paid_at: payment.paid_at,
      billing_kind_override: payment.billing_kind_override,
    });

    const inferredById = buildPaymentBillingKindIndex(
      payments.map((payment) => ({
        ...forBilling(payment),
        billing_kind_override: null,
      }))
    );
    const resolvedById = buildPaymentBillingKindIndex(payments.map(forBilling));
    return payments.map((payment) => ({
      ...payment,
      inferred_billing_kind: inferredById.get(payment.id) ?? "other",
      billing_kind: resolvedById.get(payment.id) ?? "other",
    }));
  }, [payments]);

  const chartPayments = useMemo(
    () =>
      paymentsWithBilling.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        paid_at: payment.paid_at,
        billing_kind: payment.billing_kind,
        coach_name: payment.assigned_coach
          ? coachLabel(payment.assigned_coach)
          : payment.suggested_coach
            ? `${coachLabel(payment.suggested_coach)} (suggested)`
            : "Unassigned",
      })),
    [paymentsWithBilling]
  );

  const filteredPayments = useMemo(() => {
    let rows = paymentsWithBilling;

    if (statusFilter !== "all") {
      rows = rows.filter((payment) => payment.status === statusFilter);
    }

    if (sourceFilter !== "all") {
      rows = rows.filter((payment) => payment.payment_source === sourceFilter);
    }

    if (coachAssignmentFilter === "assigned") {
      rows = rows.filter((payment) => payment.assigned_coach);
    } else if (coachAssignmentFilter === "unassigned") {
      rows = rows.filter((payment) => !payment.assigned_coach);
    }

    if (needsActionOnly) {
      rows = rows.filter(
        (payment) =>
          !payment.assigned_coach &&
          (payment.status === "failed" || payment.status === "canceled")
      );
    }

    return [...rows].sort((a, b) => {
      if (paymentSort === "customer_az") {
        return a.customer_email.localeCompare(b.customer_email, undefined, {
          sensitivity: "base",
        });
      }
      const aTime = Date.parse(a.paid_at);
      const bTime = Date.parse(b.paid_at);
      if (paymentSort === "oldest_first") {
        return aTime - bTime;
      }
      return bTime - aTime;
    });
  }, [
    paymentsWithBilling,
    statusFilter,
    sourceFilter,
    coachAssignmentFilter,
    needsActionOnly,
    paymentSort,
  ]);

  const groupedPayments = useMemo(
    () => buildPaymentGroups(filteredPayments, paymentGroupBy),
    [filteredPayments, paymentGroupBy]
  );

  function togglePaymentGroup(groupKey: string) {
    setExpandedPaymentGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  useEffect(() => {
    if (paymentGroupBy === "coach") {
      setExpandedPaymentGroups(new Set());
    }
  }, [paymentGroupBy]);

  const stats = useMemo(() => {
    const failed = payments.filter((p) => p.status === "failed").length;
    const unassigned = payments.filter((p) => !p.assigned_coach).length;
    const needsAction = payments.filter(
      (p) =>
        !p.assigned_coach &&
        (p.status === "failed" || p.status === "canceled")
    ).length;
    return { total: payments.length, failed, unassigned, needsAction };
  }, [payments]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (coachAssignmentFilter !== "all" ? 1 : 0) +
    (needsActionOnly ? 1 : 0);

  const orderedColumnOptions = columnOrder
    .map((key) => PAYMENT_TABLE_COLUMN_OPTION_BY_KEY.get(key))
    .filter(
      (option): option is { key: keyof PaymentTableColumnVisibility; label: string } =>
        Boolean(option)
    );
  const shownColumnOptions = orderedColumnOptions.filter(
    ({ key }) => columnVisibility[key]
  );
  const hiddenColumnOptions = orderedColumnOptions.filter(
    ({ key }) => !columnVisibility[key]
  );
  const visibleDataColumnCount = PAYMENT_TABLE_COLUMN_OPTIONS.reduce(
    (n, { key }) => n + (columnVisibility[key] ? 1 : 0),
    0
  );
  const tableColSpan = visibleDataColumnCount + 1;

  useEffect(() => {
    if (!columnsMenuOpen && !filtersMenuOpen && !sortMenuOpen && !groupMenuOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        columnsMenuRef.current &&
        columnsMenuRef.current.contains(target)
      ) {
        return;
      }
      if (
        filtersMenuRef.current &&
        filtersMenuRef.current.contains(target)
      ) {
        return;
      }
      if (sortMenuRef.current && sortMenuRef.current.contains(target)) {
        return;
      }
      if (groupMenuRef.current && groupMenuRef.current.contains(target)) {
        return;
      }
      setColumnsMenuOpen(false);
      setFiltersMenuOpen(false);
      setSortMenuOpen(false);
      setGroupMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen, filtersMenuOpen, sortMenuOpen, groupMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PAYMENTS_TABLE_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = parsePersistedPaymentTableSettings(raw);
      if (parsed) {
        setStatusFilter(parsed.statusFilter);
        setSourceFilter(parsed.sourceFilter);
        setCoachAssignmentFilter(parsed.coachAssignmentFilter);
        setNeedsActionOnly(parsed.needsActionOnly);
        setPaymentSort(parsed.dateSort);
        setPaymentGroupBy(parsed.groupBy);
        setColumnVisibility(parsed.columnVisibility);
        setColumnOrder(parsed.columnOrder);
      }
    }
    setHasLoadedPersistedSettings(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedSettings || typeof window === "undefined") return;
    const payload: PersistedPaymentTableSettings = {
      statusFilter,
      sourceFilter,
      coachAssignmentFilter,
      needsActionOnly,
      dateSort: paymentSort,
      groupBy: paymentGroupBy,
      columnVisibility,
      columnOrder,
    };
    window.localStorage.setItem(
      PAYMENTS_TABLE_SETTINGS_STORAGE_KEY,
      JSON.stringify(payload)
    );
  }, [
    hasLoadedPersistedSettings,
    statusFilter,
    sourceFilter,
    coachAssignmentFilter,
    needsActionOnly,
    paymentSort,
    paymentGroupBy,
    columnVisibility,
    columnOrder,
  ]);

  function moveColumnInOrder(
    draggedKey: keyof PaymentTableColumnVisibility,
    targetKey: keyof PaymentTableColumnVisibility
  ) {
    setColumnOrder((prev) => moveKeyInOrder(prev, draggedKey, targetKey));
  }

  async function loadPayments() {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("Unable to load payments.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/payments", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const body = (await res.json().catch(() => ({}))) as {
      payments?: PaymentRow[];
      coaches?: CoachOption[];
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Unable to load payments.");
      setLoading(false);
      return;
    }
    const loadedPayments = body.payments ?? [];
    setPayments(loadedPayments);
    setCoaches(body.coaches ?? []);
    setAssignmentDrafts(
      Object.fromEntries(
        loadedPayments.map((payment) => [payment.id, payment.assigned_coach?.id ?? ""])
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setCheckingRole(true);
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        if (!cancelled) {
          setError("Unable to load your profile.");
          setCheckingRole(false);
          setLoading(false);
        }
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      if (cancelled) return;
      setCheckingRole(false);
      await loadPayments();
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleDeletePayment(payment: PaymentRow) {
    const amountLabel = formatMoney(payment.amount_cents, payment.currency);
    const dateLabel = formatPaymentDate(payment.paid_at);
    if (
      !confirm(
        `Delete payment for ${payment.customer_email} (${amountLabel}, ${dateLabel})? This cannot be undone.`
      )
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in.");
      return;
    }

    setDeletingId(payment.id);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to delete payment.");
      }
      await loadPayments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function saveBillingOverride(
    paymentId: string,
    billingKindOverride: PaymentBillingKind | null
  ) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in.");
      return;
    }

    setSavingBillingId(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ billingKindOverride }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to update billing.");
      }
      await loadPayments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBillingId(null);
    }
  }

  async function saveAssignment(paymentId: string, coachId: string | null) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in.");
      return;
    }

    setSavingId(paymentId);
    setAssignmentNotice(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ coachId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        updatedCount?: number;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to update assignment.");
      }
      if (coachId && (body.updatedCount ?? 0) > 1) {
        setAssignmentNotice(
          `Assigned ${body.updatedCount} payments for that customer email.`
        );
      }
      await loadPayments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleCsvImport(file: File) {
    setCsvImportError(null);
    setCsvImportResult(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setCsvImportError("You must be signed in.");
      return;
    }

    setImportingCsv(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/payments/import-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        summary?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "CSV import failed.");
      }

      setCsvImportResult(body.summary ?? "Import complete.");
      await loadPayments();
    } catch (e) {
      setCsvImportError((e as Error).message);
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = "";
      }
    }
  }

  async function handleCreatePayment(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const amountNumber = Number.parseFloat(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setCreateError("Amount must be greater than zero.");
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setCreateError("You must be signed in.");
      return;
    }

    setCreatingPayment(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          customerEmail,
          amount: amountNumber,
          currency,
          paidAt: paidAt || undefined,
          coachId: selectedCoachId || null,
          notes,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to create payment.");
      }

      setCustomerEmail("");
      setAmount("");
      setCurrency("gbp");
      setPaidAt("");
      setSelectedCoachId("");
      setNotes("");
      setShowAddPayment(false);
      await loadPayments();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreatingPayment(false);
    }
  }

  function renderColumnHeader(key: keyof PaymentTableColumnVisibility) {
    const label =
      PAYMENT_TABLE_COLUMN_OPTION_BY_KEY.get(key)?.label ?? key;
    const alignRight = key === "amount";
    const customerWidth = key === "customer" ? "max-w-[20.7rem] w-[20.7rem]" : "";
    const billingWidth = key === "billingKind" ? BILLING_COLUMN_WIDTH_CLASS : "";
    return (
      <th
        key={key}
        className={`bg-slate-50 px-3 py-2 ${alignRight ? "text-right" : ""} ${customerWidth} ${billingWidth}`}
      >
        {label}
      </th>
    );
  }

  function renderColumnCell(
    key: keyof PaymentTableColumnVisibility,
    payment: PaymentRowWithBilling
  ) {
    switch (key) {
      case "date":
        return (
          <td key={key} className="whitespace-nowrap px-3 py-2 text-slate-700">
            {formatPaymentDate(payment.paid_at)}
          </td>
        );
      case "amount":
        return (
          <td
            key={key}
            className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-900"
          >
            {formatMoney(payment.amount_cents, payment.currency)}
          </td>
        );
      case "status":
        return (
          <td key={key} className="px-3 py-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(payment.status)}`}
            >
              {statusLabel(payment.status)}
            </span>
          </td>
        );
      case "billingKind": {
        const inferredLabel = paymentBillingKindLabel(
          payment.inferred_billing_kind
        );

        return (
          <td
            key={key}
            className={`whitespace-nowrap px-3 py-2 ${BILLING_COLUMN_WIDTH_CLASS}`}
          >
            {payment.status === "succeeded" ? (
              <select
                value={payment.billing_kind}
                disabled={savingBillingId === payment.id}
                onChange={(e) => {
                  const selected = e.target.value as PaymentBillingKind;
                  const override =
                    selected === payment.inferred_billing_kind ? null : selected;
                  void saveBillingOverride(payment.id, override);
                }}
                className={`block w-full rounded-md border border-slate-300 px-1.5 py-1 text-xs font-medium ${paymentBillingKindBadgeClass(payment.billing_kind)}`}
                title={
                  payment.billing_kind_override
                    ? `Adjusted (would otherwise be ${inferredLabel})`
                    : undefined
                }
                aria-label={`Billing for payment ${payment.id}`}
              >
                {PAYMENT_BILLING_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {paymentBillingKindLabel(kind)}
                    {payment.billing_kind_override &&
                    payment.billing_kind === kind
                      ? " *"
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block w-full text-center text-slate-400">—</span>
            )}
          </td>
        );
      }
      case "customer":
        return (
          <td key={key} className="max-w-[20.7rem] px-3 py-2 text-slate-800">
            <div className="min-w-0">
              <div
                className="truncate font-medium"
                title={revolutTransferCustomerDisplayLabel(payment)}
              >
                {revolutTransferCustomerDisplayLabel(payment)}
              </div>
              {payment.payment_source !== "revolut_direct" ||
              !isRevolutTransferPlaceholderEmail(payment.customer_email)
                ? payment.description && (
                    <div
                      className="mt-0.5 truncate text-xs text-slate-500"
                      title={payment.description}
                    >
                      {payment.description}
                    </div>
                  )
                : null}
            </div>
          </td>
        );
      case "company":
        return (
          <td key={key} className="px-3 py-2 text-slate-700">
            {payment.customer_company_name ?? (
              <span className="text-slate-400">—</span>
            )}
          </td>
        );
      case "source":
        return (
          <td key={key} className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
            {paymentSourceLabel(payment.payment_source)}
          </td>
        );
      case "declineReason":
        return (
          <td key={key} className="max-w-[12rem] px-3 py-2 text-xs text-slate-600">
            {payment.decline_reason ?? <span className="text-slate-400">—</span>}
          </td>
        );
      case "coach": {
        const assigned = payment.assigned_coach;
        const editing = coachAssignPaymentId === payment.id;
        const coachSelect = (
          compact: boolean,
          onClose?: () => void
        ) => (
          <select
            value={assignmentDrafts[payment.id] ?? ""}
            autoFocus={!compact}
            onChange={(e) => {
              const coachId = e.target.value;
              setAssignmentDrafts((prev) => ({
                ...prev,
                [payment.id]: coachId,
              }));
              void saveAssignment(payment.id, coachId || null);
              setCoachAssignPaymentId(null);
            }}
            onBlur={() => {
              onClose?.();
              setCoachAssignPaymentId(null);
            }}
            disabled={savingId === payment.id || deletingId === payment.id}
            className={
              compact
                ? "absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
                : "max-w-[14rem] rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-wait disabled:opacity-60"
            }
            aria-label={`Assign coach for ${payment.customer_email}`}
          >
            <option value="">Unassigned</option>
            {coachOptions.map((coach) => (
              <option key={coach.value} value={coach.value}>
                {coach.label}
              </option>
            ))}
          </select>
        );

        if (assigned && !editing) {
          return (
            <td key={key} className="px-3 py-2 text-slate-800">
              <button
                type="button"
                onClick={() => setCoachAssignPaymentId(payment.id)}
                className="max-w-[14rem] truncate text-left hover:text-sky-700"
                title="Change coach"
              >
                {coachLabel(assigned)}
              </button>
            </td>
          );
        }

        if (assigned && editing) {
          return (
            <td key={key} className="px-3 py-2">
              {coachSelect(false)}
            </td>
          );
        }

        return (
          <td key={key} className="px-3 py-2">
            <div className="inline-flex items-center gap-0.5 text-sm text-slate-400">
              <span>Unassigned</span>
              <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100">
                {coachSelect(true)}
                <ChevronDown
                  className="pointer-events-none h-3.5 w-3.5 text-slate-500"
                  aria-hidden
                />
              </span>
            </div>
          </td>
        );
      }
      case "suggested":
        return (
          <td key={key} className="px-3 py-2 text-slate-700">
            {payment.suggested_coach ? (
              coachLabel(payment.suggested_coach)
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader title="Payments" tabs={<CoachesHubTabs />} />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {csvImportError ? <p className="text-sm text-rose-600">{csvImportError}</p> : null}
      {csvImportResult ? (
        <p className="text-sm text-emerald-700">{csvImportResult}</p>
      ) : null}
      {assignmentNotice ? (
        <p className="text-sm text-emerald-700">{assignmentNotice}</p>
      ) : null}

      <PaymentsMonthlyBarChart
        payments={chartPayments}
        loading={loading || checkingRole}
      />

      {showAddPayment ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Add payment</h2>
              <p className="mt-1 text-xs text-slate-600">
                Manual entry when a payment is not in a CSV export.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddPayment(false);
                setCreateError(null);
              }}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <form onSubmit={handleCreatePayment} className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-email">
                Customer email
              </label>
              <input
                id="payment-email"
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-amount">
                Amount
              </label>
              <input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-currency">
                Currency
              </label>
              <input
                id="payment-currency"
                type="text"
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-date">
                Paid at (optional)
              </label>
              <input
                id="payment-date"
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-coach">
                Assign coach (optional)
              </label>
              <select
                id="payment-coach"
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Auto-match by email</option>
                {coachOptions.map((coach) => (
                  <option key={coach.value} value={coach.value}>
                    {coach.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-700" htmlFor="payment-notes">
                Notes (optional)
              </label>
              <input
                id="payment-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center justify-between gap-3 md:col-span-3">
              {createError ? <p className="text-xs text-rose-600">{createError}</p> : <span />}
              <button
                type="submit"
                disabled={creatingPayment}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
              >
                {creatingPayment ? "Saving…" : "Add payment"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section
        className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        style={{ maxHeight: "calc(100dvh - 11rem)" }}
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="ml-auto flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-500">
              {filteredPayments.length} of {stats.total}
              {stats.needsAction > 0 ? ` · ${stats.needsAction} need action` : ""}
            </p>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvImport(file);
              }}
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={importingCsv || checkingRole}
              title="Upload CSV"
              className="inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 disabled:cursor-wait disabled:opacity-60"
            >
              <Upload className="h-4 w-4 text-slate-500" aria-hidden />
              <span className="sr-only">
                {importingCsv ? "Importing CSV…" : "Upload CSV"}
              </span>
            </button>

            <TableToolbarAddButton
              onClick={() => {
                setShowAddPayment(true);
                setCreateError(null);
              }}
            />

            <div ref={filtersMenuRef} className="relative">
              <TableToolbarButton
                label="Filters"
                aria-haspopup="true"
                aria-expanded={filtersMenuOpen}
                aria-controls="payments-filters-menu"
                active={filtersMenuOpen}
                badge={activeFilterCount > 0 ? activeFilterCount : null}
                onClick={() => {
                  setFiltersMenuOpen((open) => !open);
                  setSortMenuOpen(false);
                  setGroupMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                icon={
                  <FilterSlidersIcon className="h-5 w-5 text-slate-500" />
                }
              />
              {filtersMenuOpen ? (
                <div
                  id="payments-filters-menu"
                  role="menu"
                  className="absolute right-0 z-[90] mt-1 w-[min(92vw,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="filter-status"
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Status
                      </label>
                      <select
                        id="filter-status"
                        value={statusFilter}
                        onChange={(e) =>
                          setStatusFilter(e.target.value as StatusFilter)
                        }
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="succeeded">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="canceled">Canceled</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="filter-source"
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Source
                      </label>
                      <select
                        id="filter-source"
                        value={sourceFilter}
                        onChange={(e) =>
                          setSourceFilter(e.target.value as SourceFilter)
                        }
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="stripe">Stripe</option>
                        <option value="stripe_stryv_us">Stripe (Stryv US)</option>
                        <option value="revolut_merchant">Revolut merchant</option>
                        <option value="revolut_direct">Revolut transfer</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="filter-coach-assignment"
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Coach
                      </label>
                      <select
                        id="filter-coach-assignment"
                        value={coachAssignmentFilter}
                        onChange={(e) =>
                          setCoachAssignmentFilter(
                            e.target.value as CoachAssignmentFilter
                          )
                        }
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={needsActionOnly}
                        onChange={(e) => setNeedsActionOnly(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Needs action (failed/canceled + unassigned)
                    </label>
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={sortMenuRef} className="relative">
              <TableToolbarButton
                label="Sort"
                aria-haspopup="true"
                aria-expanded={sortMenuOpen}
                aria-controls="payments-sort-menu"
                active={sortMenuOpen}
                onClick={() => {
                  setSortMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setGroupMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                icon={
                  <ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />
                }
              />
              {sortMenuOpen ? (
                <div
                  id="payments-sort-menu"
                  role="menu"
                  className="absolute right-0 z-[90] mt-1 w-[min(92vw,16rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <label
                    htmlFor="payment-sort"
                    className="mb-1 block text-xs font-medium text-slate-600"
                  >
                    Sort by
                  </label>
                  <select
                    id="payment-sort"
                    value={paymentSort}
                    onChange={(e) =>
                      setPaymentSort(e.target.value as PaymentSort)
                    }
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="recent_first">Date (newest first)</option>
                    <option value="oldest_first">Date (oldest first)</option>
                    <option value="customer_az">Customer (A–Z)</option>
                  </select>
                </div>
              ) : null}
            </div>

            <div ref={groupMenuRef} className="relative">
              <TableToolbarButton
                label="Group"
                aria-haspopup="true"
                aria-expanded={groupMenuOpen}
                aria-controls="payments-group-menu"
                active={groupMenuOpen}
                badge={paymentGroupBy !== "none" ? 1 : null}
                onClick={() => {
                  setGroupMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setSortMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                icon={<Layers className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {groupMenuOpen ? (
                <div
                  id="payments-group-menu"
                  role="menu"
                  className="absolute right-0 z-[90] mt-1 w-[min(92vw,16rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <label
                    htmlFor="payment-group-by"
                    className="mb-1 block text-xs font-medium text-slate-600"
                  >
                    Group by
                  </label>
                  <select
                    id="payment-group-by"
                    value={paymentGroupBy}
                    onChange={(e) =>
                      setPaymentGroupBy(e.target.value as PaymentGroupBy)
                    }
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="none">None</option>
                    <option value="coach">Coach</option>
                  </select>
                </div>
              ) : null}
            </div>

            <DataTableColumnsMenu
              open={columnsMenuOpen}
              onToggle={() => {
                setColumnsMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
                setSortMenuOpen(false);
                setGroupMenuOpen(false);
              }}
              menuRef={columnsMenuRef}
              shownOptions={shownColumnOptions}
              hiddenOptions={hiddenColumnOptions}
              columnVisibility={columnVisibility}
              onVisibilityChange={(key, visible) =>
                setColumnVisibility((prev) => ({
                  ...prev,
                  [key]: visible,
                }))
              }
              onMoveColumn={moveColumnInOrder}
              draggingColumnKey={draggingColumnKey}
              onDraggingColumnKeyChange={setDraggingColumnKey}
              align="right"
              triggerId="payments-columns-trigger"
              menuId="payments-columns-menu"
            />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-max min-w-max text-left text-sm">
            <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                {orderedColumnOptions
                  .filter(({ key }) => columnVisibility[key])
                  .map(({ key }) => (
                    <Fragment key={key}>{renderColumnHeader(key)}</Fragment>
                  ))}
                <th
                  className="bg-slate-50 px-2 py-2 text-center"
                  aria-label="Delete"
                />
              </tr>
            </thead>
            <tbody>
              {groupedPayments.map((group) => {
                const isExpanded =
                  paymentGroupBy === "none" ||
                  expandedPaymentGroups.has(group.key);
                return (
                <Fragment key={group.key}>
                  {paymentGroupBy !== "none" ? (
                    <>
                      <tr className="bg-slate-50/80">
                        <td
                          colSpan={tableColSpan}
                          className="border-b border-slate-100 p-0"
                        >
                          <button
                            type="button"
                            onClick={() => togglePaymentGroup(group.key)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-slate-500 transition hover:bg-slate-100/80"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown
                                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                  aria-hidden
                                />
                              ) : (
                                <ChevronRight
                                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                  aria-hidden
                                />
                              )}
                              <span className="min-w-0 truncate font-semibold text-slate-700">
                                {group.label}
                              </span>
                              <span className="shrink-0 font-normal normal-case tracking-normal text-slate-400">
                                {formatGroupPaymentCount(group.payments)}
                              </span>
                            </div>
                            <PaymentGroupProgress summary={group.summary} />
                          </button>
                        </td>
                      </tr>
                    </>
                  ) : null}
                  {isExpanded
                    ? group.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      {orderedColumnOptions
                        .filter(({ key }) => columnVisibility[key])
                        .map(({ key }) => renderColumnCell(key, payment))}
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => void handleDeletePayment(payment)}
                          disabled={
                            deletingId === payment.id || savingId === payment.id
                          }
                          title={
                            deletingId === payment.id
                              ? "Deleting payment…"
                              : `Delete payment for ${payment.customer_email}`
                          }
                          aria-label={
                            deletingId === payment.id
                              ? "Deleting payment"
                              : `Delete payment for ${payment.customer_email}`
                          }
                          className="inline-flex rounded p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                    : null}
                </Fragment>
              );
              })}
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-4 text-slate-600">
                    Loading payments…
                  </td>
                </tr>
              ) : null}
              {!loading && !error && filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-4 text-slate-600">
                    No payments match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
