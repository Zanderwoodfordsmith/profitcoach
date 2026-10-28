"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  FolderOpen,
  ListTodo,
  Loader2,
  Newspaper,
  PenLine,
  RefreshCw,
  Settings2,
  BarChart3,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import {
  ConnectGate,
  LINKEDIN_CONNECT_DETAILS,
} from "@/components/ui/ConnectGate";
import { fieldClass } from "@/components/ui/Field";
import { LinkedInComposeTab } from "./linkedin/LinkedInComposeTab";
import {
  displayName,
  LI_BLUE,
  LINKEDIN_COMPOSE_SEED_KEY,
  type LinkedInPostItem,
  type LinkedInProfilePreview,
} from "./linkedin/types";
import { fetchHubQuery, peekHubQuery } from "@/lib/getClients/hubQueryCache";
import { hubQueryKey } from "@/lib/getClients/hubKeys";
import {
  loadContentScheduledPayload,
  loadContentStatusPayload,
  type ContentScheduledPayload,
  type ContentStatusPayload,
} from "@/lib/getClients/hubFetchers";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useLinkedInHistory } from "./linkedin/useLinkedInHistory";
import { LinkedInHistoryStats } from "./linkedin/LinkedInHistoryStats";

const LinkedInCalendarTab = dynamic(() =>
  import("./linkedin/LinkedInCalendarTab").then((m) => ({
    default: m.LinkedInCalendarTab,
  }))
);
const LinkedInLibraryTab = dynamic(() =>
  import("./linkedin/LinkedInLibraryTab").then((m) => ({
    default: m.LinkedInLibraryTab,
  }))
);
const LinkedInQueueTab = dynamic(() =>
  import("./linkedin/LinkedInQueueTab").then((m) => ({
    default: m.LinkedInQueueTab,
  }))
);
const LinkedInInsightsTab = dynamic(() =>
  import("./linkedin/LinkedInInsightsTab").then((m) => ({
    default: m.LinkedInInsightsTab,
  }))
);
const NewsletterIssuesTab = dynamic(() =>
  import("./linkedin/NewsletterIssuesTab").then((m) => ({
    default: m.NewsletterIssuesTab,
  }))
);

type TabId =
  | "compose"
  | "queue"
  | "calendar"
  | "newsletter"
  | "library"
  | "insights"
  | "settings";

const TABS: Array<{ id: TabId; label: string; icon: typeof PenLine }> = [
  { id: "compose", label: "Compose", icon: PenLine },
  { id: "queue", label: "Queue", icon: ListTodo },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "newsletter", label: "Newsletter", icon: Newspaper },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function LinkedInSchedulerPanel() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const linkedinStatus = searchParams.get("linkedin");
  const { impersonatingCoachId } = useImpersonation();
  const statusKey = hubQueryKey("content:status", impersonatingCoachId);
  const scheduledKey = hubQueryKey("content:scheduled", impersonatingCoachId);
  const cachedStatus = peekHubQuery<ContentStatusPayload>(statusKey);
  const cachedScheduled = peekHubQuery<ContentScheduledPayload>(scheduledKey);

  const [tab, setTab] = useState<TabId>("compose");
  const [connected, setConnected] = useState<boolean | null>(
    () => cachedStatus?.connected ?? null
  );
  const [profile, setProfile] = useState<LinkedInProfilePreview>({
    name: cachedStatus?.profile.name ?? null,
    headline: cachedStatus?.profile.headline ?? null,
    photoUrl: cachedStatus?.profile.photoUrl ?? null,
    email: cachedStatus?.profile.email ?? null,
    tokenExpiry: cachedStatus?.profile.tokenExpiry ?? null,
    scopes: cachedStatus?.profile.scopes ?? [],
    websiteLabel: cachedStatus?.profile.websiteLabel ?? "Visit my website",
    websiteUrl: cachedStatus?.profile.websiteUrl ?? null,
    quoteHandle: cachedStatus?.profile.quoteHandle ?? "Profit Coach",
  });
  const [settingsDraft, setSettingsDraft] = useState({
    display_headline: cachedStatus?.profile.headline ?? "",
    website_label: cachedStatus?.profile.websiteLabel ?? "Visit my website",
    website_url: cachedStatus?.profile.websiteUrl ?? "",
    quote_handle: cachedStatus?.profile.quoteHandle ?? "Profit Coach",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [items, setItems] = useState<LinkedInPostItem[]>(
    () => (cachedScheduled?.items as LinkedInPostItem[]) ?? []
  );
  const [categories, setCategories] = useState<string[]>(
    () => cachedScheduled?.categories ?? []
  );
  const [scheduledReady, setScheduledReady] = useState(() =>
    Boolean(cachedScheduled)
  );
  const [connecting, setConnecting] = useState(false);
  const [publishingDue, setPublishingDue] = useState(false);
  const publishingDueRef = useRef(false);
  const [seed, setSeed] = useState<LinkedInPostItem | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"neutral" | "success" | "error">(
    "neutral"
  );

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token ?? "";
    if (!token) throw new Error("Please sign in again.");
    return token;
  }, []);

  const onMessage = useCallback(
    (message: string, tone: "success" | "error" | "neutral") => {
      setActionMessage(message);
      setActionTone(tone);
    },
    []
  );

  const getHistoryHeaders = useCallback(async () => {
    try {
      return { Authorization: `Bearer ${await getToken()}` };
    } catch {
      return null;
    }
  }, [getToken]);
  const history = useLinkedInHistory(getHistoryHeaders);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);

  async function handleImportHistory() {
    const error = await history.runImport();
    onMessage(error ?? "Your LinkedIn posts and newsletter issues are up to date.", error ? "error" : "success");
  }

  const applyStatus = useCallback((payload: ContentStatusPayload) => {
    setConnected(payload.connected);
    const nextProfile: LinkedInProfilePreview = {
      name: payload.profile.name,
      headline: payload.profile.headline,
      photoUrl: payload.profile.photoUrl,
      email: payload.profile.email,
      tokenExpiry: payload.profile.tokenExpiry,
      scopes: payload.profile.scopes,
      websiteLabel: payload.profile.websiteLabel,
      websiteUrl: payload.profile.websiteUrl,
      quoteHandle: payload.profile.quoteHandle,
    };
    setProfile(nextProfile);
    setSettingsDraft({
      display_headline: nextProfile.headline ?? "",
      website_label: nextProfile.websiteLabel,
      website_url: nextProfile.websiteUrl ?? "",
      quote_handle: nextProfile.quoteHandle,
    });
  }, []);

  const applyScheduled = useCallback((payload: ContentScheduledPayload) => {
    setItems((payload.items as LinkedInPostItem[]) ?? []);
    setCategories(payload.categories ?? []);
    setScheduledReady(true);
  }, []);

  const loadPanel = useCallback(async () => {
    try {
      const [status, scheduled] = await Promise.all([
        fetchHubQuery(statusKey, loadContentStatusPayload, { force: true }),
        fetchHubQuery(scheduledKey, loadContentScheduledPayload, {
          force: true,
        }),
      ]);
      applyStatus(status);
      applyScheduled(scheduled);
      void history.reload();
    } catch {
      onMessage("Could not load LinkedIn workspace.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyScheduled, applyStatus, onMessage, scheduledKey, statusKey]);

  useEffect(() => {
    const statusHit = peekHubQuery<ContentStatusPayload>(statusKey);
    if (statusHit) applyStatus(statusHit);
    const scheduledHit = peekHubQuery<ContentScheduledPayload>(scheduledKey);
    if (scheduledHit) applyScheduled(scheduledHit);

    void fetchHubQuery(statusKey, loadContentStatusPayload).then(
      applyStatus,
      () => {
        if (!peekHubQuery(statusKey)) setConnected(false);
      }
    );
    void fetchHubQuery(scheduledKey, loadContentScheduledPayload).then(
      applyScheduled,
      () => {
        setScheduledReady(true);
      }
    );
  }, [applyScheduled, applyStatus, scheduledKey, statusKey]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam === "compose" ||
      tabParam === "queue" ||
      tabParam === "calendar" ||
      tabParam === "newsletter" ||
      tabParam === "library" ||
      tabParam === "insights" ||
      tabParam === "settings"
    ) {
      setTab(tabParam);
    }

    if (tabParam !== "compose" && searchParams.get("compose") == null) return;
    try {
      const raw = sessionStorage.getItem(LINKEDIN_COMPOSE_SEED_KEY);
      if (!raw) return;
      sessionStorage.removeItem(LINKEDIN_COMPOSE_SEED_KEY);
      const parsed = JSON.parse(raw) as {
        content?: string;
        category?: string | null;
      };
      const content = parsed.content?.trim();
      if (!content) return;
      setSeed({
        id: `newsletter-promo-${Date.now()}`,
        content,
        scheduled_for: null,
        status: "published",
        attempts: 0,
        last_error: null,
        linkedin_post_urn: null,
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        post_type: "text",
        category: parsed.category ?? "newsletter-promo",
        article_url: null,
        media: [],
      });
      setTab("compose");
    } catch {
      // ignore bad seed payloads
    }
  }, [searchParams]);

  async function handleConnect() {
    if (connecting) return;
    setConnecting(true);
    try {
      const token = await getToken();
      // Same Unipile LinkedIn connect as Campaigns (one account for content + outreach).
      const res = await fetch("/api/coach/linkedin-outreach/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start LinkedIn connect.");
      }
      window.location.assign(body.url);
    } catch (err) {
      onMessage(
        err instanceof Error ? err.message : "Could not start LinkedIn connect.",
        "error"
      );
      setConnecting(false);
    }
  }

  async function handleSaveSettings() {
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settingsDraft),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error || "Could not save settings.");
      onMessage("Composer settings saved.", "success");
      await loadPanel();
    } catch (err) {
      onMessage(
        err instanceof Error ? err.message : "Could not save settings.",
        "error"
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handlePublishDue(opts?: { silent?: boolean }) {
    if (publishingDueRef.current || !connected) return;
    publishingDueRef.current = true;
    setPublishingDue(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/linkedin/publish-due", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        processed?: number;
        published?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Could not publish due posts.");
      const published = body.published ?? body.processed ?? 0;
      if (!opts?.silent || published > 0) {
        onMessage(
          published > 0
            ? `Published ${published} scheduled post(s) to LinkedIn.`
            : `No due posts to publish (${body.processed ?? 0} checked).`,
          published > 0 ? "success" : "neutral"
        );
      }
      if ((body.processed ?? 0) > 0) await loadPanel();
    } catch (err) {
      if (!opts?.silent) {
        onMessage(
          err instanceof Error ? err.message : "Could not publish due posts.",
          "error"
        );
      }
    } finally {
      publishingDueRef.current = false;
      setPublishingDue(false);
    }
  }

  // Auto-run due posts while this page is open (local/dev without Vercel cron).
  useEffect(() => {
    if (!connected) return;
    void handlePublishDue({ silent: true });
    const id = window.setInterval(() => {
      void handlePublishDue({ silent: true });
    }, 45_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  if (connected === null) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100/90 p-1 shadow-inner">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className={cardClass("plain", "flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500")}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking LinkedIn…
        </div>
      </div>
    );
  }

  // Not connected: the composer shows blurred under a connect card, since
  // every action here (drafts included) posts through LinkedIn.
  const locked = connected === false;
  const shownTab: TabId = locked ? "compose" : tab;
  const draftCount = items.filter((i) => i.status === "draft").length;
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;

  return (
    <div className="space-y-5">
      {locked && linkedinStatus && linkedinStatus !== "connected" ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          LinkedIn didn&apos;t finish connecting (
          {linkedinStatus.replaceAll("_", " ")}). Try again below.
        </div>
      ) : null}
      {(actionMessage || (linkedinStatus === "connected" && !locked)) && (
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            actionTone === "success" || linkedinStatus === "connected"
              ? "bg-emerald-50 text-emerald-800"
              : actionTone === "error"
                ? "bg-rose-50 text-rose-800"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {actionMessage || "LinkedIn connected successfully."}
        </div>
      )}

      <ConnectGate
        locked={locked}
        align="top"
        className="min-h-[30rem] rounded-3xl"
        contentClassName="space-y-5"
        icon={<LinkedInSolidIcon className="h-full w-full" />}
        title="Connect LinkedIn"
        description="Write, schedule and publish your LinkedIn posts from here, and see how each one lands."
        action={{
          label: "Connect LinkedIn",
          onClick: () => void handleConnect(),
          busy: connecting,
          busyLabel: "Opening LinkedIn…",
        }}
        details={LINKEDIN_CONNECT_DETAILS}
      >
      {/* Floating tab bar — no enclosing card chrome */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100/90 p-1 shadow-inner">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = shownTab === t.id;
            const badge =
              t.id === "library"
                ? draftCount
                : t.id === "queue"
                  ? scheduledCount
                  : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {badge > 0 ? (
                  <span className="rounded-full bg-slate-900/90 px-1.5 text-caption font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void loadPanel()}
          className={buttonClass("quiet", "small", "ml-auto")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div>
        {shownTab === "compose" ? (
          <LinkedInComposeTab
            connected={!!connected}
            profile={profile}
            categories={categories}
            getToken={getToken}
            onMessage={onMessage}
            onRefresh={loadPanel}
            seed={seed}
            onSeedConsumed={() => setSeed(null)}
          />
        ) : null}
        {shownTab === "queue" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading queue…
            </div>
          ) : (
          <LinkedInQueueTab
            items={items}
            categories={categories}
            getToken={getToken}
            onMessage={onMessage}
            onRefresh={loadPanel}
            onEdit={(item) => {
              setSeed(item);
              setTab("compose");
            }}
          />
          )
        ) : null}
        {shownTab === "calendar" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading calendar…
            </div>
          ) : (
          <LinkedInCalendarTab
            items={items}
            history={history.data?.posts}
            issues={history.data?.issues}
            onSelectPost={() => setTab("queue")}
            onOpenIssue={(id) => {
              setOpenIssueId(id);
              setTab("newsletter");
            }}
          />
          )
        ) : null}
        {shownTab === "newsletter" ? (
          <NewsletterIssuesTab
            history={history.data}
            loading={history.loading}
            importing={history.importing}
            onImport={() => void handleImportHistory()}
            getHeaders={getHistoryHeaders}
            openIssueId={openIssueId}
            onOpenIssue={setOpenIssueId}
            blueprintHref={pathname?.startsWith("/admin") ? null : "/coach/blueprint/content"}
          />
        ) : null}
        {shownTab === "library" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading library…
            </div>
          ) : (
          <LinkedInLibraryTab
            items={items}
            getToken={getToken}
            onMessage={onMessage}
            onRefresh={loadPanel}
            onUseInComposer={(item) => {
              setSeed(item);
              setTab("compose");
            }}
          />
          )
        ) : null}
        {shownTab === "insights" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading insights…
            </div>
          ) : (
          <div className="space-y-6">
            <LinkedInHistoryStats
              history={history.data}
              loading={history.loading}
              importing={history.importing}
              onImport={() => void handleImportHistory()}
            />
            <LinkedInInsightsTab
              items={items}
              getToken={getToken}
              onMessage={onMessage}
            />
          </div>
          )
        ) : null}
        {shownTab === "settings" ? (
          <div className={cardClass("plain", "mx-auto max-w-lg space-y-5 p-6")}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                {profile.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: LI_BLUE }}
                  >
                    {displayName(profile).slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {displayName(profile)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {profile.email || "Connected"}
                </p>
              </div>
              <span className={badgeClass("green", "ml-auto")}>
                Connected
              </span>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Composer preview
              </p>
              <p className="text-caption text-slate-500">
                Headline defaults from your LinkedIn profile scrape. Override here
                only if you want different preview copy.
              </p>
              <label className="block text-xs font-medium text-slate-600">
                Headline
                <input
                  value={settingsDraft.display_headline}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      display_headline: e.target.value,
                    }))
                  }
                  placeholder="Helping directors…"
                  className={fieldClass("input", "normal", "mt-1")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Website button label
                <input
                  value={settingsDraft.website_label}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      website_label: e.target.value,
                    }))
                  }
                  placeholder="Visit my website"
                  className={fieldClass("input", "normal", "mt-1")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Website URL
                <input
                  value={settingsDraft.website_url}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      website_url: e.target.value,
                    }))
                  }
                  placeholder="https://"
                  className={fieldClass("input", "normal", "mt-1")}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Quote card subtitle
                <input
                  value={settingsDraft.quote_handle}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      quote_handle: e.target.value,
                    }))
                  }
                  placeholder="Profit Coach"
                  className={fieldClass("input", "normal", "mt-1")}
                />
              </label>
              <p className="text-caption text-slate-500">
                Shown under your name on generated quote images (instead of @handle).
              </p>
              <button
                type="button"
                disabled={savingSettings}
                onClick={() => void handleSaveSettings()}
                className={buttonClass("main")}
              >
                {savingSettings ? "Saving…" : "Save composer settings"}
              </button>
            </div>

            {profile.tokenExpiry ? (
              <p className="text-xs text-slate-500">
                Token expires {new Date(profile.tokenExpiry).toLocaleString()}
              </p>
            ) : null}
            {Array.isArray(profile.scopes) && profile.scopes.length ? (
              <p className="text-caption text-slate-400">
                Scopes: {profile.scopes.join(", ")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={connecting}
                className={buttonClass("second")}
              >
                {connecting ? "Redirecting…" : "Reconnect"}
              </button>
              <button
                type="button"
                onClick={() => void handlePublishDue()}
                disabled={publishingDue}
                className={buttonClass("second")}
              >
                {publishingDue ? "Running…" : "Run due posts"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      </ConnectGate>
    </div>
  );
}
