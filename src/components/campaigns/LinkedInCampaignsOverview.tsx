"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ChevronDown, Copy, MoreVertical, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { fetchHubQuery, invalidateHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  loadCampaignsHubPayload,
  prefetchCampaignDetail,
  type CampaignsHubPayload,
} from "@/lib/getClients/hubFetchers";
import { isMailingProvider, normalizeUnipileProvider } from "@/lib/unipile/providers";
import { CampaignChannelPills } from "@/components/campaigns/CampaignChannelPills";
import { CampaignOverviewHero } from "@/components/campaigns/CampaignOverviewHero";
import { CampaignActivityPane } from "@/components/campaigns/CampaignActivityPane";
import { CampaignSsiCard } from "@/components/campaigns/CampaignSsiCard";
import { AccountSendingModal } from "@/components/campaigns/AccountSendingModal";
import { CampaignInvitesRailCard } from "@/components/campaigns/CampaignInvitesRailCard";
import { CampaignOnOffToggle } from "@/components/campaigns/CampaignOnOffToggle";
import { CampaignsSubTabs } from "@/components/campaigns/CampaignsSubTabs";

const CampaignPoolHub = dynamic(
  () =>
    import("@/components/campaigns/CampaignPoolHub").then((m) => ({
      default: m.CampaignPoolHub,
    })),
  { ssr: false }
);
const LeadMagnetsList = dynamic(
  () =>
    import("@/components/leadMagnets/LeadMagnetsList").then((m) => ({
      default: m.LeadMagnetsList,
    })),
  { ssr: false }
);
import { PublicSlugEditor } from "@/components/leadMagnets/PublicSlugEditor";
import {
  CampaignCompactDial,
  CampaignQueueCell,
  CampaignReplyMix,
} from "@/components/campaigns/CampaignOverviewMetrics";
import { partitionOutreachCampaigns } from "@/lib/leadMagnets/catalog";
import {
  DEMO_PREVIEW_ACCOUNT,
  demoPreviewCampaigns,
  isDemoPreviewId,
} from "@/lib/campaigns/demoPreview";
import { useCampaignDemoPreview } from "@/hooks/useCampaignDemoPreview";
import { CampaignDemoPreviewToggle } from "@/components/campaigns/CampaignDemoPreviewToggle";
import { CampaignCreateModal } from "@/components/campaigns/CampaignCreateModal";

type Account = {
  id: string;
  unipile_account_id: string;
  status: string;
  display_name: string | null;
  provider?: string;
};

type CampaignProgress = {
  sent: number;
  connected: number;
  replied: number;
  interested?: number;
  failed: number;
  queued: number;
  remaining: number;
  in_followup?: number;
  replies?: { positive: number; negative: number; other: number };
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  channels?: string[];
  source_playbook_id?: string | null;
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

function campaignStatusLabel(c: {
  channel?: string;
  status: string;
}): string | null {
  // Off is already clear from the toggle — only surface terminal "Done".
  if (c.status === "completed") return "Done";
  return null;
}

function isOkLinkedInAccount(account: {
  provider?: string;
  status: string;
}): boolean {
  return (
    normalizeUnipileProvider(account.provider) === "LINKEDIN" &&
    (account.status || "").toUpperCase() === "OK"
  );
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
    in_followup: 0,
    replies: { positive: 0, negative: 0, other: 0 },
  };
  const interested = progress.interested ?? 0;
  const replies = progress.replies ?? {
    positive: interested,
    negative: 0,
    other: Math.max(0, (progress.replied ?? 0) - interested),
  };
  return { progress, interested, replies };
}

function RowMenu({
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const menuWidth = 176;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 180;
      const gap = 4;
      const openUp = rect.bottom + gap + menuHeight > window.innerHeight - 8;
      const top = openUp
        ? Math.max(8, rect.top - menuHeight - gap)
        : rect.bottom + gap;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8
      );
      setPosition({ top, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
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

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[220] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
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
            {onUnarchive ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                  onUnarchive();
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Unarchive
              </button>
            ) : onArchive ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChange(false);
                  onArchive();
                }}
              >
                <Archive className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Archive
              </button>
            ) : null}
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative flex justify-end">
      <button
        ref={buttonRef}
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
      {menu}
    </div>
  );
}

function CampaignTableRow({
  campaign: c,
  archived = false,
  busy,
  menuOpen,
  onMenuOpenChange,
  canToggle,
  onToggle,
  onEdit,
  onPrefetch,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  campaign: Campaign;
  archived?: boolean;
  busy: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  canToggle: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPrefetch?: () => void;
  onDuplicate: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
}) {
  const contacts = c.lead_count ?? 0;
  const { progress, replies } = campaignRates(c);
  const isRunning = !archived && c.status === "running";
  const isDemo = isDemoPreviewId(c.id);
  const hasInvite = c.has_invite_step !== false;
  const statusLabel = campaignStatusLabel(c);

  return (
    <tr
      onClick={onEdit}
      onPointerEnter={() => {
        if (isDemo) return;
        onPrefetch?.();
      }}
      onKeyDown={(e) => {
        if (isDemo) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      tabIndex={isDemo ? undefined : 0}
      title={
        isDemo
          ? "Sample data — turn off Sample data to open a campaign"
          : undefined
      }
      className={`group border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0c5290]/40 ${
        isDemo ? "" : "cursor-pointer"
      }`}
    >
      <td className="px-4 py-3.5 align-middle">
        <CampaignOnOffToggle
          on={isRunning}
          busy={busy}
          disabled={archived || (!canToggle && !isRunning)}
          onChange={onToggle}
        />
      </td>
      <td className="min-w-0 px-3 py-3.5 align-middle">
        <div className="flex min-w-0 max-w-full items-center gap-2 text-left">
          <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-[#0c5290]">
            {c.name}
          </span>
          {statusLabel ? (
            <span className="shrink-0 text-[11px] font-medium text-slate-400">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-1 max-w-[14rem]">
          <CampaignQueueCell
            queued={progress.queued}
            total={contacts}
            inFollowUp={progress.in_followup ?? 0}
            dailyLimit={c.daily_invite_limit}
            running={isRunning}
            hasInviteStep={hasInvite}
            layout="row"
          />
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <div className="flex justify-center">
          <CampaignChannelPills
            channels={c.channels}
            campaignChannel={c.channel}
            variant="stack"
          />
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle">
        <CampaignCompactDial
          label="Connect"
          numerator={progress.connected}
          denominator={progress.sent}
          muted={!hasInvite}
        />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <CampaignReplyMix
          positive={replies.positive}
          negative={replies.negative}
          other={replies.other}
        />
      </td>
      <td className="px-3 py-3.5 align-middle">
        <RowMenu
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          busy={busy || isDemo}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

export function LinkedInCampaignsOverview() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { impersonatingCoachId } = useImpersonation();
  const prefix = (pathname.startsWith("/admin") ? "/admin" : "/coach") as
    | "/admin"
    | "/coach";
  const cacheKey = hubQueryKey("campaigns", impersonatingCoachId);
  const cached = peekHubQuery<CampaignsHubPayload>(cacheKey);

  const [accounts, setAccounts] = useState<Account[]>(
    () => cached?.accounts ?? []
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(
    () => (cached?.campaigns as unknown as Campaign[]) ?? []
  );
  const [archivedCampaigns, setArchivedCampaigns] = useState<Campaign[]>(
    () => (cached?.archivedCampaigns as unknown as Campaign[]) ?? []
  );
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [loading, setLoading] = useState(() => !cached);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSending, setShowSending] = useState(false);
  const [configured, setConfigured] = useState(() => cached?.configured ?? true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [coachSlug, setCoachSlug] = useState<string | null>(
    () => cached?.coachSlug ?? null
  );
  const [appOrigin, setAppOrigin] = useState("");
  const { enabled: preview, setEnabled: setPreview } = useCampaignDemoPreview();
  const tab = searchParams.get("tab");
  const magnetsTab = tab === "magnets";
  const poolTab = tab === "pool" || tab === "lists";
  const [poolHubMounted, setPoolHubMounted] = useState(poolTab);
  const [magnetsHubMounted, setMagnetsHubMounted] = useState(magnetsTab);
  const linkedinConnected = searchParams.get("linkedin");

  useEffect(() => {
    if (poolTab) setPoolHubMounted(true);
  }, [poolTab]);

  useEffect(() => {
    if (magnetsTab) setMagnetsHubMounted(true);
  }, [magnetsTab]);

  const { ordered, more } = useMemo(
    () =>
      partitionOutreachCampaigns(
        preview ? demoPreviewCampaigns() : campaigns
      ),
    [campaigns, preview]
  );
  const sorted = useMemo(() => [...ordered, ...more], [ordered, more]);
  const poolCampaigns = useMemo(() => {
    const partitioned = partitionOutreachCampaigns(campaigns);
    return [...partitioned.ordered, ...partitioned.more];
  }, [campaigns]);
  const rates = useMemo(() => {
    let connected = 0;
    let sent = 0;
    const replies = { positive: 0, negative: 0, other: 0 };
    const source = preview ? demoPreviewCampaigns() : campaigns;
    for (const campaign of source) {
      const next = campaignRates(campaign);
      connected += next.progress.connected;
      sent += next.progress.sent;
      replies.positive += next.replies.positive;
      replies.negative += next.replies.negative;
      replies.other += next.replies.other;
    }
    return {
      connect: { numerator: connected, denominator: sent },
      replies,
    };
  }, [campaigns, preview]);
  const displayAccounts = preview ? [DEMO_PREVIEW_ACCOUNT] : accounts;
  const primaryAccount = displayAccounts[0] ?? null;
  const okLinkedInAccount =
    displayAccounts.find((account) => isOkLinkedInAccount(account)) ?? null;
  const showConnectLinkedIn =
    !preview && configured && !okLinkedInAccount && !loading;
  const mailingAccount =
    accounts.find(
      (account) =>
        account.status === "OK" && isMailingProvider(account.provider ?? "")
    ) ?? null;

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const applyPayload = useCallback((payload: CampaignsHubPayload) => {
    setConfigured(payload.configured);
    setAccounts(payload.accounts);
    setCampaigns(payload.campaigns as unknown as Campaign[]);
    setArchivedCampaigns(payload.archivedCampaigns as unknown as Campaign[]);
    setCoachSlug(payload.coachSlug);
  }, []);

  const load = useCallback(
    async (force = false) => {
      const payload = await fetchHubQuery(cacheKey, loadCampaignsHubPayload, {
        force,
      });
      applyPayload(payload);
    },
    [applyPayload, cacheKey]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hit = peekHubQuery<CampaignsHubPayload>(cacheKey);
      if (hit) applyPayload(hit);
      else setLoading(true);
      setError(null);
      try {
        await load(false);
        if (linkedinConnected === "connected") {
          const headers = await authHeaders();
          if (headers) {
            await fetch("/api/coach/linkedin-outreach/accounts", {
              method: "POST",
              headers,
              body: JSON.stringify({ action: "sync" }),
            });
            if (!cancelled) await load(true);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Load failed.";
        if (
          !cancelled &&
          !hit &&
          !/aborted|AbortError/i.test(message)
        ) {
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPayload, cacheKey, load, linkedinConnected]);

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

  async function createCampaign(input: {
    name: string;
    libraryTemplateId?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/campaigns", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: input.name.trim(),
          outreach_account_id: primaryAccount?.id ?? null,
          ...(input.libraryTemplateId
            ? { library_template_id: input.libraryTemplateId }
            : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Create failed.");
      setShowCreate(false);
      invalidateHubQuery(hubQueryKey("campaigns", impersonatingCoachId));
      router.push(
        `${prefix}/campaigns/${body.campaign.id}?tab=steps`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function quickToggle(campaign: Campaign) {
    if (isDemoPreviewId(campaign.id) || campaign.status === "completed") return;
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const next = campaign.status === "running" ? "paused" : "running";
      if (next === "running" && campaign.channel === "email") {
        if (!mailingAccount) {
          throw new Error("Connect Gmail or Outlook before starting an email campaign.");
        }
      } else if (next === "running" && !primaryAccount) {
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
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    if (isDemoPreviewId(campaign.id)) return;
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
      await load(true);
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
    if (isDemoPreviewId(campaign.id)) return;
    const ok = window.confirm(
      `Archive “${campaign.name}”? You can restore it later from Archived.`
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
      if (!res.ok) throw new Error(body.error || "Archive failed.");
      setArchivedOpen(true);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (isDemoPreviewId(campaign.id)) return;
    const ok = window.confirm(
      `Delete “${campaign.name}”? This removes the campaign, its steps, and everyone in its queue. Conversations and prospect records stay. This cannot be undone.`
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
          body: JSON.stringify({ action: "delete" }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Delete failed.");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unarchiveCampaign(campaign: Campaign) {
    if (isDemoPreviewId(campaign.id)) return;
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
          body: JSON.stringify({ action: "unarchive" }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not restore campaign.");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore campaign.");
    } finally {
      setBusy(false);
    }
  }

  const campaignsTab = !poolTab && !magnetsTab;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {error && !showCreate ? (
        <div className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="shrink-0">
        <CampaignsSubTabs
          prefix={prefix}
          active={magnetsTab ? "magnets" : poolTab ? "pool" : "campaigns"}
          actions={
            campaignsTab ? (
              <>
                {!okLinkedInAccount && configured && !preview ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void connectLinkedIn()}
                    className="text-sm font-medium text-[#0c5290] hover:underline disabled:opacity-50"
                  >
                    Connect LinkedIn
                  </button>
                ) : null}
                {preview || okLinkedInAccount ? (
                  <button
                    type="button"
                    onClick={() => setShowSending(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-transparent px-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                  >
                    <SlidersHorizontal
                      className="h-3.5 w-3.5 text-slate-500"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setShowCreate(true);
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0c5290] px-3 text-sm font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Create campaign
                </button>
              </>
            ) : undefined
          }
        />
      </div>

      {campaignsTab ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-28">
          {showConnectLinkedIn ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              Connect LinkedIn to load SSI, pending invites, and send from
              campaigns.{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void connectLinkedIn()}
                className="font-semibold text-[#0c5290] hover:underline disabled:opacity-50"
              >
                Connect LinkedIn
              </button>
            </p>
          ) : null}
          <div
            className={`flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_27rem] xl:grid-rows-[auto_1fr] ${
              showConnectLinkedIn ? "pt-3" : "pt-4"
            }`}
          >
            <div className="xl:col-start-1 xl:row-start-1">
              <CampaignOverviewHero
                connectRate={rates.connect}
                replies={rates.replies}
                preview={preview}
              />
            </div>
            {loading && !preview ? (
              <div className="py-16 text-center text-sm text-slate-500 xl:col-start-1 xl:row-start-2">
                Loading campaigns…
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 xl:col-start-1 xl:row-start-2 xl:h-full xl:min-h-0">
                {sorted.length === 0 && archivedCampaigns.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <p className="text-sm font-medium text-slate-800">
                      No campaigns yet
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Create one to build a sequence and add LinkedIn leads.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setShowCreate(true);
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0c5290] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a457a]"
                    >
                      <Plus
                        className="h-4 w-4"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      Create campaign
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                            <th
                              scope="col"
                              className="w-14 px-4 py-3 font-semibold"
                            >
                              <span className="sr-only">On or off</span>
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3 font-semibold"
                            >
                              Campaign
                            </th>
                            <th
                              scope="col"
                              className="w-[5rem] px-3 py-3 text-center font-semibold"
                            >
                              Via
                            </th>
                            <th
                              scope="col"
                              className="w-[13rem] px-4 py-3 font-semibold"
                            >
                              Connect
                            </th>
                            <th
                              scope="col"
                              className="w-[12rem] px-4 py-3 font-semibold"
                            >
                              Replies
                            </th>
                            <th scope="col" className="w-12 px-3 py-3">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-10 text-center">
                                <p className="text-sm font-medium text-slate-800">
                                  No active campaigns
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Restore one from Archived, or create a new
                                  campaign.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            sorted.map((c) => {
                              const isRunning = c.status === "running";
                              const isEmail = c.channel === "email";
                              const isDemo = isDemoPreviewId(c.id);
                              const canToggle =
                                !isDemo &&
                                c.status !== "completed" &&
                                (isRunning ||
                                  (isEmail
                                    ? Boolean(mailingAccount)
                                    : Boolean(primaryAccount)));
                              return (
                                <CampaignTableRow
                                  key={c.id}
                                  campaign={c}
                                  busy={busy}
                                  menuOpen={menuOpenId === c.id}
                                  onMenuOpenChange={(next) =>
                                    setMenuOpenId(next ? c.id : null)
                                  }
                                  canToggle={canToggle}
                                  onToggle={() => void quickToggle(c)}
                                  onEdit={() => {
                                    if (isDemo) return;
                                    router.push(`${prefix}/campaigns/${c.id}`);
                                  }}
                                  onPrefetch={() => {
                                    if (isDemo) return;
                                    prefetchCampaignDetail(c.id);
                                    try {
                                      router.prefetch(
                                        `${prefix}/campaigns/${c.id}`
                                      );
                                    } catch {
                                      /* prefetch is best-effort */
                                    }
                                  }}
                                  onDuplicate={() => void duplicateCampaign(c)}
                                  onArchive={() => void archiveCampaign(c)}
                                  onDelete={() => void deleteCampaign(c)}
                                />
                              );
                            })
                          )}
                          {!preview && archivedCampaigns.length > 0 ? (
                            <>
                              <tr>
                                <td colSpan={6} className="p-0">
                                  <button
                                    type="button"
                                    aria-expanded={archivedOpen}
                                    onClick={() =>
                                      setArchivedOpen((open) => !open)
                                    }
                                    className="flex w-full items-center justify-center gap-1.5 bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-800"
                                  >
                                    <Archive
                                      className="h-3.5 w-3.5 shrink-0"
                                      aria-hidden
                                    />
                                    <span>
                                      Archived
                                      <span className="font-normal text-slate-400">
                                        {" "}
                                        · {archivedCampaigns.length}
                                      </span>
                                    </span>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${
                                        archivedOpen ? "rotate-180" : ""
                                      }`}
                                      aria-hidden
                                    />
                                  </button>
                                </td>
                              </tr>
                              {archivedOpen
                                ? archivedCampaigns.map((c) => (
                                    <CampaignTableRow
                                      key={c.id}
                                      campaign={c}
                                      archived
                                      busy={busy}
                                      menuOpen={menuOpenId === c.id}
                                      onMenuOpenChange={(next) =>
                                        setMenuOpenId(next ? c.id : null)
                                      }
                                      canToggle={false}
                                      onToggle={() => undefined}
                                      onEdit={() =>
                                        router.push(
                                          `${prefix}/campaigns/${c.id}`
                                        )
                                      }
                                      onPrefetch={() => {
                                        prefetchCampaignDetail(c.id);
                                        try {
                                          router.prefetch(
                                            `${prefix}/campaigns/${c.id}`
                                          );
                                        } catch {
                                          /* prefetch is best-effort */
                                        }
                                      }}
                                      onDuplicate={() =>
                                        void duplicateCampaign(c)
                                      }
                                      onUnarchive={() =>
                                        void unarchiveCampaign(c)
                                      }
                                      onDelete={() => void deleteCampaign(c)}
                                    />
                                  ))
                                : null}
                            </>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            <aside className="flex w-full flex-col gap-3 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:w-auto">
              <div className="flex h-[min(34rem,calc(100dvh-12rem))] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
                <CampaignActivityPane preview={preview} />
              </div>
              <CampaignSsiCard
                preview={preview}
                linkedInConnected={
                  preview ? true : loading ? undefined : Boolean(okLinkedInAccount)
                }
              />
              <CampaignInvitesRailCard
                preview={preview}
                linkedInConnected={
                  preview ? true : loading ? undefined : Boolean(okLinkedInAccount)
                }
              />
            </aside>
          </div>
        </div>
      ) : null}

      <CampaignCreateModal
        open={showCreate}
        busy={busy}
        error={showCreate ? error : null}
        onClose={() => {
          if (busy) return;
          setShowCreate(false);
          setError(null);
        }}
        onCreateBlank={(name) => void createCampaign({ name })}
        onCreateFromTemplate={(name, template) =>
          void createCampaign({ name, libraryTemplateId: template.id })
        }
      />

      <AccountSendingModal
        open={showSending}
        onClose={() => setShowSending(false)}
        preview={preview}
        linkedInConnected={preview || Boolean(okLinkedInAccount)}
      />

      {poolHubMounted ? (
        <div
          className={
            poolTab
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-4"
              : "hidden"
          }
        >
          <CampaignPoolHub
            campaigns={poolCampaigns}
            onToggleCampaign={(campaign) => {
              const full = campaigns.find((row) => row.id === campaign.id);
              if (full) void quickToggle(full);
            }}
            toggleBusy={busy}
            linkedInConnected={Boolean(primaryAccount)}
            emailConnected={Boolean(mailingAccount)}
          />
        </div>
      ) : null}

      {magnetsHubMounted ? (
        <div
          className={
            magnetsTab
              ? "min-h-0 flex-1 overflow-y-auto pb-28 pt-4"
              : "hidden"
          }
        >
          {loading && !preview && !coachSlug ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Loading lead magnets…
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
              <div className="border-b border-slate-100 px-5 py-4">
                <PublicSlugEditor
                  slug={coachSlug ?? ""}
                  onSlugChange={(next) => setCoachSlug(next)}
                  framed={false}
                />
              </div>
              {!coachSlug ? (
                <p className="border-b border-slate-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                  Add your public URL slug so shareable links work.
                </p>
              ) : null}
              <LeadMagnetsList coachSlug={coachSlug} appOrigin={appOrigin} />
            </div>
          )}
        </div>
      ) : null}

      <CampaignDemoPreviewToggle
        enabled={preview}
        onChange={setPreview}
        coachSlug={coachSlug}
      />
    </div>
  );
}
