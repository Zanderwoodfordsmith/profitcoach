"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { LinkedInInterestQueue } from "@/components/campaigns/LinkedInInterestQueue";

type Account = {
  id: string;
  unipile_account_id: string;
  status: string;
  display_name: string | null;
};

type CampaignProgress = {
  sent: number;
  connected: number;
  replied: number;
  interested?: number;
  failed: number;
  queued: number;
  remaining: number;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  daily_invite_limit: number;
  lead_count?: number;
  status_counts?: Record<string, number>;
  progress?: CampaignProgress;
  created_at?: string;
  updated_at: string;
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

function statusLabel(status: string) {
  if (status === "running") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: string) {
  switch (status) {
    case "running":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "paused":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "completed":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "draft":
    default:
      return "bg-sky-50 text-sky-800 ring-sky-200";
  }
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatLaunch(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function MetricRing({
  value,
  label,
  pct,
  color,
}: {
  value: string | number;
  label: string;
  pct: number;
  color: string;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;

  return (
    <div className="flex w-[4.25rem] flex-col items-center gap-1">
      <div className="relative h-12 w-12">
        <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3.5"
          />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-800">
          {value}
        </span>
      </div>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  pct,
  color,
}: {
  label: string;
  value: string | number;
  hint: string;
  pct: number;
  color: string;
}) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-200/40">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>
      </div>
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
    </div>
  );
}

export function LinkedInCampaignsOverview() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [configured, setConfigured] = useState(true);
  const [inviteTotal, setInviteTotal] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);

  const primaryAccount = accounts[0] ?? null;

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const [accRes, campRes, invRes] = await Promise.all([
      fetch("/api/coach/linkedin-outreach/accounts", { headers }),
      fetch("/api/coach/linkedin-outreach/campaigns", { headers }),
      fetch("/api/coach/linkedin-outreach/invitations", { headers }),
    ]);
    const accBody = await accRes.json().catch(() => ({}));
    const campBody = await campRes.json().catch(() => ({}));
    const invBody = await invRes.json().catch(() => ({}));
    if (!accRes.ok) throw new Error(accBody.error || "Could not load accounts.");
    if (!campRes.ok) throw new Error(campBody.error || "Could not load campaigns.");
    setConfigured(accBody.configured !== false);
    setAccounts(accBody.accounts ?? []);
    setCampaigns(campBody.campaigns ?? []);
    setInviteTotal(invBody.total ?? 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
        if (searchParams.get("linkedin") === "connected") {
          const headers = await authHeaders();
          if (headers) {
            await fetch("/api/coach/linkedin-outreach/accounts", {
              method: "POST",
              headers,
              body: JSON.stringify({ action: "sync" }),
            });
            if (!cancelled) await load();
          }
        }
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
  }, [load, searchParams]);

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => {
        acc.leads += c.lead_count ?? 0;
        acc.sent += c.progress?.sent ?? 0;
        acc.connected += c.progress?.connected ?? 0;
        acc.replied += c.progress?.replied ?? 0;
        acc.interested += c.progress?.interested ?? 0;
        acc.running += c.status === "running" ? 1 : 0;
        return acc;
      },
      { leads: 0, sent: 0, connected: 0, replied: 0, interested: 0, running: 0 }
    );
  }, [campaigns]);

  const acceptRate =
    totals.sent > 0 ? Math.round((totals.connected / totals.sent) * 100) : 0;
  const interestRate =
    totals.connected > 0
      ? Math.round((totals.interested / totals.connected) * 100)
      : totals.replied > 0
        ? Math.round((totals.interested / totals.replied) * 100)
        : 0;
  const replyRate =
    totals.connected > 0
      ? Math.round((totals.replied / totals.connected) * 100)
      : totals.sent > 0
        ? Math.round((totals.replied / totals.sent) * 100)
        : 0;

  async function connectLinkedIn() {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start LinkedIn connect.");
      }
      window.location.href = body.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(false);
    }
  }

  async function createCampaign() {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/campaigns", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newName.trim() || "Untitled campaign",
          outreach_account_id: primaryAccount?.id ?? null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Create failed.");
      setNewName("");
      setShowCreate(false);
      router.push(`${prefix}/campaigns/${body.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
      setBusy(false);
    }
  }

  async function quickToggle(campaign: Campaign) {
    setBusy(true);
    setError(null);
    setMenuId(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const next = campaign.status === "running" ? "paused" : "running";
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaign.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            status: next,
            outreach_account_id: primaryAccount?.id ?? null,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Update failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center text-sm text-slate-500">
        Loading campaigns…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your LinkedIn outreach campaigns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${prefix}/campaigns/invites`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Invites{inviteTotal ? ` (${inviteTotal})` : ""}
          </Link>
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void connectLinkedIn()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {primaryAccount
              ? primaryAccount.display_name || "LinkedIn connected"
              : "Connect LinkedIn"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-[#0c5290] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
          >
            + New Campaign
          </button>
        </div>
      </header>

      {showCreate ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. SaaS Founders Outreach"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none ring-[#0c5290]/30 placeholder:text-slate-400 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") void createCampaign();
              if (e.key === "Escape") setShowCreate(false);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createCampaign()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Campaigns"
          value={campaigns.length}
          hint={`${totals.running} active`}
          pct={
            campaigns.length
              ? (totals.running / campaigns.length) * 100
              : 0
          }
          color="#1a8fd4"
        />
        <SummaryCard
          label="Total Contacts"
          value={totals.leads}
          hint={`${totals.connected} connected`}
          pct={totals.leads ? (totals.connected / totals.leads) * 100 : 0}
          color="#0c5290"
        />
        <SummaryCard
          label="Interest rate"
          value={`${interestRate}%`}
          hint={`${totals.interested} interested (north star)`}
          pct={interestRate}
          color="#059669"
        />
        <SummaryCard
          label="Reply rate"
          value={`${replyRate}%`}
          hint={`${totals.replied} replies logged`}
          pct={replyRate}
          color="#ea580c"
        />
      </section>

      <LinkedInInterestQueue />

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">All Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-800">No campaigns yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create one to build a sequence and add LinkedIn leads.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-[#0c5290] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0a457a]"
            >
              + New Campaign
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const progress = c.progress ?? {
                sent: 0,
                connected: 0,
                replied: 0,
                failed: 0,
                queued: c.lead_count ?? 0,
                remaining: c.lead_count ?? 0,
              };
              const contacts = c.lead_count ?? 0;
              const acceptPct =
                progress.sent > 0
                  ? Math.round((progress.connected / progress.sent) * 100)
                  : 0;
              const accountLabel =
                primaryAccount?.display_name ||
                (primaryAccount ? "LinkedIn account" : "No account");

              return (
                <li key={c.id} className="relative">
                  <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`${prefix}/campaigns/${c.id}`)
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                          {c.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(c.status)}`}
                        >
                          {statusLabel(c.status)}
                        </span>
                        <span className="max-w-[10rem] truncate rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-inset ring-sky-100">
                          {accountLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {c.daily_invite_limit}/day invite cap
                        {contacts
                          ? ` · ${contacts} contact${contacts === 1 ? "" : "s"}`
                          : " · No contacts yet"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatLaunch(c.created_at)
                          ? `Launched ${formatLaunch(c.created_at)}`
                          : "Draft"}
                        {" · "}
                        Last activity: {relativeTime(c.updated_at)}
                      </p>
                    </button>

                    <div className="flex items-center gap-1 sm:gap-2">
                      <MetricRing
                        value={contacts}
                        label="Contacts"
                        pct={100}
                        color="#94a3b8"
                      />
                      <MetricRing
                        value={progress.sent}
                        label="Sent"
                        pct={contacts ? (progress.sent / contacts) * 100 : 0}
                        color="#0c5290"
                      />
                      <MetricRing
                        value={progress.connected}
                        label="Connected"
                        pct={
                          progress.sent
                            ? (progress.connected / progress.sent) * 100
                            : 0
                        }
                        color="#059669"
                      />
                      <MetricRing
                        value={progress.replied}
                        label="Replied"
                        pct={
                          progress.connected
                            ? (progress.replied / progress.connected) * 100
                            : 0
                        }
                        color="#0284c7"
                      />
                      <MetricRing
                        value={`${acceptPct}%`}
                        label="Accept %"
                        pct={acceptPct}
                        color="#ea580c"
                      />

                      <div className="relative ml-1">
                        <button
                          type="button"
                          aria-label="Campaign actions"
                          onClick={() =>
                            setMenuId((id) => (id === c.id ? null : c.id))
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className="h-4 w-4"
                            fill="currentColor"
                            aria-hidden
                          >
                            <circle cx="8" cy="3" r="1.5" />
                            <circle cx="8" cy="8" r="1.5" />
                            <circle cx="8" cy="13" r="1.5" />
                          </svg>
                        </button>
                        {menuId === c.id ? (
                          <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() =>
                                router.push(`${prefix}/campaigns/${c.id}`)
                              }
                            >
                              Open editor
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy ||
                                (!primaryAccount && c.status !== "running")
                              }
                              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              onClick={() => void quickToggle(c)}
                            >
                              {c.status === "running" ? "Pause" : "Start"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
