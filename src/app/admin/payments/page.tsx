"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
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
  customer_email: string;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string;
  assignment_method: string;
  notes: string | null;
  assigned_coach: CoachOption | null;
  suggested_coach: CoachOption | null;
};

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function coachLabel(coach: CoachOption): string {
  return coach.full_name?.trim() || coach.slug;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("gbp");
  const [paidAt, setPaidAt] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [notes, setNotes] = useState("");
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});

  const coachOptions = useMemo(
    () =>
      coaches.map((coach) => ({
        value: coach.id,
        label: `${coachLabel(coach)} (${coach.slug})`,
      })),
    [coaches]
  );

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

  async function saveAssignment(paymentId: string) {
    const coachId = assignmentDrafts[paymentId] || null;
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in.");
      return;
    }

    setSavingId(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ coachId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to update assignment.");
      }
      await loadPayments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
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
      await loadPayments();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreatingPayment(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Payments"
        description="Track incoming payments and link each one to a coach."
        descriptionPlacement="below"
        tabs={<CoachesHubTabs />}
      />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add payment</h2>
        <p className="mt-1 text-xs text-slate-600">
          Fast capture flow: assign manually now, or leave blank to auto-match by email.
        </p>
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
          <div className="md:col-span-3 flex items-center justify-between gap-3">
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

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[70rem] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Paid at</th>
              <th className="px-3 py-2">Customer email</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Coach</th>
              <th className="px-3 py-2">Suggested</th>
              <th className="px-3 py-2">Assignment</th>
              <th className="px-3 py-2 text-center">Save</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {formatDateTime(payment.paid_at)}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  <div className="font-medium">{payment.customer_email}</div>
                  {payment.notes ? <div className="text-xs text-slate-500">{payment.notes}</div> : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-900">
                  {formatMoney(payment.amount_cents, payment.currency)}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {payment.assigned_coach ? coachLabel(payment.assigned_coach) : <span className="text-slate-400">Unassigned</span>}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {payment.suggested_coach ? coachLabel(payment.suggested_coach) : <span className="text-slate-400">No unique match</span>}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={assignmentDrafts[payment.id] ?? ""}
                    onChange={(e) =>
                      setAssignmentDrafts((prev) => ({
                        ...prev,
                        [payment.id]: e.target.value,
                      }))
                    }
                    disabled={savingId === payment.id}
                    className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Unassigned</option>
                    {coachOptions.map((coach) => (
                      <option key={coach.value} value={coach.value}>
                        {coach.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => void saveAssignment(payment.id)}
                    disabled={savingId === payment.id}
                    className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {savingId === payment.id ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-600">
                  Loading payments…
                </td>
              </tr>
            ) : null}
            {!loading && !error && payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-600">
                  No payments yet. Add one above to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
