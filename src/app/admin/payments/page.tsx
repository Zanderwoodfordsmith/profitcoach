"use client";

import {
  ArrowUpDown,
  ChevronDown,
  Columns3,
  GripVertical,
  Plus,
  SlidersHorizontal,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { PaymentsMonthlyBarChart } from "@/components/admin/PaymentsMonthlyBarChart";
import { StickyPageHeader } from "@/components/layout";
import { formatPersonName } from "@/lib/formatPersonName";
import {
  buildPaymentBillingKindIndex,
  paymentBillingKindBadgeClass,
  paymentBillingKindLabel,
  PAYMENT_BILLING_KINDS,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import {
  isRevolutTransferPlaceholderEmail,
  revolutTransferCustomerDisplayLabel,
} from "@/lib/revolutDirectPaymentsCsvImport";
import { paymentSourceLabel } from "@/lib/paymentSource";
import { supabaseClient } from "@/lib/supabaseClient";

type CoachOption = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
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
    for (const key of parsed.columnOrder) {
      if (key === "matched") continue;
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

  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
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
          label: coachLabel(coach),
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
        status: payment.status,
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        paid_at: payment.paid_at,
        billing_kind: payment.billing_kind,
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
    if (!columnsMenuOpen && !filtersMenuOpen && !sortMenuOpen) return;
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
      setColumnsMenuOpen(false);
      setFiltersMenuOpen(false);
      setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen, filtersMenuOpen, sortMenuOpen]);

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
    columnVisibility,
    columnOrder,
  ]);

  function moveColumnInOrder(
    draggedKey: keyof PaymentTableColumnVisibility,
    targetKey: keyof PaymentTableColumnVisibility
  ) {
    if (draggedKey === targetKey) return;
    setColumnOrder((prev) => {
      const from = prev.indexOf(draggedKey);
      const to = prev.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
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
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-xs text-slate-500">
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

            <button
              type="button"
              onClick={() => {
                setShowAddPayment(true);
                setCreateError(null);
              }}
              title="Add payment"
              className="inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500"
            >
              <Plus className="h-4 w-4 text-slate-500" aria-hidden />
              <span className="sr-only">Add payment</span>
            </button>

            <div ref={filtersMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={filtersMenuOpen}
                aria-controls="payments-filters-menu"
                onClick={() => {
                  setFiltersMenuOpen((open) => !open);
                  setSortMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                title="Filters"
                className={`relative inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${filtersMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
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
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={sortMenuOpen}
                aria-controls="payments-sort-menu"
                onClick={() => {
                  setSortMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                title="Sort"
                className={`inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${sortMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <ArrowUpDown className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
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

            <div ref={columnsMenuRef} className="relative">
              <button
                type="button"
                id="payments-columns-trigger"
                aria-haspopup="true"
                aria-expanded={columnsMenuOpen}
                aria-controls="payments-columns-menu"
                onClick={() => {
                  setColumnsMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setSortMenuOpen(false);
                }}
                title="Columns"
                className={`inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${columnsMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <Columns3 className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
              {columnsMenuOpen ? (
                <div
                  id="payments-columns-menu"
                  role="menu"
                  aria-labelledby="payments-columns-trigger"
                  className="absolute right-0 z-[90] mt-1 max-h-[min(24rem,70vh)] w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-2 shadow-lg"
                >
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shown
                  </p>
                  <ul className="space-y-0.5 px-2">
                    {shownColumnOptions.map(({ key, label }) => (
                      <li
                        key={key}
                        role="none"
                        draggable
                        onDragStart={(e) => {
                          setDraggingColumnKey(key);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedKey =
                            (e.dataTransfer.getData(
                              "text/plain"
                            ) as keyof PaymentTableColumnVisibility) ||
                            draggingColumnKey;
                          if (droppedKey) moveColumnInOrder(droppedKey, key);
                          setDraggingColumnKey(null);
                        }}
                        onDragEnd={() => setDraggingColumnKey(null)}
                        className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          <GripVertical
                            className="h-3.5 w-3.5 text-slate-400"
                            aria-hidden
                          />
                          <input
                            type="checkbox"
                            role="menuitemcheckbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={columnVisibility[key]}
                            onChange={(e) =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="my-2 border-t border-slate-200" />
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hidden
                  </p>
                  <ul className="space-y-0.5 px-2">
                    {hiddenColumnOptions.map(({ key, label }) => (
                      <li
                        key={key}
                        role="none"
                        draggable
                        onDragStart={(e) => {
                          setDraggingColumnKey(key);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedKey =
                            (e.dataTransfer.getData(
                              "text/plain"
                            ) as keyof PaymentTableColumnVisibility) ||
                            draggingColumnKey;
                          if (droppedKey) moveColumnInOrder(droppedKey, key);
                          setDraggingColumnKey(null);
                        }}
                        onDragEnd={() => setDraggingColumnKey(null)}
                        className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          <GripVertical
                            className="h-3.5 w-3.5 text-slate-400"
                            aria-hidden
                          />
                          <input
                            type="checkbox"
                            role="menuitemcheckbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={columnVisibility[key]}
                            onChange={(e) =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
              {filteredPayments.map((payment) => (
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
                      disabled={deletingId === payment.id || savingId === payment.id}
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
              ))}
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
