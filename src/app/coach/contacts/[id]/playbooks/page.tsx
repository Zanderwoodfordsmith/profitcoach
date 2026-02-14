"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PLAYBOOKS } from "@/lib/bossData";

type UnlockState = Record<string, boolean>;

export default function CoachContactPlaybooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = use(params);
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [contactName, setContactName] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

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
        const body = (await res.json()) as { unlocks?: string[] };
        const map: UnlockState = {};
        for (const ref of body.unlocks ?? []) {
          map[ref] = true;
        }
        setUnlocks(map);
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [contactId, router, impersonatingCoachId]);

  async function handleToggle(ref: string, currentlyUnlocked: boolean) {
    setToggling(ref);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setToggling(null);
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
          unlocked: !currentlyUnlocked,
        }),
      }
    );

    setToggling(null);
    if (res.ok) {
      setUnlocks((prev) => ({ ...prev, [ref]: !currentlyUnlocked }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <Link
          href={`/coach/contacts/${contactId}`}
          className="text-xs text-slate-600 hover:text-slate-800"
        >
          ← Back to contact
        </Link>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          BOSS Dashboard
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Playbooks — {contactName ?? "Contact"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Unlock playbooks for this client. Unlocked playbooks are visible in
          their client portal.
        </p>
      </header>

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
              const unlocked = unlocks[p.ref] ?? false;
              const isToggling = toggling === p.ref;
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
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggle(p.ref, unlocked)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      unlocked
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    } disabled:opacity-60`}
                  >
                    {isToggling ? "…" : unlocked ? "Unlocked" : "Locked"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
