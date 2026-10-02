"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import {
  isOpenLeadStatus,
  leadStatusLabel,
} from "@/lib/unipile/campaignLeadActivity";

export type ProspectCampaignChip = {
  id: string;
  campaignId: string;
  name: string;
  leadStatus: string;
};

type CatalogCampaign = {
  id: string;
  name: string;
  status: string;
};

export function ProspectCampaignsPanel({
  contactId,
  campaigns,
  onChanged,
}: {
  contactId: string;
  campaigns: ProspectCampaignChip[];
  onChanged: () => void;
}) {
  const pathname = usePathname() ?? "";
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { impersonatingCoachId } = useImpersonation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogCampaign[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const campaignBase = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const { active, past } = useMemo(() => {
    const open: ProspectCampaignChip[] = [];
    const done: ProspectCampaignChip[] = [];
    for (const campaign of campaigns) {
      if (isOpenLeadStatus(campaign.leadStatus)) open.push(campaign);
      else done.push(campaign);
    }
    return { active: open, past: done };
  }, [campaigns]);

  const activeCampaignIds = useMemo(
    () => new Set(active.map((campaign) => campaign.campaignId)),
    [active]
  );
  const choices = (catalog ?? [])
    .filter(
      (campaign) =>
        campaign.status !== "archived" && !activeCampaignIds.has(campaign.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function loadCatalog() {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in again, then retry.");
      const res = await fetch("/api/coach/linkedin-outreach/campaigns", {
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        campaigns?: CatalogCampaign[];
      };
      if (!res.ok) throw new Error(body.error || "Could not load campaigns.");
      setCatalog(Array.isArray(body.campaigns) ? body.campaigns : []);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Could not load campaigns."
      );
    } finally {
      setLoadingCatalog(false);
    }
  }

  function openMenu() {
    setError(null);
    const next = !menuOpen;
    setMenuOpen(next);
    if (next) void loadCatalog();
  }

  async function addToCampaign(campaignId: string) {
    setBusyKey(`add:${campaignId}`);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in again, then retry.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "enroll_contact",
            contact_id: contactId,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        already?: boolean;
      };
      if (!res.ok) throw new Error(body.error || "Could not add them.");
      setMenuOpen(false);
      if (body.already) setError("They're already in that campaign.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add them.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeFromCampaign(campaign: ProspectCampaignChip) {
    if (!window.confirm(`Do you want to remove them from ${campaign.name}?`)) {
      return;
    }
    setBusyKey(`remove:${campaign.id}`);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in again, then retry.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaign.campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            action: "remove_contact",
            contact_id: contactId,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not remove them.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove them.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      ref={rootRef}
      className="space-y-3"
      onClick={(event) => event.stopPropagation()}
    >
      {active.length === 0 ? (
        <p className="text-sm text-slate-600">
          {past.length > 0
            ? "Not in a campaign right now."
            : "Not in a campaign yet."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {active.map((campaign) => {
          const removing = busyKey === `remove:${campaign.id}`;
          const status = leadStatusLabel(campaign.leadStatus);
          return (
            <span
              key={campaign.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-2.5 pr-1 text-[13px]"
            >
              <Link
                href={`${campaignBase}/campaigns/${encodeURIComponent(campaign.campaignId)}`}
                title={`${campaign.name} · ${status}`}
                className="min-w-0 truncate font-medium text-slate-900 hover:text-sky-800"
              >
                {campaign.name}
                <span className="font-normal text-slate-600"> · {status}</span>
              </Link>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => void removeFromCampaign(campaign)}
                aria-label={`Remove from ${campaign.name}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-600 hover:text-rose-700 disabled:opacity-50"
              >
                {removing ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <X className="h-3 w-3" aria-hidden />
                )}
              </button>
            </span>
          );
        })}

        <div className="relative">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label="Add to a campaign"
            disabled={Boolean(busyKey)}
            onClick={() => void openMenu()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white hover:text-slate-900 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute bottom-full left-0 z-30 mb-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {loadingCatalog && !catalog ? (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading campaigns
                </p>
              ) : catalogError ? (
                <p className="px-3 py-2 text-xs text-rose-700">{catalogError}</p>
              ) : choices.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-700">
                  No other campaigns to add.
                </p>
              ) : (
                <ul className="max-h-52 overflow-y-auto">
                  {choices.map((campaign) => {
                    const adding = busyKey === `add:${campaign.id}`;
                    return (
                      <li key={campaign.id}>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={Boolean(busyKey)}
                          onClick={() => void addToCampaign(campaign.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <span className="min-w-0 truncate">{campaign.name}</span>
                          {adding ? (
                            <Loader2
                              className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-600"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {past.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Past
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {past.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`${campaignBase}/campaigns/${encodeURIComponent(campaign.campaignId)}`}
                  title={`${campaign.name} · ${leadStatusLabel(campaign.leadStatus)}`}
                  className="inline-flex max-w-full truncate rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-0.5 text-[13px] text-slate-700 hover:text-slate-900"
                >
                  {campaign.name}
                  <span>
                    {" "}
                    · {leadStatusLabel(campaign.leadStatus)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
