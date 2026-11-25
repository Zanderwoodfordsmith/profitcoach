"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  Phone,
} from "lucide-react";

import { type AdminCoachLinkedInProfile } from "@/components/admin/AdminCoachLinkedInPanel";
import { AdminCoachSources } from "@/components/admin/AdminCoachSources";
import { AdminCoachAva } from "@/components/admin/AdminCoachAva";
import { CoachGettingLive } from "@/components/admin/CoachGettingLive";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { CoachOverviewActivation } from "@/components/admin/CoachOverviewActivation";
import { LinkedInMark } from "@/components/icons/LinkedInMark";
import { StickyPageHeader } from "@/components/layout";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { formatDateDisplay } from "@/lib/formatDateDisplay";
import {
  lastLoginFreshness,
  lastLoginFreshnessClasses,
} from "@/lib/lastLoginFreshness";
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
  establishedCustomerPriorTotalCents,
  isProgrammeUpfrontAmount,
  type PaymentBillingKind,
} from "@/lib/paymentBillingKind";
import { buildCoachBillingOverview } from "@/lib/admin/paymentPlanRemaining";
import { formatPersonName } from "@/lib/formatPersonName";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";
import { LADDER_LEVELS } from "@/lib/ladder";
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
  phone: string | null;
  linkedin_profile: AdminCoachLinkedInProfile | null;
  joined_at: string | null;
  client_count: number;
  directory_listed: boolean;
  directory_level: string | null;
  crm_profile_name: string | null;
  crm_location_id: string | null;
  booking_calendar_provider: "native" | "ghl";
  has_calendar_embed: boolean;
  calendar_sync_ready: boolean;
  has_lead_webhook: boolean;
  has_community_bio: boolean;
  has_directory_summary: boolean;
  has_directory_bio: boolean;
  has_sales_robot_account: boolean;
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
  last_active_at: string | null;
  community_bio: string | null;
  directory_summary: string | null;
  directory_bio: string | null;
  access_removed_at: string | null;
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

type TabId = "overview" | "getting-live" | "sources" | "ava";

/**
 * The coach's Blueprint (LinkedIn profile included) opens in My Blueprint, as
 * that coach sees it (Zander, 21 Nov), so the profile has no Blueprint or
 * LinkedIn tab. Their posts and newsletter are on their Get Clients → LinkedIn.
 */
function blueprintHref(coachId: string, page?: string | null): string {
  const path = (page && blueprintPage(page)?.href) || "/coach/blueprint";
  return `${path}?impersonate=${encodeURIComponent(coachId)}`;
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



/** Last login / last active as a dated pill, coloured by how recent it is. */
function FreshPill({ iso, never, title }: { iso: string | null; never: string; title: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${lastLoginFreshnessClasses(iso ? lastLoginFreshness(iso) : "never")}`}
      title={title}
    >
      {iso ? formatIsoDate(iso) : never}
    </span>
  );
}


export default function AdminCoachDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: coachRef } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setImpersonatingCoachId } = useImpersonation();
  const [coach, setCoach] = useState<CoachDetail | null>(null);
  const [payments, setPayments] = useState<CoachPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [allPayments, setAllPayments] = useState(false);
  const [editingAccess, setEditingAccess] = useState(false);
  const [accessDraft, setAccessDraft] = useState<{
    access_tier: CoachAccessTier;
    access_tier_locked: boolean;
    recurring_payment_status: CoachRecurringPaymentStatus | "";
  } | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessMsg, setAccessMsg] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);
  const [confirmingRemoveAccess, setConfirmingRemoveAccess] = useState(false);
  const [removingAccess, setRemovingAccess] = useState(false);
  const [removeAccessError, setRemoveAccessError] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "sources" || tab === "ava" || tab === "getting-live") {
      setActiveTab(tab);
    } else if (!tab || tab === "payments") {
      // Payments live on Overview now (old ?tab=payments links land there).
      setActiveTab("overview");
    }
  }, [searchParams]);

  // Old links to the Blueprint or LinkedIn tab go to My Blueprint as this coach.
  const oldTab = searchParams.get("tab");
  const oldDoc = oldTab === "linkedin" ? "linkedin" : searchParams.get("doc");
  useEffect(() => {
    if (!coach || (oldTab !== "blueprint" && oldTab !== "practice" && oldTab !== "linkedin")) return;
    setImpersonatingCoachId(coach.id);
    router.replace(blueprintHref(coach.id, oldDoc));
  }, [coach, oldTab, oldDoc, router, setImpersonatingCoachId]);

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

      const res = await fetch(`/api/admin/coaches/${encodeURIComponent(coachRef)}`, {
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

      const loadedCoach = body.coach ?? null;
      setCoach(loadedCoach);
      setPayments(body.payments ?? []);
      setLoading(false);

      if (loadedCoach && loadedCoach.slug !== coachRef) {
        const params = new URLSearchParams(searchParams.toString());
        if (params.get("tab") === "practice") params.set("tab", "blueprint");
        const query = params.toString();
        router.replace(
          `/admin/coaches/${encodeURIComponent(loadedCoach.slug)}${query ? `?${query}` : ""}`
        );
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [coachRef, router, searchParams]);

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
      `/api/admin/coaches/${encodeURIComponent(coach.slug)}`,
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

  async function removeAccess() {
    if (!coach) return;
    setRemovingAccess(true);
    setRemoveAccessError(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }

    const res = await fetch(
      `/api/admin/coaches/${encodeURIComponent(coach.slug)}/remove-access`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      access_removed_at?: string;
      error?: string;
    };

    if (!res.ok || !body.access_removed_at) {
      setRemoveAccessError(body.error ?? "Could not remove access.");
      setRemovingAccess(false);
      return;
    }

    setCoach((prev) =>
      prev
        ? {
            ...prev,
            email: null,
            linkedin_url: null,
            directory_listed: false,
            access_tier: "early_exit",
            access_tier_locked: true,
            access_removed_at: body.access_removed_at ?? null,
          }
        : prev
    );
    setConfirmingRemoveAccess(false);
    setRemovingAccess(false);
  }

  const paymentsWithBilling = useMemo(() => {
    const forBilling = (payment: CoachPayment) => ({
      id: payment.id,
      customer_email: payment.customer_email,
      coach_id: coach?.id ?? null,
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
  }, [coach?.id, payments]);

  const paymentSummary = useMemo(
    () => buildCoachBillingOverview(paymentsWithBilling),
    [paymentsWithBilling]
  );

  const displayName =
    formatPersonName(coach?.full_name) ||
    coach?.coach_business_name?.trim() ||
    coach?.slug ||
    "Coach";

  // Back goes where the coach was opened from: Launches, the Getting live view on Coaches, or all coaches.
  const from = searchParams.get("from");
  const back =
    from === "launches"
      ? { href: "/admin?view=launch", label: "Launch" }
      : from === "getting-live"
        ? { href: "/admin?view=launch", label: "Launch" }
        : { href: "/admin", label: "All coaches" };

  // Shared by Overview V1 and V2 (21 Nov, until Zander picks one).
  const renderAccessForm = (narrow: boolean) =>
    !coach || !accessDraft ? null : (
                  <div className={narrow ? "" : "mb-4 border-b border-slate-100 pb-5"}>
                    <div className={narrow ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
                      <label className="space-y-1.5">
                        <span className="text-sm text-slate-500">Access tier</span>
                        <select
                          value={accessDraft.access_tier}
                          onChange={(e) => {
                            const nextTier = e.target.value as CoachAccessTier;
                            setAccessDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    access_tier: nextTier,
                                    ...(nextTier === "do_not_contact" ||
                                    nextTier === "early_exit"
                                      ? { access_tier_locked: true }
                                      : {}),
                                  }
                                : d
                            );
                          }}
                          className={fieldClass("select")}
                        >
                          {COACH_ACCESS_TIERS.map((tier) => (
                            <option key={tier} value={tier}>
                              {COACH_ACCESS_TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-sm text-slate-500">Billing status</span>
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
                          className={fieldClass("select")}
                        >
                          <option value="">Not set</option>
                          {COACH_RECURRING_PAYMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {COACH_RECURRING_PAYMENT_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={narrow ? "flex items-start gap-2.5" : "flex items-start gap-2.5 sm:col-span-2 lg:col-span-1 lg:pt-6"}>
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
                            className={buttonClass("main", "small")}
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
    );

  const removeAccessBlock = !coach ? null : (
              <section className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-slate-200 px-1 pt-5">
                <div className="max-w-[60ch]">
                  <h2 className="text-sm font-semibold text-slate-900">Remove access</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    For someone who has left. Their name and face stay on their posts so the community still makes sense.
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                {coach.access_removed_at ? (
                  <p className="text-sm text-slate-700">
                    Access removed on{" "}
                    <span className="font-medium text-slate-900">
                      {formatIsoDate(coach.access_removed_at)}
                    </span>
                    . Their login is blocked and their contact details are cleared.
                  </p>
                ) : confirmingRemoveAccess ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      Remove {coach.full_name?.trim() || "this coach"}&apos;s access?
                    </p>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                      <li>
                        Their login stops working. Their sign-in email is replaced, so they
                        can use it again if they ever rejoin.
                      </li>
                      <li>
                        Their phone, LinkedIn, social links and calendar feed link are cleared.
                      </li>
                      <li>
                        They are hidden from the member list, @-mentions and the public
                        directory, and set to Early exit.
                      </li>
                      <li>Their posts, comments, payments and history stay.</li>
                    </ul>
                    <p className="mt-3 text-sm text-slate-600">
                      Cleared contact details can&apos;t be brought back.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void removeAccess()}
                        disabled={removingAccess}
                        className={buttonClass("delete")}
                      >
                        {removingAccess ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : null}
                        Yes, remove access
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingRemoveAccess(false);
                          setRemoveAccessError(null);
                        }}
                        disabled={removingAccess}
                        className={buttonClass("quiet")}
                      >
                        Cancel
                      </button>
                      {removeAccessError ? (
                        <span className="text-sm text-rose-600">{removeAccessError}</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoveAccess(true)}
                    className={buttonClass("delete", "small")}
                  >
                    Remove access
                  </button>
                )}
                </div>
              </section>
  );

  const shownPayments = allPayments ? paymentsWithBilling : paymentsWithBilling.slice(0, 6);
  const businessLine =
    coach?.coach_business_name?.trim() && coach.coach_business_name.trim() !== coach.full_name?.trim()
      ? coach.coach_business_name.trim()
      : null;

  // Overview V2 (Zander, 21 Nov): who they are and how to reach them on the left,
  // like the Support side panel, with their activation below; billing, payments
  // and access together on the right. Setup and directory, Sales Robot, PC email
  // and the landing page link are left out.
  const about = coach ? (coach.directory_summary?.trim() || coach.community_bio?.trim() || null) : null;

  // Billing: the programme fee as a bar, then where monthly stands.
  const succeededPlan = paymentsWithBilling.filter((pay) => pay.status === "succeeded" && pay.billing_kind !== "recurring");
  const planCurrency = paymentSummary.remainingByCurrency[0]?.currency ?? succeededPlan[0]?.currency?.toUpperCase() ?? null;
  const plan = (() => {
    if (!planCurrency) return null;
    const row = paymentSummary.remainingByCurrency.find((r) => r.currency === planCurrency);
    if (row && row.expectedCents > 0) return { currency: planCurrency, paid: row.paidCents, total: row.expectedCents, count: row.installmentCount ? `${row.installmentsPaid} of ${row.installmentCount} payments` : null };
    // Fully paid plans have no row: only call it paid in full when it adds up to a real programme price.
    const paid = succeededPlan.filter((pay) => pay.currency.toUpperCase() === planCurrency).reduce((sum, pay) => sum + pay.amount_cents, 0);
    const programme = paid > 0 && (isProgrammeUpfrontAmount(paid, planCurrency) || paid >= establishedCustomerPriorTotalCents(planCurrency));
    return programme ? { currency: planCurrency, paid, total: paid, count: null } : null;
  })();
  const monthlyPayments = paymentsWithBilling.filter((pay) => pay.billing_kind === "recurring");
  const lastMonthly = monthlyPayments.find((pay) => pay.status === "succeeded") ?? null;
  const monthly: { tone: BadgeTone; label: string; line: string } | null = (() => {
    if (!coach) return null;
    const status = coach.recurring_payment_status;
    const paidMonths = monthlyPayments.filter((pay) => pay.status === "succeeded").length;
    // Failed or cancelled payments since the last one that went through (newest first from the API).
    const lastGood = paymentsWithBilling.find((pay) => pay.status === "succeeded") ?? null;
    const missed = paymentsWithBilling.filter((pay) => pay.status !== "succeeded" && (!lastGood || pay.paid_at > lastGood.paid_at));
    if (missed.length) {
      return {
        tone: "red",
        label: "Payment problem",
        line: `${missed.length === 1 ? "1 payment" : `${missed.length} payments`} ${paymentStatusLabel(missed[0].status).toLowerCase()}, latest ${formatPaymentDate(missed[0].paid_at)}${lastGood ? `; last one that went through was ${formatPaymentDate(lastGood.paid_at)}` : ""}`,
      };
    }
    if (status === "overdue") return { tone: "red", label: "Overdue", line: "Monthly payments are behind" };
    if (status === "complimentary") return { tone: "grey", label: "Free", line: "No monthly payment" };
    if (status === "annual_prepaid") return { tone: "green", label: "Prepaid", line: coach.membership_current_period_end ? `Paid for the year, renews ${formatIsoDate(coach.membership_current_period_end)}` : "Paid for the year" };
    if (status === "first_6_months") {
      const start = coach.joined_at ? new Date(Date.parse(coach.joined_at)) : null;
      // The programme is 4 months now (21 Nov 2026).
      if (start && !Number.isNaN(start.getTime())) start.setMonth(start.getMonth() + 4);
      return { tone: "blue", label: "Programme", line: start && !Number.isNaN(start.getTime()) ? `Monthly starts about ${formatDateDisplay(start)}` : "Monthly starts after 4 months" };
    }
    if (lastMonthly) {
      return { tone: "green", label: "Paying monthly", line: `${paidMonths} paid, last on ${formatPaymentDate(lastMonthly.paid_at)}${coach.membership_current_period_end ? `, next ${formatIsoDate(coach.membership_current_period_end)}` : ""}` };
    }
    if (plan && plan.paid < plan.total) return { tone: "blue", label: "On a plan", line: "No monthly payments yet, still paying the programme fee" };
    if (status === "monthly") return { tone: "amber", label: "Monthly", line: "No monthly payments seen yet" };
    return { tone: "grey", label: "Not set", line: "No monthly payments yet" };
  })();

  // Overview V2, round 4 (Zander, 21 Nov: "why does it not feel clean?"): one band for who
  // they are (name, business, email and phone one under the other, buttons top right,
  // summary, then the facts as labels over values), and below it two equal columns:
  // Activation as a checklist and Billing. One label style throughout.
  const fact = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-caption text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900">{value}</dd>
    </div>
  );
  const overviewV2 = !coach ? null : (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr]">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
      <section className={cardClass("plain", "p-5 md:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-start gap-4">
            {coach.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coach.avatar_url} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600">
                {displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-title font-semibold tracking-tight text-slate-900">{displayName}</h1>
                {coach.linkedin_url ? (
                  <a
                    href={coach.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`LinkedIn profile, ${coach.linkedin_profile?.scraped_at ? `read ${formatIsoDate(coach.linkedin_profile.scraped_at)}` : "not read yet"}`}
                    aria-label="LinkedIn profile"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:text-[#0a66c2]"
                  >
                    <LinkedInMark className="size-4" />
                  </a>
                ) : null}
              </div>
              {businessLine ? <p className="text-sm text-slate-500">{businessLine}</p> : null}
              <div className="mt-1 space-y-0.5 text-sm">
                {coach.email ? (
                  <a href={`mailto:${coach.email}`} className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-slate-950">
                    <Mail className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate">{coach.email}</span>
                  </a>
                ) : null}
                {coach.phone ? (
                  <a href={`tel:${coach.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-slate-700 hover:text-slate-950">
                    <Phone className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="tabular-nums">{coach.phone}</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={blueprintHref(coach.id)} onClick={() => setImpersonatingCoachId(coach.id)} className={buttonClass("main", "small", "px-3")}>
              Open their Blueprint
            </Link>
            <button
              type="button"
              onClick={() => {
                setImpersonatingCoachId(coach.id);
                router.push("/coach");
              }}
              className={buttonClass("second", "small", "px-3")}
            >
              View as coach
            </button>
          </div>
        </div>

        {about ? <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-600" title={about}>{about}</p> : null}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          {fact("Joined", coach.joined_at ? formatIsoDate(coach.joined_at) : "—")}
          {fact("Clients", <span className="tabular-nums">{coach.client_count}</span>)}
          {fact("Last active", <FreshPill iso={coach.last_active_at} never="No activity" title="App activity from page views and heartbeats while the tab is visible." />)}
          {fact("Last signed in", <FreshPill iso={coach.last_login_at} never="Never" title="Sign-ins only. Doesn't change when they come back to a tab that's already open." />)}
          {fact("Level now", coach.ladder_level ? ladderLevelDisplay(coach.ladder_level) : <span className="text-slate-400">Not set</span>)}
          {fact(
            "Goal",
            coach.ladder_goal_level || coach.ladder_goal_target_date ? (
              `${ladderLevelDisplay(coach.ladder_goal_level)}${coach.ladder_goal_target_date ? ` by ${formatIsoDate(coach.ladder_goal_target_date)}` : ""}`
            ) : (
              <span className="text-slate-400">Not set</span>
            )
          )}
        </dl>
      </section>

      {/* Activation at its own width; the space beside it is kept for what comes next. */}
      <div className="grid items-start gap-5 md:grid-cols-2">
        <CoachOverviewActivation coachId={coach.id} joinedAt={coach.joined_at} />
      </div>
      </div>

          <aside className={cardClass("plain", "divide-y divide-slate-100 lg:col-start-2 lg:row-span-2 lg:row-start-1")}>
            <div className="space-y-3 p-4">
              <h2 className="text-ui font-semibold text-slate-900">Billing</h2>

              <div>
                <p className="text-sm text-slate-500">Programme fee</p>
                {plan ? (
                  <>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={plan.total} aria-valuenow={plan.paid} aria-label="Programme fee paid">
                      <div className={`h-full rounded-full ${plan.paid >= plan.total ? "bg-emerald-500" : "bg-sky-600"}`} style={{ width: `${Math.min(100, Math.round((plan.paid / plan.total) * 100))}%` }} />
                    </div>
                    <p className="mt-1 text-sm text-slate-900">
                      {plan.paid >= plan.total ? (
                        <>
                          <span className="font-semibold tabular-nums">{formatPaymentMoney(plan.paid, plan.currency)}</span> paid in full
                        </>
                      ) : (
                        <>
                          <span className="font-semibold tabular-nums">{formatPaymentMoney(plan.paid, plan.currency)}</span>
                          <span className="text-slate-500"> of {formatPaymentMoney(plan.total, plan.currency)}</span>
                          {plan.count ? <span className="text-slate-500"> · {plan.count}</span> : null}
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">No programme payment seen</p>
                )}
              </div>

              {monthly ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">Monthly</p>
                    <span className={badgeClass(monthly.tone)}>{monthly.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-900">{monthly.line}</p>
                </div>
              ) : null}
            </div>

            <div className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-ui font-semibold text-slate-900">
                  Payments <span className="font-normal tabular-nums text-slate-400">{paymentsWithBilling.length}</span>
                </h2>
                <Link href="/admin/payments" className="text-caption font-medium text-[#0c5290] hover:underline">
                  All payments
                </Link>
              </div>
              {paymentsWithBilling.length ? (
                <ul className="mt-1 divide-y divide-slate-100">
                  {shownPayments.map((payment) => (
                    <li key={payment.id} className="grid grid-cols-[minmax(0,1fr)_4rem_4.75rem] items-center gap-x-2 py-1.5 text-sm" title={payment.description ?? undefined}>
                      <span className="font-medium tabular-nums text-slate-900">{formatPaymentMoney(payment.amount_cents, payment.currency)}</span>
                      <span className="tabular-nums text-slate-600">{formatPaymentDate(payment.paid_at)}</span>
                      <span className="text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusBadgeClass(payment.status)}`}>{paymentStatusLabel(payment.status)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500">No payments linked to them yet.</p>
              )}
              {paymentsWithBilling.length > shownPayments.length ? (
                <button type="button" onClick={() => setAllPayments(true)} className="mt-1 text-caption font-medium text-[#0c5290] hover:underline">
                  Show all {paymentsWithBilling.length}
                </button>
              ) : null}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-ui font-semibold text-slate-900">Access</h2>
                {!editingAccess ? (
                  <button type="button" onClick={() => setEditingAccess(true)} className={buttonClass("quiet", "small")}>
                    Change
                  </button>
                ) : null}
              </div>
              {editingAccess ? (
                <div className="mt-3">
                  <p className="mb-3 text-caption text-slate-500">Lock the tier so Stripe can&apos;t change it, for free or hand-given access.</p>
                  {renderAccessForm(true)}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccess(false);
                      setAccessDraft({ access_tier: coach.access_tier, access_tier_locked: coach.access_tier_locked, recurring_payment_status: coach.recurring_payment_status ?? "" });
                      setAccessMsg(null);
                    }}
                    className={buttonClass("quiet", "small", "mt-2")}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Tier</dt>
                    <dd className="flex items-center gap-1.5 font-medium text-slate-900">
                      {coach.access_tier_locked ? <Lock className="size-3.5 text-slate-400" aria-label="Locked: Stripe can't change it" /> : null}
                      {COACH_ACCESS_TIER_LABELS[coach.access_tier]}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Billing status</dt>
                    <dd className="font-medium text-slate-900">
                      {coach.recurring_payment_status ? COACH_RECURRING_PAYMENT_LABELS[coach.recurring_payment_status] : <span className="font-normal text-slate-400">Not set</span>}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </aside>

      <div className="lg:col-start-1 lg:row-start-2">{removeAccessBlock}</div>
    </div>
  );

  const tabButton = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setActiveTab(id);
        const url = new URL(window.location.href);
        if (id === "overview") {
          url.searchParams.delete("tab");
        } else {
          url.searchParams.set("tab", id);
        }
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
      }}
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
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading coach…
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && coach ? (
        <div className="space-y-4">
          {/* Like a project in Linear (Zander, 21 Nov): one slim row under the top bar,
              "Coaches › Name" then the coach's tabs. The big name block shows on Overview only. */}
          <div className="-mx-4 -mt-6 flex flex-wrap items-center gap-x-8 gap-y-1 border-b border-slate-200 bg-white px-4 md:-mx-8 md:px-8">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 py-2 text-sm">
              <Link href={back.href} title={`Back to ${back.label}`} className="shrink-0 font-medium text-slate-500 hover:text-slate-900">
                Coaches
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden />
              {coach.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coach.avatar_url} alt="" className="size-5 shrink-0 rounded-full object-cover" />
              ) : null}
              <span className="truncate font-semibold text-slate-900">{displayName}</span>
            </nav>
            <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1" aria-label="Coach sections">
              {tabButton("overview", "Overview")}
              {tabButton("getting-live", "Launch")}
              {tabButton("sources", "Sources")}
              {tabButton("ava", "Ava")}
            </nav>
          </div>

          {activeTab === "overview" ? overviewV2 : null}

          {activeTab === "getting-live" ? <CoachGettingLive coachId={coach.id} /> : null}

          {activeTab === "sources" ? <AdminCoachSources coachSlug={coach.slug} /> : null}

          {activeTab === "ava" ? (
            <AdminCoachAva coachId={coach.id} coachSlug={coach.slug} coachName={coach.full_name?.trim() || coach.coach_business_name || "this coach"} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
