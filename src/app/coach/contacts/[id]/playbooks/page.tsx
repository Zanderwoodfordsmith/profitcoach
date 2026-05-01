"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PLAYBOOKS } from "@/lib/bossData";

type PlaybookStatus = "locked" | "in_progress" | "implemented";

const STATUS_OPTIONS: { value: PlaybookStatus; label: string }[] = [
  { value: "locked", label: "Locked" },
  { value: "in_progress", label: "In progress" },
  { value: "implemented", label: "Implemented" },
];

function statusBg(status: PlaybookStatus): string {
  return status === "implemented"
    ? "bg-green-100 text-green-800"
    : status === "in_progress"
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
}

export default function CoachContactPlaybooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = use(params);
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [contactName, setContactName] = useState<string | null>(null);
  const [statusByRef, setStatusByRef] = useState<Record<string, PlaybookStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

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

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const effectiveCoachId =
        profile?.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;

      if (profile?.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }

      const { data: contactRow } = await supabaseClient
        .from("contacts")
        .select("id, full_name, coach_id")
        .eq("id", contactId)
        .maybeSingle();

      if (cancelled) return;

      if (!contactRow || contactRow.coach_id !== effectiveCoachId) {
        setError("Contact not found or not yours.");
        setLoading(false);
        return;
      }

      setContactName(contactRow.full_name as string);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (profile?.role === "admin" && impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const res = await fetch(
        `/api/coach/contacts/${contactId}/playbooks/unlocks`,
        { headers }
      );

      if (cancelled) return;

      if (res.ok) {
        const body = (await res.json()) as {
          unlocks?: string[];
          statusByRef?: Record<string, PlaybookStatus>;
        };
        setStatusByRef(body.statusByRef ?? {});
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [contactId, router, impersonatingCoachId]);

  async function handleStatusChange(ref: string, status: PlaybookStatus) {
    setUpdating(ref);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setUpdating(null);
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }

    const res = await fetch(
      `/api/coach/contacts/${contactId}/playbooks/unlocks`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          playbook_ref: ref,
          status,
        }),
      }
    );

    setUpdating(null);
    if (res.ok) {
      setStatusByRef((prev) => ({ ...prev, [ref]: status }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        leading={
          <Link
            href={`/coach/contacts/${contactId}`}
            className="text-xs text-slate-600 hover:text-slate-800"
          >
            ← Back to contact
          </Link>
        }
        title={`Playbooks — ${contactName ?? "Contact"}`}
        description="Set status per playbook: Locked (client sees overview only), In progress, or Implemented (client sees overview + client tab)."
      />

      <div className="w-full">
      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {!loading && !error && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {PLAYBOOKS.map((p) => {
              const status = statusByRef[p.ref] ?? "locked";
              const isUpdating = updating === p.ref;
              return (
                <li
                  key={p.ref}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <Link
                    href={`/coach/contacts/${contactId}/playbooks/${p.ref}`}
                    className="flex-1 font-medium text-slate-900 hover:text-sky-700"
                  >
                    {p.ref} {p.name}
                  </Link>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(p.ref, e.target.value as PlaybookStatus)}
                    disabled={isUpdating}
                    className={`rounded-full border-0 px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${statusBg(status)}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}
