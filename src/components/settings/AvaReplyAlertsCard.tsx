"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { SectionInfoTip } from "@/components/settings/IntegrationsSettingsTab";
import { ProfileSectionCard } from "@/components/settings/ProfileFormLayout";

type ReplyMode = "off" | "copilot" | "autopilot";
type Settings = {
  reply_mode: ReplyMode;
  notify_push: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
  nudges_snoozed_until: string | null;
};
type State = {
  settings: Settings;
  autopilotAvailable: boolean;
  whatsappReady: boolean;
  hasPhone: boolean;
  phone: string;
  pushKey: string | null;
};

const MODES: { id: ReplyMode; label: string; detail: string }[] = [
  {
    id: "off",
    label: "Off",
    detail: "Ava stays quiet. You check LinkedIn replies yourself.",
  },
  {
    id: "copilot",
    label: "Copilot",
    detail: "Ava tells you the moment someone replies, with a draft ready. You send it.",
  },
  {
    id: "autopilot",
    label: "Autopilot",
    detail: "Ava answers for you when someone asks to talk, offering two times from your calendar.",
  },
];

const AUTOPILOT_INFO =
  "Coming soon. When someone clearly asks to talk, Ava will reply within a couple of minutes offering two times from your calendar, and you can cancel before it sends. BCA is switching it on coach by coach once it's proven.";

const CHANNELS_INFO =
  "Each alert opens the conversation with Ava's draft ready. WhatsApp alerts come from BCA's number and pause between 9pm and 7am.";

const NUDGES_INFO =
  "When you seem stuck, Ava leaves a short note in your Blueprint comments. BCA reads each one before it reaches you. Busy for a while? Pause them.";

const SNOOZE_OPTIONS: { days: number; label: string }[] = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
];

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Settings → Profile, under Integrations: how Ava handles LinkedIn replies and where she alerts the coach. */
export function AvaReplyAlertsCard() {
  const { impersonatingCoachId } = useImpersonation();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [pushOnHere, setPushOnHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/ava-settings", { headers });
      const body = (await res.json().catch(() => null)) as (State & { error?: string }) | null;
      if (cancelled) return;
      if (!res.ok || !body?.settings) setError(body?.error ?? "Could not load Ava's settings.");
      else setState(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  // This device already allowed alerts and holds a subscription: show it as on.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setPushOnHere(true);
      })
      .catch(() => undefined);
  }, []);

  const save = async (patch: Partial<Settings> | { nudges_snooze_days: number }) => {
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers || !state) return;
    const res = await fetch("/api/coach/ava-settings", { method: "PATCH", headers, body: JSON.stringify(patch) });
    const body = (await res.json().catch(() => null)) as { settings?: Settings; error?: string } | null;
    if (!res.ok || !body?.settings) {
      setError(body?.error ?? "Could not save.");
      return;
    }
    setError(null);
    setState({ ...state, settings: { ...state.settings, ...body.settings } });
  };

  const savePhone = async () => {
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers || !state || phoneDraft == null) return;
    setPhoneSaving(true);
    const res = await fetch("/api/coach/ava-settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ phone: phoneDraft }),
    });
    const body = (await res.json().catch(() => null)) as { phone?: string; error?: string } | null;
    setPhoneSaving(false);
    if (!res.ok || body?.phone === undefined) {
      setError(body?.error ?? "Could not save your number.");
      return;
    }
    setError(null);
    setPhoneDraft(null);
    setState({ ...state, phone: body.phone, hasPhone: Boolean(body.phone) });
  };

  const enablePush = async () => {
    if (!state?.pushKey) {
      setPushNote("Phone alerts aren't set up on the server yet.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushNote(
        isIos() && !isInstalled()
          ? "On iPhone: tap Share, then Add to Home Screen. Open Profit Coach from your home screen and tap Turn on again."
          : "This browser can't show alerts. Try Chrome, Edge or Safari, or add the app to your home screen."
      );
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushNote("Alerts are blocked. Allow notifications for Profit Coach in your settings, then try again.");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.pushKey) }));
      const headers = await getCoachAuthHeaders(null);
      if (!headers) return;
      delete headers["x-impersonate-coach-id"];
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers,
        body: JSON.stringify({ subscription: sub.toJSON(), test: true }),
      });
      if (res.ok) setPushOnHere(true);
      setPushNote(res.ok ? "Alerts are on for this device. You should see a test alert now." : "Couldn't turn on alerts. Try again.");
    } catch {
      setPushNote("Couldn't turn on alerts on this device.");
    } finally {
      setBusy(false);
    }
  };

  const s = state?.settings;
  const snoozedUntil = s?.nudges_snoozed_until && Date.parse(s.nudges_snoozed_until) > Date.now() ? s.nudges_snoozed_until : null;
  const smallButton =
    "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800";
  const rowClass = "flex items-center justify-between gap-3 border-b border-slate-50 py-2";
  const checkLabelClass = "flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900";

  return (
    <ProfileSectionCard
      title="Ava reply alerts"
      description="Ava reads every LinkedIn reply as it lands. Choose how she helps and where she tells you."
    >
      {!state || !s ? (
        error ? (
          <p className="py-2 text-xs text-rose-600">{error}</p>
        ) : (
          <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        )
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="sr-only">How Ava handles replies</legend>
            {MODES.map((m) => {
              const locked = m.id === "autopilot" && !state.autopilotAvailable;
              return (
                <div key={m.id} className="flex items-start gap-2.5 py-1.5">
                  <input
                    id={`ava-mode-${m.id}`}
                    type="radio"
                    name="ava-mode"
                    checked={s.reply_mode === m.id}
                    disabled={locked}
                    onChange={() => void save({ reply_mode: m.id })}
                    className="mt-1 disabled:cursor-not-allowed"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label
                        htmlFor={`ava-mode-${m.id}`}
                        className={`text-sm font-semibold ${locked ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-900"}`}
                      >
                        {m.label}
                      </label>
                      {m.id === "autopilot" ? (
                        <SectionInfoTip label={m.label} text={AUTOPILOT_INFO} wide />
                      ) : null}
                      {locked ? (
                        <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-400 ring-1 ring-inset ring-slate-200">
                          Coming soon
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-xs leading-snug ${locked ? "text-slate-400" : "text-slate-500"}`}>{m.detail}</p>
                  </div>
                </div>
              );
            })}
            {s.reply_mode === "off" ? (
              <p className="mt-1 text-xs text-amber-800">Ava isn&apos;t alerting you. Choose Copilot to turn her on.</p>
            ) : null}
          </fieldset>

          {s.reply_mode !== "off" ? (
            <div>
              <div className="mb-0.5 flex items-center gap-1 border-b border-slate-200 pb-1.5">
                <p className="text-xs font-semibold text-slate-600">Where Ava tells you</p>
                <SectionInfoTip label="Where Ava tells you" text={CHANNELS_INFO} />
              </div>

              <div className={rowClass}>
                <label className={checkLabelClass}>
                  <input id="ava-push" type="checkbox" checked={s.notify_push} onChange={(e) => void save({ notify_push: e.target.checked })} />
                  This phone or computer
                </label>
                <div className="flex shrink-0 items-center gap-2">
                  {pushOnHere ? <span className="text-xs font-medium text-emerald-700">On here</span> : null}
                  <button
                    type="button"
                    onClick={() => void enablePush()}
                    disabled={busy}
                    className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                  >
                    {busy ? (pushOnHere ? "Sending…" : "Turning on…") : pushOnHere ? "Send test" : "Turn on here"}
                  </button>
                </div>
              </div>
              {pushNote ? <p className="py-1.5 text-xs leading-relaxed text-slate-600">{pushNote}</p> : null}

              <div className="border-b border-slate-50 py-2">
                <label className={checkLabelClass}>
                  <input id="ava-whatsapp" type="checkbox" checked={s.notify_whatsapp} onChange={(e) => void save({ notify_whatsapp: e.target.checked })} />
                  WhatsApp from BCA
                  {state.hasPhone && !state.whatsappReady ? (
                    <span className="text-[11px] font-normal text-slate-400">starting soon</span>
                  ) : null}
                </label>
                {s.notify_whatsapp ? (
                  <div className="mt-2 pl-6">
                    <div className="flex items-center gap-2">
                      <label htmlFor="ava-phone" className="sr-only">
                        Your mobile
                      </label>
                      <input
                        id="ava-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Your mobile, e.g. +44 7700 900123"
                        value={phoneDraft ?? state.phone}
                        onChange={(e) => setPhoneDraft(e.target.value)}
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                      />
                      {phoneDraft != null && phoneDraft !== state.phone ? (
                        <button
                          type="button"
                          onClick={() => void savePhone()}
                          disabled={phoneSaving}
                          className="inline-flex h-8 shrink-0 items-center rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          {phoneSaving ? "Saving…" : "Save"}
                        </button>
                      ) : null}
                    </div>
                    {!state.hasPhone && phoneDraft == null ? (
                      <p className="mt-1 text-[11px] text-amber-800">Add your mobile so Ava can message you.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="py-2">
                <label className={checkLabelClass}>
                  <input id="ava-email" type="checkbox" checked={s.notify_email} onChange={(e) => void save({ notify_email: e.target.checked })} />
                  Email to yourself
                </label>
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-0.5 flex items-center gap-1 border-b border-slate-200 pb-1.5">
              <p className="text-xs font-semibold text-slate-600">Ava&apos;s nudges</p>
              <SectionInfoTip label="Ava's nudges" text={NUDGES_INFO} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2">
              <p className="text-sm font-semibold text-slate-900">
                {snoozedUntil
                  ? `Paused until ${new Date(snoozedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : "On"}
              </p>
              {snoozedUntil ? (
                <button type="button" onClick={() => void save({ nudges_snooze_days: 0 })} className={smallButton}>
                  Turn back on
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Pause for</span>
                  {SNOOZE_OPTIONS.map((o) => (
                    <button key={o.days} type="button" onClick={() => void save({ nudges_snooze_days: o.days })} className={smallButton}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      )}
    </ProfileSectionCard>
  );
}
