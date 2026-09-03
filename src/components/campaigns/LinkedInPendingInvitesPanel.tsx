"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type Invite = {
  id: string;
  invited_user?: string | null;
  invited_user_public_id?: string | null;
  invited_user_description?: string | null;
  parsed_datetime?: string | null;
  date?: string;
  invitation_text?: string | null;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export function LinkedInPendingInvitesPanel() {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [invites, setInvites] = useState<Invite[]>([]);
  const [total, setTotal] = useState(0);
  const [withdrawCount, setWithdrawCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/coach/linkedin-outreach/invitations", {
      headers,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Could not load invites.");
    setInvites(body.invitations ?? []);
    setTotal(body.total ?? 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-slate-500">
        Loading pending invites…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <div>
        <Link
          href={`${prefix}/campaigns`}
          className="text-xs font-medium text-slate-500 hover:text-[#0c5290]"
        >
          ← Campaigns
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Pending connection requests
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {total} pending on LinkedIn. Withdraw older ones to stay under limits.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {note ? <p className="text-xs text-slate-600">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
        <input
          type="number"
          min={1}
          max={50}
          value={withdrawCount}
          onChange={(e) =>
            setWithdrawCount(
              Math.min(50, Math.max(1, Number(e.target.value || 10)))
            )
          }
          className="w-16 rounded-xl border border-slate-200 px-2 py-2 text-xs"
        />
        <button
          type="button"
          disabled={busy || total === 0}
          onClick={async () => {
            if (
              !window.confirm(
                `Withdraw the ${withdrawCount} oldest pending connection requests?`
              )
            ) {
              return;
            }
            setBusy(true);
            setError(null);
            try {
              const headers = await authHeaders();
              if (!headers) throw new Error("Sign in required.");
              const res = await fetch(
                "/api/coach/linkedin-outreach/invitations",
                {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    action: "withdraw_oldest",
                    count: withdrawCount,
                  }),
                }
              );
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body.error || "Withdraw failed.");
              setInvites(body.invitations ?? []);
              setTotal(body.total ?? 0);
              setNote(
                `Withdrew ${body.withdrawn ?? 0} of ${body.attempted ?? 0}.`
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Withdraw failed.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          Withdraw oldest
        </button>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {invites.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No pending invites.
          </li>
        ) : (
          invites.map((invite) => (
            <li
              key={invite.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">
                  {invite.invited_user ||
                    invite.invited_user_public_id ||
                    "Unknown"}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {invite.invited_user_description ||
                    invite.invitation_text ||
                    "Pending"}
                  {invite.parsed_datetime || invite.date
                    ? ` · ${invite.parsed_datetime || invite.date}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const headers = await authHeaders();
                    if (!headers) throw new Error("Sign in required.");
                    const res = await fetch(
                      "/api/coach/linkedin-outreach/invitations",
                      {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                          action: "withdraw",
                          invitation_id: invite.id,
                        }),
                      }
                    );
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(body.error || "Withdraw failed.");
                    setInvites(body.invitations ?? []);
                    setTotal(body.total ?? 0);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Withdraw failed."
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
                className="shrink-0 text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
              >
                Withdraw
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
