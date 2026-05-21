"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { loadCallTableRows } from "@/lib/loadCallTableRows";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { CallsTable, type CallRow } from "@/components/calls/CallsTable";

export default function AdminCallsPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<
    Array<{
      id: string;
      full_name: string | null;
      coach_business_name: string | null;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
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
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach/calls");
        return;
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Unable to load calls.");
        setLoading(false);
        return;
      }

      try {
        const [rows, coachesRes] = await Promise.all([
          loadCallTableRows(supabaseClient),
          fetch("/api/admin/coaches", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        if (cancelled) return;
        setCalls(rows);

        if (coachesRes.ok) {
          const coachesBody = (await coachesRes.json()) as {
            coaches?: Array<{
              id: string;
              full_name?: string | null;
              coach_business_name?: string | null;
            }>;
          };
          setCoaches(
            (coachesBody.coaches ?? []).map((coach) => ({
              id: coach.id,
              full_name: coach.full_name ?? null,
              coach_business_name: coach.coach_business_name ?? null,
            }))
          );
        }
      } catch (err) {
        console.error("admin/calls load:", err);
        if (!cancelled) {
          setError("Unable to load calls.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const coachOptionsFromCalls = Array.from(
    new Map(
      calls.map((row) => [
        row.coach_id,
        {
          id: row.coach_id!,
          label:
            row.coach_name ??
            row.coach_business_name ??
            `Coach ${(row.coach_id ?? "").slice(0, 6)}`,
        },
      ])
    ).values()
  ).filter((coach) => coach.id);

  const coachOptionsFromList = coaches.map((coach) => ({
    id: coach.id,
    label:
      coach.full_name ??
      coach.coach_business_name ??
      `Coach ${coach.id.slice(0, 8)}`,
  }));

  const coachOptions =
    coachOptionsFromCalls.length > 0
      ? Array.from(
          new Map(
            [...coachOptionsFromCalls, ...coachOptionsFromList].map((coach) => [
              coach.id,
              coach,
            ])
          ).values()
        )
      : coachOptionsFromList;

  const navigateToCall = useCallback(
    (row: CallRow) => {
      if (!row.contact_id) return;
      flushSync(() => {
        if (row.coach_id) setImpersonatingCoachId(row.coach_id);
      });
      router.push(`/coach/contacts/${row.contact_id}`);
    },
    [router, setImpersonatingCoachId]
  );

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Calls"
        description="Discovery calls booked across all coaches, synced from GoHighLevel."
      />

      <div className="flex w-full flex-col gap-4">
        {loading && <p className="text-sm text-slate-600">Loading…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <CallsTable
          calls={calls}
          loading={loading}
          error={error}
          showCoachColumn={true}
          coachFilterOptions={coachOptions}
          onRowClick={navigateToCall}
          renderRowActions={(row) =>
            row.contact_id ? (
              <Link
                href={`/coach/contacts/${row.contact_id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToCall(row);
                }}
                className="font-medium text-sky-700 hover:text-sky-900"
              >
                View prospect
              </Link>
            ) : (
              <span className="text-xs text-slate-400">No linked contact</span>
            )
          }
          emptyMessage="No calls found. Bookings from GHL calendars will appear here."
        />
      </div>
    </div>
  );
}
