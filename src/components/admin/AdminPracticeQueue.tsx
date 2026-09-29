"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { PracticeStatus } from "@/lib/practiceKnowledge/types";

type QueueItem = {
  coach_id: string;
  status: PracticeStatus;
  completeness_score: number;
  missing_fields: string[];
  updated_at: string;
  full_name: string;
  slug: string;
  avatar_url: string | null;
  coach_business_name: string | null;
  last_session_at: string | null;
  last_session_status: string | null;
  decision_call_booked_at: string | null;
};

export function AdminPracticeQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const headers = await getCoachAuthHeaders();
      if (!headers) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/practice", { headers });
      const body = (await res.json().catch(() => null)) as
        | { items?: QueueItem[]; error?: string }
        | null;
      if (!res.ok) {
        setError(body?.error || "Could not load the queue.");
        setLoading(false);
        return;
      }
      setItems(body?.items ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Capture status for every coach. Open a record to review knowledge, the
        interview, and lock the Decision Record.
      </p>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !items.length ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No records yet. They appear when a coach opens their blueprint.
        </p>
      ) : null}
      {items.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Coach</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Complete</th>
                <th className="px-4 py-3 font-medium">Last session</th>
                <th className="px-4 py-3 font-medium">Decision Call</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.coach_id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/blueprint/records/${item.coach_id}`}
                      className="font-medium text-sky-800 hover:text-sky-950"
                    >
                      {item.full_name}
                    </Link>
                    {item.coach_business_name ? (
                      <p className="text-xs text-slate-500">{item.coach_business_name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.status.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.completeness_score}%</td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.last_session_at
                      ? new Date(item.last_session_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.decision_call_booked_at
                      ? new Date(item.decision_call_booked_at).toLocaleDateString()
                      : "Not booked"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
