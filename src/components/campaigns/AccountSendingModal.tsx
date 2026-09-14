"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import { WeeklyHoursEditor } from "@/components/booking/WeeklyHoursEditor";
import { CampaignLimitSlider } from "@/components/campaigns/CampaignLimitSlider";
import { CampaignOnOffToggle } from "@/components/campaigns/CampaignOnOffToggle";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import {
  ACCEPT_RATE_PAUSE_HINT,
  ACCEPT_RATE_WARN,
  SSI_LOW_WARMUP_THRESHOLD,
  WEEKLY_INVITE_MAX,
  WEEKLY_INVITE_MIN,
} from "@/lib/unipile/accountSendSafety";
import { parseCampaignSendRules } from "@/lib/unipile/campaignSendWindow";

const DAYS_PER_WEEK = 7;
const WEEKLY_MESSAGE_MIN = DAYS_PER_WEEK;
const WEEKLY_MESSAGE_MAX = 350;
const WEEKLY_REACT_MIN = DAYS_PER_WEEK;
const WEEKLY_REACT_MAX = 350;
const WARMUP_TOTAL_WEEKS = 4;
const ACCEPT_RATE_TARGET_PCT = Math.round(ACCEPT_RATE_WARN * 100);
const ACCEPT_RATE_PAUSE_PCT = Math.round(ACCEPT_RATE_PAUSE_HINT * 100);

type Snapshot = {
  available?: boolean;
  reason?: string;
  message?: string;
  account?: {
    id: string;
    weekly_invite_target: number;
    daily_message_target: number;
    daily_react_target: number;
    min_action_delay_seconds: number;
    max_action_delay_seconds: number;
    timezone: string;
    send_rules: AvailabilityRuleRow[];
    warmup_started_at: string | null;
    warmup_enabled: boolean;
    invite_paused_until: string | null;
    rate_limited_until: string | null;
    ssi_score: number | null;
  };
  recommend?: number;
  effective_weekly_cap?: number;
  warmup_week?: number;
  warmup_complete?: boolean;
  rolling_7_sent?: number;
  today?: {
    inviteQuota: number;
    messageQuota: number;
    reactQuota: number;
    invitesAssigned: number;
  };
  accept_rate?: number | null;
  accept_sample?: number;
  accept_warn?: boolean;
  accept_pause_hint?: boolean;
  today_ymd?: string;
};

function dailyToWeekly(daily: number): number {
  return Math.max(DAYS_PER_WEEK, Math.round(daily) * DAYS_PER_WEEK);
}

function weeklyToDaily(weekly: number, fallback: number): number {
  const n = Math.round(weekly / DAYS_PER_WEEK);
  return Math.min(100, Math.max(1, Number.isFinite(n) ? n : fallback));
}

function SettingsInfoTip({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const panelId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        className="-m-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 aria-expanded:bg-slate-100 aria-expanded:text-slate-600"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          className={`absolute top-full z-40 mt-1.5 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-600 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

function warmupStatus(week: number, enabled: boolean, complete: boolean) {
  if (!enabled) return "Off — full weekly invite target.";
  if (complete || week >= WARMUP_TOTAL_WEEKS) {
    return "Complete — full weekly invite target.";
  }
  return `Week ${Math.min(week, WARMUP_TOTAL_WEEKS)} of ${WARMUP_TOTAL_WEEKS}`;
}

export function AccountSendingModal({
  open,
  onClose,
  preview,
  linkedInConnected,
}: {
  open: boolean;
  onClose: () => void;
  preview?: boolean;
  linkedInConnected?: boolean;
}) {
  const titleId = useId();
  const [snap, setSnap] = useState<Snapshot | null>(preview ? demoSnap() : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Europe/London");
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const saveGenRef = useRef(0);

  const load = useCallback(async () => {
    if (preview) {
      setSnap(demoSnap());
      return;
    }
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/linkedin-outreach/send-safety", {
        headers,
      });
      const data = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load.");
      setSnap(data);
      if (data.account) {
        setTimezone(data.account.timezone || "Europe/London");
        setRules(parseCampaignSendRules(data.account.send_rules));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function save(patch: Record<string, unknown>) {
    if (preview) return;
    const gen = ++saveGenRef.current;
    setBusy(true);
    try {
      const headers = await getCoachAuthHeaders();
      if (!headers) throw new Error("Not signed in.");
      const res = await fetch("/api/coach/linkedin-outreach/send-safety", {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as Snapshot & { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed.");
      if (gen !== saveGenRef.current) return;
      setSnap(data);
      if (data.account) {
        setTimezone(data.account.timezone || "Europe/London");
        setRules(parseCampaignSendRules(data.account.send_rules));
      }
      setError(null);
    } catch (err) {
      if (gen !== saveGenRef.current) return;
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      if (gen === saveGenRef.current) setBusy(false);
    }
  }

  function setWarmupEnabled(next: boolean) {
    setSnap((s) =>
      s?.account
        ? {
            ...s,
            account: {
              ...s.account,
              warmup_enabled: next,
            },
            warmup_complete: (s.warmup_week ?? 1) >= WARMUP_TOTAL_WEEKS,
          }
        : s
    );
    void save({ warmup_enabled: next });
  }

  if (!open) return null;
  if (!preview && linkedInConnected === false) return null;

  const account = snap?.account;
  const today = snap?.today;
  const recommend = snap?.recommend ?? 100;
  const weeklyInvites = account?.weekly_invite_target ?? 100;
  const weeklyMessages = dailyToWeekly(account?.daily_message_target ?? 20);
  const weeklyReacts = dailyToWeekly(account?.daily_react_target ?? 12);
  const warmupEnabled = account?.warmup_enabled !== false;
  const warmupWeek = snap?.warmup_week ?? 1;
  const warmupComplete =
    warmupWeek >= WARMUP_TOTAL_WEEKS || Boolean(snap?.warmup_complete);

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(48rem,94vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2
            id={titleId}
            className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
          >
            Campaign Sender Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {!account && !error ? (
            <p className="text-sm text-slate-600">
              {snap?.message || "Loading…"}
            </p>
          ) : !account ? (
            <p className="text-sm text-rose-800">{error || "Unavailable."}</p>
          ) : (
            <div className="space-y-5">
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  warmupEnabled && !warmupComplete
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <CampaignOnOffToggle
                  on={warmupEnabled}
                  ariaLabel={
                    warmupEnabled
                      ? "Turn safety warm-up off"
                      : "Turn safety warm-up on"
                  }
                  onChange={() => setWarmupEnabled(!warmupEnabled)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p
                      className={`text-sm font-semibold ${
                        warmupEnabled && !warmupComplete
                          ? "text-amber-950"
                          : "text-slate-900"
                      }`}
                    >
                      Safety warm-up
                    </p>
                    <SettingsInfoTip label="About safety warm-up">
                      Gradually ramps connection requests over 4 weeks so a new
                      or cold LinkedIn account is less likely to get restricted.
                      Week 1 uses 30% of your weekly target (20% if SSI is under{" "}
                      {SSI_LOW_WARMUP_THRESHOLD}), week 2 uses 60%, week 3 uses
                      90%, then full volume from week 4. Turn it off to send at
                      your full weekly target right away.
                    </SettingsInfoTip>
                  </div>
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${
                      warmupEnabled && !warmupComplete
                        ? "text-amber-900/80"
                        : "text-slate-600"
                    }`}
                  >
                    {warmupStatus(warmupWeek, warmupEnabled, warmupComplete)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Invites today
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                    {today?.invitesAssigned ?? 0}
                    <span className="font-normal text-slate-400">
                      {" "}
                      of {today?.inviteQuota ?? "—"}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Sent last 7 days
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                    {snap?.rolling_7_sent ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Accept rate
                    <SettingsInfoTip label="About accept rate" align="right">
                      Aim for about {ACCEPT_RATE_TARGET_PCT}% or higher. Under{" "}
                      {ACCEPT_RATE_TARGET_PCT}% we warn you to improve targeting;
                      under {ACCEPT_RATE_PAUSE_PCT}% we suggest pausing before
                      you scale volume.
                    </SettingsInfoTip>
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                    {snap?.accept_rate == null
                      ? "—"
                      : `${Math.round(snap.accept_rate * 100)}%`}
                  </p>
                </div>
              </div>

              {error ? (
                <p className="text-xs text-rose-800">{error}</p>
              ) : null}

              {snap?.accept_pause_hint ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-950">
                  Accept rate under 15%. Pause or tighten targeting before
                  scaling.
                </p>
              ) : snap?.accept_warn ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Accept rate under 30%. Keep volume steady and improve
                  targeting.
                </p>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Limits
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Weekly targets for this LinkedIn account. We pace them
                      across your sending hours.
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    <CampaignLimitSlider
                      label={
                        <span className="inline-flex items-center gap-1">
                          Connection requests / week
                          <SettingsInfoTip label="Invite volume recommendation">
                            Recommended {recommend}/week
                            {account.ssi_score != null
                              ? ` based on your SSI score of ${Math.round(account.ssi_score)}`
                              : ""}
                            . SSI under 70 suggests 100; 70+ can go up to 200.
                          </SettingsInfoTip>
                        </span>
                      }
                      ariaLabel="Connection requests / week"
                      value={weeklyInvites}
                      min={WEEKLY_INVITE_MIN}
                      max={WEEKLY_INVITE_MAX}
                      warnAt={recommend + 1}
                      warning={`Above the ${recommend}/week recommendation for your SSI.`}
                      onChange={(weekly_invite_target) =>
                        setSnap((s) =>
                          s?.account
                            ? {
                                ...s,
                                account: { ...s.account, weekly_invite_target },
                              }
                            : s
                        )
                      }
                      onCommit={(weekly_invite_target) =>
                        save({ weekly_invite_target })
                      }
                    />

                    <CampaignLimitSlider
                      label="Messages / week"
                      value={weeklyMessages}
                      min={WEEKLY_MESSAGE_MIN}
                      max={WEEKLY_MESSAGE_MAX}
                      onChange={(weekly) =>
                        setSnap((s) =>
                          s?.account
                            ? {
                                ...s,
                                account: {
                                  ...s.account,
                                  daily_message_target: weeklyToDaily(
                                    weekly,
                                    20
                                  ),
                                },
                              }
                            : s
                        )
                      }
                      onCommit={(weekly) =>
                        save({
                          daily_message_target: weeklyToDaily(weekly, 20),
                        })
                      }
                    />

                    <CampaignLimitSlider
                      label="Post likes / week"
                      value={weeklyReacts}
                      min={WEEKLY_REACT_MIN}
                      max={WEEKLY_REACT_MAX}
                      onChange={(weekly) =>
                        setSnap((s) =>
                          s?.account
                            ? {
                                ...s,
                                account: {
                                  ...s.account,
                                  daily_react_target: weeklyToDaily(
                                    weekly,
                                    12
                                  ),
                                },
                              }
                            : s
                        )
                      }
                      onCommit={(weekly) =>
                        save({
                          daily_react_target: weeklyToDaily(weekly, 12),
                        })
                      }
                    />
                  </div>
                </section>

                <section>
                  <WeeklyHoursEditor
                    title="Hours"
                    hint="Shared by every campaign on this LinkedIn account."
                    timezone={timezone}
                    onTimezoneChange={setTimezone}
                    rules={rules}
                    onRulesChange={setRules}
                    saving={busy}
                    defaultStartTime="07:00"
                    defaultEndTime="18:00"
                    onSave={() =>
                      save({
                        timezone,
                        send_rules: rules,
                      })
                    }
                  />
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function demoSnap(): Snapshot {
  return {
    available: true,
    account: {
      id: "demo",
      weekly_invite_target: 100,
      daily_message_target: 20,
      daily_react_target: 12,
      min_action_delay_seconds: 180,
      max_action_delay_seconds: 480,
      timezone: "Europe/London",
      send_rules: parseCampaignSendRules(undefined),
      warmup_started_at: "2026-09-10T00:00:00Z",
      warmup_enabled: true,
      invite_paused_until: null,
      rate_limited_until: null,
      ssi_score: 61,
    },
    recommend: 100,
    effective_weekly_cap: 30,
    warmup_week: 1,
    warmup_complete: false,
    rolling_7_sent: 0,
    today: {
      inviteQuota: 4,
      messageQuota: 18,
      reactQuota: 11,
      invitesAssigned: 0,
    },
    accept_rate: null,
    accept_sample: 0,
    accept_warn: false,
    accept_pause_hint: false,
    today_ymd: "2026-09-14",
  };
}
