"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import {
  formatPaymentDate,
  formatPaymentMoney,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from "@/lib/adminPaymentDisplay";
import {
  COACH_ACCESS_TIERS,
  COACH_ACCESS_TIER_LABELS,
  type CoachAccessTier,
} from "@/lib/coachAccess/tiers";
import {
  COACH_RECURRING_PAYMENT_LABELS,
  COACH_RECURRING_PAYMENT_STATUSES,
  type CoachRecurringPaymentStatus,
} from "@/lib/coachBilling";
import {
  buildPaymentBillingKindIndex,
  paymentBillingKindBadgeClass,
  paymentBillingKindLabel,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import { formatPersonName } from "@/lib/formatPersonName";
import { LADDER_LEVELS } from "@/lib/ladder";
import { paymentSourceLabel } from "@/lib/paymentSource";
import {
  revolutTransferCustomerDisplayLabel,
} from "@/lib/revolutDirectPaymentsCsvImport";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type CoachDetail = {
  id: string;
  slug: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  coach_business_name: string | null;
  linkedin_url: string | null;
  joined_at: string | null;
  client_count: number;
  directory_listed: boolean;
  directory_level: string | null;
  conference_status: "no" | "maybe" | "yes" | null;
  crm_profile_name: string | null;
  crm_location_id: string | null;
  has_calendar_embed: boolean;
  calendar_sync_ready: boolean;
  has_lead_webhook: boolean;
  has_community_bio: boolean;
  has_directory_summary: boolean;
  has_directory_bio: boolean;
  has_sales_robot_account: boolean;
  sales_robot_active_campaigns: number | null;
  sales_robot_paying_accounts: number | null;
  has_profit_coach_email_account: boolean;
  recurring_payment_status: CoachRecurringPaymentStatus | null;
  recurring_billing_active: boolean;
  access_tier: CoachAccessTier;
  access_tier_locked: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  membership_status: string | null;
  membership_interval: string | null;
  membership_current_period_end: string | null;
  membership_cancel_at_period_end: boolean;
  ladder_level: string | null;
  ladder_goal_level: string | null;
  ladder_goal_target_date: string | null;
  last_login_at: string | null;
  community_bio: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
};

type CoachPayment = {
  id: string;
  customer_email: string;
  customer_company_name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string;
  description: string | null;
  payment_source: string;
  billing_kind_override: PaymentBillingKind | null;
};

type TabId = "overview" | "payments";

const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";

function formatDateDisplay(value: Date): string {
  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() === currentYear ? {} : { year: "numeric" }),
  }).format(value);
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(t)) return iso;
  return formatDateDisplay(new Date(t));
}

function ladderLevelDisplay(id: string | null | undefined): string {
  if (!id?.trim()) return "—";
  const level = LADDER_LEVELS.find((item) => item.id === id);
  if (level) return `${level.name} (${level.amountText})`;
  return id;
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-sm text-slate-900">
        {children ?? (value?.trim() ? value : <span className="text-slate-400">—</span>)}
      </dd>
    </div>
  );
}

function SetupBadge({ complete, label }: { complete: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        complete ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span aria-hidden>{complete ? "✓" : "—"}</span>
      {label}
    </span>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-slate-900 md:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function AdminCoachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coachId } = use(params);
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [coach, setCoach] = useState<CoachDetail | null>(null);
  const [payments, setPayments] = useState<CoachPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [accessDraft, setAccessDraft] = useState<{
    access_tier: CoachAccessTier;
    access_tier_locked: boolean;
    recurring_payment_status: CoachRecurringPaymentStatus | "";
  } | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessMsg, setAccessMsg] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const res = await fetch(`/api/admin/coaches/${encodeURIComponent(coachId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coach?: CoachDetail;
        payments?: CoachPayment[];
        error?: string;
      };

      if (cancelled) return;

      if (!res.ok) {
        setError(body.error ?? "Unable to load coach.");
        setLoading(false);
        return;
      }

      setCoach(body.coach ?? null);
      setPayments(body.payments ?? []);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [coachId, router]);

  useEffect(() => {
    if (!coach) return;
    setAccessDraft({
      access_tier: coach.access_tier,
      access_tier_locked: coach.access_tier_locked,
      recurring_payment_status: coach.recurring_payment_status ?? "",
    });
    setAccessMsg(null);
  }, [coach]);

  async function saveAccessBilling() {
    if (!coach || !accessDraft) return;
    setSavingAccess(true);
    setAccessMsg(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }

    const nextRecurring = accessDraft.recurring_payment_status || null;
    const res = await fetch(
      `/api/admin/coaches/${encodeURIComponent(coachId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_tier: accessDraft.access_tier,
          access_tier_locked: accessDraft.access_tier_locked,
          recurring_payment_status: nextRecurring,
        }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setAccessMsg({ kind: "err", text: body.error ?? "Could not save changes." });
      setSavingAccess(false);
      return;
    }

    setCoach((prev) =>
      prev
        ? {
            ...prev,
            access_tier: accessDraft.access_tier,
            access_tier_locked: accessDraft.access_tier_locked,
            recurring_payment_status: nextRecurring,
          }
        : prev
    );
    setAccessMsg({ kind: "ok", text: "Saved." });
    setSavingAccess(false);
  }

  const paymentsWithBilling = useMemo(() => {
    const forBilling = (payment: CoachPayment) => ({
      id: payment.id,
      customer_email: payment.customer_email,
      coach_id: coachId,
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
  }, [coachId, payments]);

  const paymentSummary = useMemo(() => {
    const succeeded = paymentsWithBilling.filter((payment) => payment.status === "succeeded");
    const totalsByCurrency = new Map<string, number>();
    for (const payment of succeeded) {
      const code = payment.currency.toUpperCase();
      totalsByCurrency.set(
        code,
        (totalsByCurrency.get(code) ?? 0) + payment.amount_cents
      );
    }
    return {
      totalCount: paymentsWithBilling.length,
      succeededCount: succeeded.length,
      totalsByCurrency: [...totalsByCurrency.entries()].sort(([a], [b]) =>
        a.localeCompare(b)
      ),
    };
  }, [paymentsWithBilling]);

  const displayName =
    formatPersonName(coach?.full_name) ||
    coach?.coach_business_name?.trim() ||
    coach?.slug ||
    "Coach";

  const tabButton = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveTab(id)}
      className={`border-b-2 px-0 py-3 text-sm font-semibold tracking-tight transition ${
        activeTab === id
          ? "border-[#0c5290] text-[#0c5290]"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title={loading ? "Coach" : displayName}
        tabs={<CoachesHubTabs />}
        leading={
          <Link
            href="/admin"
            className="text-xs font-medium text-sky-600 hover:text-sky-700"
          >
            ← All coaches
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading coach…
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && coach ? (
        <div className="space-y-8">
          <header className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                {coach.avatar_url ? (
                  <img
                    src={coach.avatar_url}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-400 ring-2 ring-slate-200"
                    aria-hidden
                  >
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 md:text-4xl">
                    {displayName}
                  </h1>
                  {coach.coach_business_name?.trim() &&
                  coach.coach_business_name.trim() !== coach.full_name?.trim() ? (
                    <p className="text-lg text-slate-600">{coach.coach_business_name}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>@{coach.slug}</span>
                    {coach.email ? <span>{coach.email}</span> : null}
                    {coach.joined_at ? (
                      <span>Joined {formatIsoDate(coach.joined_at)}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImpersonatingCoachId(coach.id);
                    router.push("/coach");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  View as coach
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <Link
                  href={`/landing/a?coach=${encodeURIComponent(coach.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Landing page
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
                {coach.crm_location_id ? (
                  <a
                    href={`${CRM_LOCATION_BASE_URL}/${coach.crm_location_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Open CRM
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          <div className="border-b border-slate-200/80">
            <nav className="-mb-px flex flex-wrap gap-x-8 gap-y-1" aria-label="Coach sections">
              {tabButton("overview", "Overview")}
              {tabButton("payments", `Payments (${payments.length})`)}
            </nav>
          </div>

          {activeTab === "overview" ? (
            <div className="space-y-6">
              <SectionCard title="Member" description="Core membership details.">
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField label="Clients" value={String(coach.client_count)} />
                  <DetailField label="Last login" value={formatIsoDate(coach.last_login_at)} />
                  <DetailField label="Conference" value={coach.conference_status ?? "Not set"} />
                  <DetailField
                    label="LinkedIn"
                    value={coach.linkedin_url ? undefined : null}
                  >
                    {coach.linkedin_url ? (
                      <a
                        href={coach.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0c5290] hover:underline"
                      >
                        Profile
                      </a>
                    ) : null}
                  </DetailField>
                </dl>
              </SectionCard>

              <SectionCard title="Ladder & goals">
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField
                    label="Current level"
                    value={ladderLevelDisplay(coach.ladder_level)}
                  />
                  <DetailField
                    label="Goal level"
                    value={ladderLevelDisplay(coach.ladder_goal_level)}
                  />
                  <DetailField
                    label="Goal by"
                    value={formatIsoDate(coach.ladder_goal_target_date)}
                  />
                </dl>
              </SectionCard>

              <SectionCard
                title="Billing & access"
                description="Access tier and billing status are independent. Tiers only restrict features when tier enforcement is enabled; lock a tier to stop Stripe from changing it (use for complimentary or manually granted access)."
              >
                {accessDraft ? (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Access tier
                        </span>
                        <select
                          value={accessDraft.access_tier}
                          onChange={(e) =>
                            setAccessDraft((d) =>
                              d
                                ? { ...d, access_tier: e.target.value as CoachAccessTier }
                                : d
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#0c5290] focus:outline-none focus:ring-1 focus:ring-[#0c5290]"
                        >
                          {COACH_ACCESS_TIERS.map((tier) => (
                            <option key={tier} value={tier}>
                              {COACH_ACCESS_TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Billing status
                        </span>
                        <select
                          value={accessDraft.recurring_payment_status}
                          onChange={(e) =>
                            setAccessDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    recurring_payment_status: e.target
                                      .value as CoachRecurringPaymentStatus | "",
                                  }
                                : d
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#0c5290] focus:outline-none focus:ring-1 focus:ring-[#0c5290]"
                        >
                          <option value="">Not set</option>
                          {COACH_RECURRING_PAYMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {COACH_RECURRING_PAYMENT_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex items-start gap-2.5 sm:col-span-2 lg:col-span-1 lg:pt-6">
                        <input
                          type="checkbox"
                          checked={accessDraft.access_tier_locked}
                          onChange={(e) =>
                            setAccessDraft((d) =>
                              d ? { ...d, access_tier_locked: e.target.checked } : d
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0c5290] focus:ring-[#0c5290]"
                        />
                        <span className="text-sm text-slate-700">
                          <span className="font-medium">Lock tier (override)</span>
                          <span className="block text-xs text-slate-500">
                            Stripe won&apos;t change this coach&apos;s tier while locked.
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      {(() => {
                        const dirty =
                          accessDraft.access_tier !== coach.access_tier ||
                          accessDraft.access_tier_locked !== coach.access_tier_locked ||
                          (accessDraft.recurring_payment_status || null) !==
                            (coach.recurring_payment_status ?? null);
                        return (
                          <button
                            type="button"
                            onClick={() => void saveAccessBilling()}
                            disabled={!dirty || savingAccess}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0c5290] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a4274] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingAccess ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : null}
                            Save access & billing
                          </button>
                        );
                      })()}
                      {accessMsg ? (
                        <span
                          className={`text-sm ${
                            accessMsg.kind === "ok" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {accessMsg.text}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField
                    label="Recurring active"
                    value={coach.recurring_billing_active ? "Yes" : "No"}
                  />
                  <DetailField
                    label="Membership status"
                    value={coach.membership_status ?? "Not set"}
                  />
                  <DetailField
                    label="Billing interval"
                    value={coach.membership_interval ?? "—"}
                  />
                  <DetailField
                    label="Period end"
                    value={
                      coach.membership_current_period_end
                        ? formatIsoDate(coach.membership_current_period_end)
                        : "—"
                    }
                  />
                  <DetailField
                    label="Stripe subscription"
                    value={coach.stripe_subscription_id ?? "—"}
                  />
                  <DetailField
                    label="Sales Robot"
                    value={coach.has_sales_robot_account ? "Yes" : "No"}
                  />
                  <DetailField
                    label="Active campaigns"
                    value={
                      coach.sales_robot_active_campaigns != null
                        ? String(coach.sales_robot_active_campaigns)
                        : null
                    }
                  />
                  <DetailField
                    label="PC email account"
                    value={coach.has_profit_coach_email_account ? "Yes" : "No"}
                  />
                </dl>
              </SectionCard>

              <SectionCard title="Integrations & setup">
                <div className="flex flex-wrap gap-2">
                  <SetupBadge complete={coach.calendar_sync_ready} label="Calendar sync" />
                  <SetupBadge complete={coach.has_lead_webhook} label="Lead webhook" />
                  <SetupBadge complete={coach.has_community_bio} label="Community bio" />
                  <SetupBadge complete={coach.has_directory_summary} label="Directory summary" />
                  <SetupBadge complete={coach.has_directory_bio} label="Directory bio" />
                </div>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <DetailField label="CRM profile" value={coach.crm_profile_name} />
                  <DetailField label="CRM location ID" value={coach.crm_location_id} />
                </dl>
              </SectionCard>

              <SectionCard title="Directory">
                <dl className="grid gap-5 sm:grid-cols-2">
                  <DetailField
                    label="Listed"
                    value={coach.directory_listed ? "Yes" : "No"}
                  />
                  <DetailField label="Directory level" value={coach.directory_level} />
                </dl>
                {coach.directory_summary?.trim() ? (
                  <div className="mt-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Summary
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {coach.directory_summary}
                    </p>
                  </div>
                ) : null}
                {coach.directory_bio?.trim() ? (
                  <div className="mt-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Bio
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {coach.directory_bio}
                    </p>
                  </div>
                ) : null}
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "payments" ? (
            <div className="space-y-6">
              <SectionCard
                title="Payment history"
                description="All payments assigned to this coach, most recent first."
              >
                <div className="mb-6 flex flex-wrap gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Total payments
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {paymentSummary.totalCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Successful
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {paymentSummary.succeededCount}
                    </p>
                  </div>
                  {paymentSummary.totalsByCurrency.map(([currency, cents]) => (
                    <div key={currency} className="rounded-xl bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        Paid ({currency})
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-900">
                        {formatPaymentMoney(cents, currency)}
                      </p>
                    </div>
                  ))}
                </div>

                {paymentsWithBilling.length === 0 ? (
                  <p className="text-sm text-slate-600">No payments assigned to this coach yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Billing</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsWithBilling.map((payment) => (
                          <tr
                            key={payment.id}
                            className="border-t border-slate-100 hover:bg-slate-50/80"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatPaymentDate(payment.paid_at)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {formatPaymentMoney(payment.amount_cents, payment.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusBadgeClass(payment.status)}`}
                              >
                                {paymentStatusLabel(payment.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {payment.status === "succeeded" ? (
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentBillingKindBadgeClass(payment.billing_kind)}`}
                                >
                                  {paymentBillingKindLabel(payment.billing_kind)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="max-w-[18rem] px-4 py-3">
                              <div className="min-w-0">
                                <div
                                  className="truncate font-medium text-slate-800"
                                  title={revolutTransferCustomerDisplayLabel(payment)}
                                >
                                  {revolutTransferCustomerDisplayLabel(payment)}
                                </div>
                                {payment.description ? (
                                  <div
                                    className="mt-0.5 truncate text-xs text-slate-500"
                                    title={payment.description}
                                  >
                                    {payment.description}
                                  </div>
                                ) : null}
                                {payment.customer_company_name ? (
                                  <div className="mt-0.5 truncate text-xs text-slate-500">
                                    {payment.customer_company_name}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                              {paymentSourceLabel(payment.payment_source)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-4 text-xs text-slate-500">
                  Need to reassign or import payments?{" "}
                  <Link href="/admin/payments" className="font-medium text-[#0c5290] hover:underline">
                    Open the payments table
                  </Link>
                  .
                </p>
              </SectionCard>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
