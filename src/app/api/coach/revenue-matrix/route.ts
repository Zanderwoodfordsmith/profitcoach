import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rollingMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKeyFromDate(dt));
  }
  return keys;
}

function firstDayOfMonthKey(monthKey: string): string {
  return `${monthKey}-01`;
}

function lastDayOfMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0);
  const dd = String(last.getDate()).padStart(2, "0");
  return `${y}-${String(m).padStart(2, "0")}-${dd}`;
}

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status });
  }

  const coachId = authCheck.userId;
  const url = new URL(request.url);
  const monthsParam = url.searchParams.get("months");
  const monthCount = Math.min(
    24,
    Math.max(1, Number.parseInt(monthsParam ?? "12", 10) || 12)
  );

  const monthKeys = rollingMonthKeys(monthCount);
  const from = firstDayOfMonthKey(monthKeys[0]!);
  const to = lastDayOfMonthKey(monthKeys[monthKeys.length - 1]!);

  const [{ data: clients, error: clientsErr }, { data: lines, error: linesErr }] =
    await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("id, full_name, business_name")
        .eq("coach_id", coachId)
        .eq("type", "client")
        .order("full_name", { ascending: true }),
      supabaseAdmin
        .from("coach_revenue_lines")
        .select("contact_id, amount, currency, occurred_on")
        .eq("coach_id", coachId)
        .gte("occurred_on", from)
        .lte("occurred_on", to),
    ]);

  if (clientsErr || linesErr) {
    console.error("coach/revenue-matrix:", clientsErr ?? linesErr);
    return NextResponse.json({ error: "Could not load revenue matrix." }, { status: 500 });
  }

  const monthSet = new Set(monthKeys);
  const byContactMonth = new Map<string, Map<string, { sum: number; currency: string }>>();

  function addCell(contactKey: string, mk: string, amount: number, currency: string) {
    if (!monthSet.has(mk)) return;
    let row = byContactMonth.get(contactKey);
    if (!row) {
      row = new Map();
      byContactMonth.set(contactKey, row);
    }
    const cur = row.get(mk);
    if (cur) {
      cur.sum += amount;
    } else {
      row.set(mk, { sum: amount, currency });
    }
  }

  for (const row of lines ?? []) {
    const r = row as {
      contact_id: string | null;
      amount: string | number;
      currency: string;
      occurred_on: string;
    };
    const mk = r.occurred_on.slice(0, 7);
    const amt = typeof r.amount === "string" ? Number.parseFloat(r.amount) : r.amount;
    if (!Number.isFinite(amt)) continue;
    const contactKey = r.contact_id ?? "__none__";
    addCell(contactKey, mk, amt, r.currency ?? "GBP");
  }

  const clientRows = (clients ?? []).map((c) => {
    const id = c.id as string;
    const name =
      (c.full_name as string) ||
      (c.business_name as string) ||
      "Client";
    const cells: Record<string, number> = {};
    let rowTotal = 0;
    const rowMap = byContactMonth.get(id);
    for (const mk of monthKeys) {
      const v = rowMap?.get(mk)?.sum ?? 0;
      cells[mk] = Math.round(v * 100) / 100;
      rowTotal += v;
    }
    return {
      contactId: id,
      label: name,
      cells,
      rowTotal: Math.round(rowTotal * 100) / 100,
    };
  });

  const unallocatedMap = byContactMonth.get("__none__");
  let unallocatedSum = 0;
  const unallocatedCells: Record<string, number> = {};
  for (const mk of monthKeys) {
    const v = unallocatedMap?.get(mk)?.sum ?? 0;
    unallocatedCells[mk] = Math.round(v * 100) / 100;
    unallocatedSum += v;
  }

  const columnTotals: Record<string, number> = {};
  for (const mk of monthKeys) {
    let t = unallocatedCells[mk] ?? 0;
    for (const r of clientRows) {
      t += r.cells[mk] ?? 0;
    }
    columnTotals[mk] = Math.round(t * 100) / 100;
  }

  const currencies = new Set<string>();
  for (const row of lines ?? []) {
    const cur = (row as { currency?: string }).currency;
    if (cur) currencies.add(cur);
  }
  const currencyNote =
    currencies.size > 1
      ? "Multiple currencies in this period — totals mix currencies."
      : null;

  return NextResponse.json({
    months: monthKeys,
    rows: clientRows,
    unallocated:
      Math.round(unallocatedSum * 100) / 100 > 0
        ? {
            contactId: null as string | null,
            label: "Other / unallocated",
            cells: unallocatedCells,
            rowTotal: Math.round(unallocatedSum * 100) / 100,
          }
        : null,
    columnTotals,
    currencyNote,
  });
}
