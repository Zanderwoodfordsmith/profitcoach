"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  FolderOpen,
  ListTodo,
  Loader2,
  PenLine,
  RefreshCw,
  Settings2,
  BarChart3,
} from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
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

type TabId =
  | "compose"
  | "queue"
  | "calendar"
  | "library"
  | "insights"
  | "settings";

const TABS: Array<{ id: TabId; label: string; icon: typeof PenLine }> = [
  { id: "compose", label: "Compose", icon: PenLine },
  { id: "queue", label: "Queue", icon: ListTodo },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function LinkedInSchedulerPanel() {
  const searchParams = useSearchParams();
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
    } catch {
      onMessage("Could not load LinkedIn workspace.", "error");
    }
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
      tabParam === "library" ||
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
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200/80 bg-white px-6 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking LinkedIn…
        </div>
      </div>
    );
  }

  if (connected === false) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200/80 bg-white px-8 py-12 text-center shadow-sm">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md"
          style={{ backgroundColor: LI_BLUE }}
        >
          in
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
          Connect LinkedIn
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
          One LinkedIn connect powers Content and Campaigns. Compose, schedule,
          and publish from here.
        </p>
        <button
          type="button"
          disabled={connecting}
          onClick={() => void handleConnect()}
          className="mt-7 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ backgroundColor: LI_BLUE }}
        >
          {connecting ? "Redirecting…" : "Connect LinkedIn"}
        </button>
        {linkedinStatus && linkedinStatus !== "connected" ? (
          <p className="mt-4 text-xs text-amber-700">
            Status: {linkedinStatus.replaceAll("_", " ")}
          </p>
        ) : null}
        {actionMessage ? (
          <p className={`mt-3 text-xs ${actionTone === "error" ? "text-rose-700" : "text-slate-600"}`}>
            {actionMessage}
          </p>
        ) : null}
      </div>
    );
  }

  const draftCount = items.filter((i) => i.status === "draft").length;
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;

  return (
    <div className="space-y-5">
      {(actionMessage || linkedinStatus === "connected") && (
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

      {/* Floating tab bar — no enclosing card chrome */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100/90 p-1 shadow-inner">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
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
                  <span className="rounded-full bg-slate-900/90 px-1.5 text-[10px] font-bold text-white">
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
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div>
        {tab === "compose" ? (
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
        {tab === "queue" ? (
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
        {tab === "calendar" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading calendar…
            </div>
          ) : (
          <LinkedInCalendarTab
            items={items}
            onSelectPost={() => setTab("queue")}
          />
          )
        ) : null}
        {tab === "library" ? (
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
        {tab === "insights" ? (
          !scheduledReady ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading insights…
            </div>
          ) : (
          <LinkedInInsightsTab
            items={items}
            getToken={getToken}
            onMessage={onMessage}
          />
          )
        ) : null}
        {tab === "settings" ? (
          <div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
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
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName(profile)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {profile.email || "Connected"}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Connected
              </span>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Composer preview
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Headline defaults from your LinkedIn profile scrape. Override here
                only if you want different preview copy.
              </p>
              <label className="block text-xs font-semibold text-slate-600">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Shown under your name on generated quote images (instead of @handle).
              </p>
              <button
                type="button"
                disabled={savingSettings}
                onClick={() => void handleSaveSettings()}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: LI_BLUE }}
              >
                {savingSettings ? "Saving…" : "Save composer settings"}
              </button>
            </div>

            {profile.tokenExpiry ? (
              <p className="text-xs text-slate-500">
                Token expires {new Date(profile.tokenExpiry).toLocaleString()}
              </p>
            ) : null}
            {profile.scopes.length ? (
              <p className="text-[11px] text-slate-400">
                Scopes: {profile.scopes.join(", ")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={connecting}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {connecting ? "Redirecting…" : "Reconnect"}
              </button>
              <button
                type="button"
                onClick={() => void handlePublishDue()}
                disabled={publishingDue}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {publishingDue ? "Running…" : "Run due posts"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
