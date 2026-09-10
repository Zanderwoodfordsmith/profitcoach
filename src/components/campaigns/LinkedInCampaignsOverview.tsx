"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { CampaignCompactDial } from "@/components/campaigns/CampaignOverviewMetrics";

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
  has_invite_step?: boolean;
  status_counts?: Record<string, number>;
  progress?: CampaignProgress;
  created_at?: string;
  updated_at: string;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  return getCoachAuthHeaders();
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

function campaignRates(c: Campaign) {
  const progress = c.progress ?? {
    sent: 0,
    connected: 0,
    replied: 0,
    interested: 0,
    failed: 0,
    queued: c.lead_count ?? 0,
    remaining: c.lead_count ?? 0,
  };
  const interested = progress.interested ?? 0;
  const replied = progress.replied ?? 0;
  const interestNumerator = interested > 0 ? interested : replied;
  return { progress, interested, interestNumerator };
}

function CampaignToggle({
  on,
  disabled,
  busy,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Turn campaign off" : "Turn campaign on"}
      disabled={disabled || busy}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
        on ? "bg-[#0c5290]" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function RowMenu({
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Campaign actions"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const order = (s: string) =>
        s === "running" ? 0 : s === "paused" ? 1 : s === "draft" ? 2 : 3;
      const byStatus = order(a.status) - order(b.status);
      if (byStatus !== 0) return byStatus;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [campaigns]);

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
    if (campaign.status === "completed") return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const next = campaign.status === "running" ? "paused" : "running";
      if (next === "running" && !primaryAccount) {
        throw new Error("Connect LinkedIn before starting a campaign.");
      }
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

  async function duplicateCampaign(campaign: Campaign) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaign.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "duplicate" }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Duplicate failed.");
      await load();
      if (body.campaign?.id) {
        router.push(`${prefix}/campaigns/${body.campaign.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveCampaign(campaign: Campaign) {
    const ok = window.confirm(
      `Delete “${campaign.name}”? It will be removed from your campaigns list.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaign.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "archive" }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Delete failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Loading campaigns…
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-16">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Campaigns
          </h1>
          {!primaryAccount && configured ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void connectLinkedIn()}
              className="mt-1 text-xs font-medium text-[#0c5290] hover:underline disabled:opacity-50"
            >
              Connect LinkedIn
            </button>
          ) : primaryAccount ? (
            <p className="mt-1 text-[11px] text-slate-500">
              {primaryAccount.display_name || "LinkedIn connected"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${prefix}/campaigns/invites`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
          >
            Invites{inviteTotal ? ` (${inviteTotal})` : ""}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-[#0c5290] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
          >
            + Create
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
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none ring-[#0c5290]/30 placeholder:text-slate-400 focus:ring-2"
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

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-800">No campaigns yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Create one to build a sequence and add LinkedIn leads.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-4 rounded-xl bg-[#0c5290] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0a457a]"
          >
            + Create
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                <th scope="col" className="w-14 px-4 py-3 font-semibold">
                  <span className="sr-only">On or off</span>
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Campaign
                </th>
                <th
                  scope="col"
                  className="w-[5.5rem] px-2 py-3 text-center font-semibold"
                >
                  Progress
                </th>
                <th
                  scope="col"
                  className="w-[5.5rem] px-2 py-3 text-center font-semibold"
                >
                  Connect
                </th>
                <th
                  scope="col"
                  className="w-[5.5rem] px-2 py-3 text-center font-semibold"
                >
                  Interest
                </th>
                <th scope="col" className="w-12 px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const contacts = c.lead_count ?? 0;
                const { progress, interestNumerator } = campaignRates(c);
                const isRunning = c.status === "running";
                const canToggle =
                  c.status !== "completed" &&
                  (isRunning || Boolean(primaryAccount));
                const hasInvite = c.has_invite_step !== false;

                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <CampaignToggle
                        on={isRunning}
                        busy={busy}
                        disabled={!canToggle && !isRunning}
                        onChange={() => void quickToggle(c)}
                      />
                    </td>
                    <td className="min-w-0 px-3 py-3.5 align-middle">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`${prefix}/campaigns/${c.id}`)
                        }
                        className="group flex min-w-0 max-w-xl flex-col items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-[#0c5290]">
                            {c.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusTone(c.status)}`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        </span>
                        <span className="mt-0.5 text-xs text-slate-500">
                          {contacts
                            ? `${contacts} contact${contacts === 1 ? "" : "s"}`
                            : "No contacts yet"}
                          {" · "}
                          {isRunning
                            ? `updated ${relativeTime(c.updated_at)}`
                            : c.status === "draft"
                              ? "not launched"
                              : `updated ${relativeTime(c.updated_at)}`}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-3.5 align-middle">
                      <div className="flex justify-center">
                        <CampaignCompactDial
                          label="Progress"
                          numerator={progress.sent}
                          denominator={Math.max(contacts, progress.sent)}
                          showFraction
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3.5 align-middle">
                      <div className="flex justify-center">
                        <CampaignCompactDial
                          label="Connect"
                          numerator={progress.connected}
                          denominator={progress.sent}
                          muted={!hasInvite}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3.5 align-middle">
                      <div className="flex justify-center">
                        <CampaignCompactDial
                          label="Interest"
                          numerator={interestNumerator}
                          denominator={progress.connected}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <RowMenu
                        open={menuOpenId === c.id}
                        onOpenChange={(next) =>
                          setMenuOpenId(next ? c.id : null)
                        }
                        busy={busy}
                        onEdit={() =>
                          router.push(`${prefix}/campaigns/${c.id}`)
                        }
                        onDuplicate={() => void duplicateCampaign(c)}
                        onDelete={() => void archiveCampaign(c)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
