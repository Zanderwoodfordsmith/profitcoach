"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";

type RevenueLine = {
  id: string;
  contact_id: string | null;
  amount: string | number;
  currency: string;
  occurred_on: string;
  source: string;
  note: string | null;
  created_at: string;
};

type ClientOption = {
  id: string;
  full_name: string;
  business_name: string | null;
};

type MatrixRow = {
  contactId: string | null;
  label: string;
  cells: Record<string, number>;
  rowTotal: number;
};

type MatrixPayload = {
  months: string[];
  rows: MatrixRow[];
  unallocated: MatrixRow | null;
  columnTotals: Record<string, number>;
  currencyNote: string | null;
};

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.length === 3 ? currency : "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function MatrixUnallocatedRow({
  row,
  months,
  defaultCurrency,
}: {
  row: MatrixRow;
  months: string[];
  defaultCurrency: string;
}) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="sticky left-0 z-10 border-r border-t border-slate-100 bg-amber-50/80 px-4 py-2 font-medium text-slate-900">
        {row.label}
      </td>
      {months.map((mk) => (
        <td
          key={`un-${mk}`}
          className="border-t border-slate-100 bg-amber-50/50 px-2 py-1.5 text-center"
        >
          {row.cells[mk]
            ? formatMoney(row.cells[mk], defaultCurrency)
            : "—"}
        </td>
      ))}
      <td className="border-t border-slate-100 bg-amber-50/50 px-2 py-1.5 text-center font-semibold">
        {row.rowTotal ? formatMoney(row.rowTotal, defaultCurrency) : "—"}
      </td>
    </tr>
  );
}

async function coachAuthHeaders(): Promise<{
  headers: Record<string, string>;
  role: string;
  error?: string;
}> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) {
    return { headers: {}, role: "", error: "Not signed in." };
  }
  const roleRes = await fetch("/api/profile-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: session.user.id }),
  });
  const roleBody = (await roleRes.json().catch(() => ({}))) as {
    role?: string;
  };
  if (!roleRes.ok || !roleBody.role) {
    return { headers: {}, role: "", error: "Unable to load profile." };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  return { headers, role: roleBody.role };
}

export default function CoachIncomePage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [tab, setTab] = useState<"ledger" | "matrix">("ledger");
  const [lines, setLines] = useState<RevenueLine[]>([]);
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null);
  const [snapshot3m, setSnapshot3m] = useState<{
    total: number;
    currency: string;
  } | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayLocalISO);
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editOccurredOn, setEditOccurredOn] = useState("");
  const [editContactId, setEditContactId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const auth = await coachAuthHeaders();
    if (auth.error) {
      setError(auth.error);
      setLoading(false);
      return;
    }
    if (auth.role === "admin" && !impersonatingCoachId) {
      router.replace("/admin");
      setLoading(false);
      return;
    }
    const headers = { ...auth.headers };
    if (auth.role === "admin" && impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const [linesRes, matrixRes, matrix3Res, clientsRes] = await Promise.all([
      fetch("/api/coach/revenue-lines", { headers }),
      fetch("/api/coach/revenue-matrix?months=12", { headers }),
      fetch("/api/coach/revenue-matrix?months=3", { headers }),
      fetch("/api/coach/clients", { headers }),
    ]);

    if (!linesRes.ok) {
      const b = (await linesRes.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Unable to load income entries.");
      setLoading(false);
      return;
    }
    if (!matrixRes.ok) {
      const b = (await matrixRes.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Unable to load matrix.");
      setLoading(false);
      return;
    }

    const linesBody = (await linesRes.json()) as { lines?: RevenueLine[] };
    const matrixBody = (await matrixRes.json()) as MatrixPayload;
    setLines(linesBody.lines ?? []);
    setMatrix(matrixBody);

    if (matrix3Res.ok) {
      const m3 = (await matrix3Res.json()) as MatrixPayload;
      const cur = Object.values(m3.columnTotals).reduce((a, b) => a + b, 0);
      const sampleLine = linesBody.lines?.[0];
      const curCode =
        typeof sampleLine?.currency === "string" ? sampleLine.currency : "GBP";
      setSnapshot3m({ total: Math.round(cur * 100) / 100, currency: curCode });
    }

    if (clientsRes.ok) {
      const cBody = (await clientsRes.json()) as {
        clients?: Array<{
          id: string;
          full_name: string;
          business_name: string | null;
        }>;
      };
      setClients(
        (cBody.clients ?? []).map((c) => ({
          id: c.id,
          full_name: c.full_name,
          business_name: c.business_name,
        }))
      );
    }

    setLoading(false);
  }, [router, impersonatingCoachId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) {
      m.set(c.id, c.full_name || c.business_name || "Client");
    }
    return m;
  }, [clients]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const auth = await coachAuthHeaders();
      if (!auth.headers.Authorization) throw new Error("Not signed in.");
      const headers: Record<string, string> = {
        ...auth.headers,
        "Content-Type": "application/json",
      };
      if (auth.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch("/api/coach/revenue-lines", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount,
          occurredOn,
          contactId: contactId || null,
          note: note || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to save.");
      setAmount("");
      setNote("");
      setOccurredOn(todayLocalISO());
      setContactId("");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(line: RevenueLine) {
    setEditingId(line.id);
    setEditAmount(String(line.amount));
    setEditOccurredOn(line.occurred_on);
    setEditContactId(line.contact_id ?? "");
    setEditNote(line.note ?? "");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setError(null);
    try {
      const auth = await coachAuthHeaders();
      if (!auth.headers.Authorization) throw new Error("Not signed in.");
      const headers: Record<string, string> = {
        ...auth.headers,
        "Content-Type": "application/json",
      };
      if (auth.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch(`/api/coach/revenue-lines/${editingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          amount: editAmount,
          occurredOn: editOccurredOn,
          contactId: editContactId || null,
          note: editNote,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to update.");
      setEditingId(null);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this income entry?")) return;
    setError(null);
    try {
      const auth = await coachAuthHeaders();
      if (!auth.headers.Authorization) throw new Error("Not signed in.");
      const headers = { ...auth.headers };
      if (auth.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch(`/api/coach/revenue-lines/${id}`, {
        method: "DELETE",
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to delete.");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to delete.");
    }
  }

  const defaultCurrency = lines[0]?.currency ?? "GBP";

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Income"
        description="Log cash received (bank transfer, card, etc.). Totals roll up by client and month."
        descriptionPlacement="below"
      />

      {snapshot3m && !loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last 3 months (logged)
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatMoney(snapshot3m.total, snapshot3m.currency)}
          </p>
          {matrix?.currencyNote ? (
            <p className="mt-1 text-xs text-amber-700">{matrix.currencyNote}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            tab === "ledger"
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Income entries
        </button>
        <button
          type="button"
          onClick={() => setTab("matrix")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            tab === "matrix"
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Client × month
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {tab === "ledger" ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Add income</h2>
            <form
              onSubmit={(e) => void submitAdd(e)}
              className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Amount
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1500"
                  className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Date received
                </label>
                <input
                  type="date"
                  required
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-700">
                  Client (optional)
                </label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Other / unallocated</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                      {c.business_name ? ` · ${c.business_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-700">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Invoice #12"
                  className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Add entry"}
                </button>
              </div>
            </form>
          </section>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-slate-600">
                      Loading…
                    </td>
                  </tr>
                ) : lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-slate-600">
                      No entries yet. Add your first payment above.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-100">
                      {editingId === line.id ? (
                        <>
                          <td colSpan={5} className="px-4 py-3">
                            <form
                              onSubmit={(e) => void submitEdit(e)}
                              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                            >
                              <input
                                type="date"
                                value={editOccurredOn}
                                onChange={(e) => setEditOccurredOn(e.target.value)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                              <select
                                value={editContactId}
                                onChange={(e) => setEditContactId(e.target.value)}
                                className="max-w-xs rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                <option value="">Other / unallocated</option>
                                {clients.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.full_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="min-w-[8rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              />
                              <button
                                type="submit"
                                disabled={editSaving}
                                className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs text-slate-600"
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-800">
                            {line.occurred_on}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {line.contact_id
                              ? clientNameById.get(line.contact_id) ?? "—"
                              : "Other / unallocated"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                            {formatMoney(
                              typeof line.amount === "string"
                                ? Number.parseFloat(line.amount)
                                : line.amount,
                              line.currency
                            )}
                          </td>
                          <td className="max-w-[14rem] truncate px-4 py-2 text-slate-600">
                            {line.note ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => startEdit(line)}
                              className="mr-2 text-xs font-medium text-sky-700 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(line.id)}
                              className="text-xs font-medium text-rose-700 hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "matrix" && matrix ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="sticky left-0 z-20 min-w-[12rem] border-b border-r border-slate-200 bg-slate-50 px-4 py-2">
                  Client
                </th>
                {matrix.months.map((mk) => (
                  <th
                    key={mk}
                    className="min-w-[5rem] border-b border-slate-200 px-2 py-2 text-center"
                  >
                    {formatMonthLabel(mk)}
                  </th>
                ))}
                <th className="min-w-[5rem] border-b border-slate-200 px-2 py-2 text-center">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.contactId || "row"} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 border-r border-t border-slate-100 bg-white px-4 py-2 font-medium text-slate-900">
                    {row.label}
                  </td>
                  {matrix.months.map((mk) => (
                    <td
                      key={`${row.contactId}-${mk}`}
                      className="border-t border-slate-100 px-2 py-1.5 text-center text-slate-800"
                    >
                      {row.cells[mk] ? formatMoney(row.cells[mk], defaultCurrency) : "—"}
                    </td>
                  ))}
                  <td className="border-t border-slate-100 px-2 py-1.5 text-center font-semibold text-slate-900">
                    {row.rowTotal ? formatMoney(row.rowTotal, defaultCurrency) : "—"}
                  </td>
                </tr>
              ))}
              {matrix.unallocated ? (
                <MatrixUnallocatedRow
                  row={matrix.unallocated}
                  months={matrix.months}
                  defaultCurrency={defaultCurrency}
                />
              ) : null}
              <tr className="bg-slate-100 font-semibold text-slate-900">
                <td className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-100 px-4 py-2">
                  Column totals
                </td>
                {matrix.months.map((mk) => (
                  <td key={`tot-${mk}`} className="border-t border-slate-200 px-2 py-2 text-center">
                    {matrix.columnTotals[mk]
                      ? formatMoney(matrix.columnTotals[mk], defaultCurrency)
                      : "—"}
                  </td>
                ))}
                <td className="border-t border-slate-200 px-2 py-2 text-center">
                  {formatMoney(
                    Object.values(matrix.columnTotals).reduce((a, b) => a + b, 0),
                    defaultCurrency
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "matrix" && loading ? (
        <p className="text-sm text-slate-600">Loading matrix…</p>
      ) : null}
    </div>
  );
}
