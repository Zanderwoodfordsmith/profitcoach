"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PLAYBOOKS } from "@/lib/bossData";

type UnlockState = Record<string, boolean>;

export default function ClientPlaybooksListPage() {
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [unlocks, setUnlocks] = useState<UnlockState>({});
  const [contactId, setContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingContactId) {
        headers["x-impersonate-contact-id"] = impersonatingContactId;
      }
      const res = await fetch("/api/client/me", { headers });

      if (cancelled) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load.");
        setLoading(false);
        return;
      }

      const body = (await res.json()) as {
        contact?: { id: string };
      };

      const cid = body.contact?.id ?? null;
      setContactId(cid);

      if (cid) {
        const unlocksHeaders: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (impersonatingContactId) {
          unlocksHeaders["x-impersonate-contact-id"] = impersonatingContactId;
        }
        const unlocksRes = await fetch(
          `/api/client/playbooks/unlocks?contact_id=${encodeURIComponent(cid)}`,
          { headers: unlocksHeaders }
        );
        if (unlocksRes.ok) {
          const unlocksBody = (await unlocksRes.json()) as {
            unlocks?: string[];
          };
          const map: UnlockState = {};
          for (const ref of unlocksBody.unlocks ?? []) {
            map[ref] = true;
          }
          setUnlocks(map);
        }
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          Profit System
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Playbooks
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse the full Profit System. Unlocked playbooks are available to
          you; others can be unlocked by your coach.
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
              return (
                <li key={p.ref}>
                  <Link
                    href={`/client/playbooks/${p.ref}`}
                    className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 ${
                      unlocked ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    <span className="font-medium">
                      {p.ref} {p.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        unlocked
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
