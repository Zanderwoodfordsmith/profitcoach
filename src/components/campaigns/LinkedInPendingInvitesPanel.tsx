"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { PendingInvitesSpeedDial } from "@/components/campaigns/PendingInvitesSpeedDial";
import {
  AUTO_DAILY_MAX,
  DEFAULT_KEEP_UNDER,
  MANUAL_WITHDRAW_MAX,
  inviteAgeDays,
  withdrawPolicySummary,
  type InviteWithdrawPolicy,
} from "@/lib/unipile/inviteWithdraw";

type Invite = {
  id: string;
  invited_user?: string | null;
  invited_user_public_id?: string | null;
  invited_user_description?: string | null;
  parsed_datetime?: string | null;
  date?: string;
  invitation_text?: string | null;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  return getCoachAuthHeaders();
}

function ageLabel(iso: string | null | undefined): string | null {
  const days = inviteAgeDays(iso);
  if (days == null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function LinkedInPendingInvitesPanel() {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [invites, setInvites] = useState<Invite[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [withdrawCount, setWithdrawCount] = useState(10);
  const [policy, setPolicy] = useState<InviteWithdrawPolicy>({
    mode: "off",
    value: DEFAULT_KEEP_UNDER,
    ranOn: null,
    ranCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const autoOn = policy.mode !== "off";

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      "/api/coach/linkedin-outreach/invitations?full=1",
      { headers }
    );
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error(body.error || "Sign in required.");
    if (!res.ok && !body.withdraw) {
      throw new Error(body.error || "Could not load invites.");
    }
    setInvites(body.invitations ?? []);
    setTotal(body.total ?? 0);
    setHasMore(Boolean(body.has_more));
    if (typeof body.error === "string" && body.error) {
      setError(body.error);
    } else {
      setError(null);
    }
    if (body.withdraw) {
      setPolicy(body.withdraw as InviteWithdrawPolicy);
    }
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

  const maxManual = Math.max(1, Math.min(MANUAL_WITHDRAW_MAX, total || 1));
  const clampedManual = Math.min(maxManual, Math.max(1, withdrawCount));

  async function saveAuto(on: boolean) {
    setSaving(true);
    setError(null);
    const nextMode = on ? "cap" : "off";
    setPolicy((current) => ({
      ...current,
      mode: nextMode,
      value: DEFAULT_KEEP_UNDER,
    }));
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "save_policy",
          mode: nextMode,
          value: DEFAULT_KEEP_UNDER,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save.");
      if (body.withdraw) setPolicy(body.withdraw as InviteWithdrawPolicy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function withdrawOldest() {
    if (
      !window.confirm(
        `Withdraw the ${clampedManual} oldest pending connection request${
          clampedManual === 1 ? "" : "s"
        }? This can’t be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "withdraw_oldest",
          count: clampedManual,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Withdraw failed.");
      setNote(`Withdrew ${body.withdrawn ?? 0} of ${body.attempted ?? 0}.`);
      if (body.invitations) setInvites(body.invitations);
      if (typeof body.total === "number") setTotal(body.total);
      setHasMore(Boolean(body.has_more));
      if (body.withdraw) setPolicy(body.withdraw as InviteWithdrawPolicy);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed.");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawOne(invitationId: string) {
    if (!window.confirm("Withdraw this connection request?")) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "withdraw",
          invitation_id: invitationId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Withdraw failed.");
      if (body.invitations) setInvites(body.invitations);
      if (typeof body.total === "number") setTotal(body.total);
      setHasMore(Boolean(body.has_more));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-16" aria-hidden>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200/80" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const displayPolicy: InviteWithdrawPolicy = {
    ...policy,
    mode: autoOn ? "cap" : "off",
    value: DEFAULT_KEEP_UNDER,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-16">
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
          Withdraw the oldest so new invites can go out. Auto-clean keeps you
          under {DEFAULT_KEEP_UNDER}.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}
      {note ? (
        <p className="text-sm text-emerald-900" role="status">
          {note}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Pending load</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>
        <div className="mt-2">
          <PendingInvitesSpeedDial count={total} />
        </div>
        {hasMore ? (
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Showing oldest of {total}+ pending
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Auto-clean</h2>
            <p className="mt-0.5 text-xs leading-snug text-slate-600">
              Keep under {DEFAULT_KEEP_UNDER}. Oldest first, up to{" "}
              {AUTO_DAILY_MAX}/day on weekdays.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoOn}
            aria-label="Auto-clean pending invites"
            disabled={saving || busy}
            onClick={() => void saveAuto(!autoOn)}
            className={`relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
              autoOn ? "bg-emerald-800" : "bg-slate-300"
            }`}
          >
            {autoOn ? (
              <span
                className="pointer-events-none absolute top-1/2 left-[6px] -translate-y-1/2 text-[10px] font-bold tracking-wide text-white"
                aria-hidden
              >
                On
              </span>
            ) : null}
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                autoOn ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>
        <p className="mt-3 text-xs leading-snug text-slate-600">
          {withdrawPolicySummary(displayPolicy, total)}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Withdraw now</h2>
          <p className="mt-0.5 text-xs text-slate-600">Always the oldest first.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <NumberStepper
            ariaLabel="How many of the oldest to withdraw"
            value={clampedManual}
            min={1}
            max={maxManual}
            disabled={busy || total === 0}
            onChange={setWithdrawCount}
          />
          <button
            type="button"
            disabled={busy || total === 0}
            onClick={() => void withdrawOldest()}
            className="rounded-xl bg-[#0c5290] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
          >
            {busy ? "Withdrawing…" : `Withdraw ${clampedManual} oldest`}
          </button>
        </div>
      </section>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
        {invites.length === 0 ? (
          <li className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">Nothing pending</p>
            <p className="mt-1 text-xs text-slate-600">
              New connection requests will show up here until they’re accepted
              or withdrawn.
            </p>
          </li>
        ) : (
          invites.map((invite) => {
            const age = ageLabel(invite.parsed_datetime || invite.date);
            const name =
              invite.invited_user?.trim() ||
              invite.invited_user_public_id?.trim() ||
              "Unknown";
            return (
              <li
                key={invite.id}
                className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {name}
                  </p>
                  {invite.invited_user_description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                      {invite.invited_user_description}
                    </p>
                  ) : null}
                  {age ? (
                    <p className="mt-1 text-[11px] text-slate-600">{age}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void withdrawOne(invite.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                >
                  Withdraw
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        disabled={disabled || value <= min}
        aria-label="Decrease"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="w-12 border-x border-slate-200 bg-white py-1.5 text-center text-sm font-semibold tabular-nums text-slate-900 outline-none disabled:bg-slate-50"
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        aria-label="Increase"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
