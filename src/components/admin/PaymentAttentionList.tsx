"use client";

import Link from "next/link";

import { ProgrammeShortfallInfo } from "@/components/admin/ProgrammeShortfallInfo";
import {
  formatPaymentDate,
  formatPaymentMoney,
} from "@/lib/adminPaymentDisplay";
import type {
  OverdueProgrammeCoach,
  UnrecoveredFailedCharge,
} from "@/lib/admin/programmeShortfall";

type Props = {
  overdue: OverdueProgrammeCoach[];
  failed: UnrecoveredFailedCharge[];
  loading: boolean;
};

function coachHref(slug: string): string {
  return `/admin/coaches/${encodeURIComponent(slug)}?tab=payments`;
}

function formatJoinDate(value: string): string {
  const day = value.slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return formatPaymentDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function PaymentAttentionList({ overdue, failed, loading }: Props) {
  if (loading) {
    return <p className="px-4 py-4 text-sm text-slate-600">Loading payments…</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <section>
        <h2 className="sticky top-0 z-10 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-yellow-950">
          Overdue · {overdue.length}
        </h2>
        {overdue.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-600">
            No coaches are short of the programme price for when they joined.
          </p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Coach</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 font-medium">Paid</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Still owed</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((coach) => (
                <tr key={coach.id} className="border-t border-yellow-100 bg-yellow-50/60">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Link
                        href={coachHref(coach.slug)}
                        className="font-medium text-[#0c5290] hover:underline"
                      >
                        {coach.name}
                      </Link>
                      <ProgrammeShortfallInfo explanation={coach.shortfall.explanation} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatJoinDate(coach.joinedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-800">
                    {formatPaymentMoney(coach.shortfall.paid_cents, "GBP")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-800">
                    {formatPaymentMoney(coach.shortfall.expected_cents, "GBP")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-yellow-950">
                    {formatPaymentMoney(coach.shortfall.short_cents, "GBP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border-t border-slate-200">
        <h2 className="sticky top-0 z-10 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-950">
          Failed payments · {failed.length}
        </h2>
        {failed.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-600">
            Every failed charge was followed by a successful payment of the same amount.
          </p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Coach</th>
                <th className="px-3 py-2 font-medium">Failed</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((charge) => {
                const detail =
                  charge.declineReason?.trim() ||
                  charge.description?.trim() ||
                  "Card was declined";
                return (
                  <tr key={charge.key} className="border-t border-rose-100 bg-rose-50/40">
                    <td className="px-4 py-2">
                      {charge.coachSlug ? (
                        <Link
                          href={coachHref(charge.coachSlug)}
                          className="font-medium text-[#0c5290] hover:underline"
                        >
                          {charge.coachName}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{charge.coachName}</span>
                      )}
                      {charge.failureCount > 1 ? (
                        <p className="text-xs text-slate-500">
                          {charge.failureCount} failed charges
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {formatPaymentDate(charge.latestPaidAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-800">
                      {formatPaymentMoney(charge.latestAmountCents, charge.latestCurrency)}
                    </td>
                    <td className="max-w-[20rem] truncate px-3 py-2 text-slate-600" title={detail}>
                      {detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
