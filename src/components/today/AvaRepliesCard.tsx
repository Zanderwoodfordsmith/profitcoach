"use client";

import { useEffect, useState } from "react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type ReplyMode = "off" | "copilot" | "autopilot";
type Settings = {
  reply_mode: ReplyMode;
  notify_push: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
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
  { id: "copilot", label: "Copilot", detail: "Ava tells you the moment someone replies, with a draft ready. You send it." },
  { id: "autopilot", label: "Autopilot", detail: "When someone asks to talk, Ava replies within a minute or two offering two times from your calendar. You can cancel it before it goes." },
  { id: "off", label: "Off", detail: "No alerts or drafts." },
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

export function AvaRepliesCard() {
  const { impersonatingCoachId } = useImpersonation();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Settings, not daily work: show a one-line summary unless the coach opens it.
  const [open, setOpen] = useState(false);
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

  const save = async (patch: Partial<Settings>) => {
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
          ? "On iPhone: tap Share, then Add to Home Screen. Open Profit Coach from your home screen and tap this button again."
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
      setPushNote(res.ok ? "Alerts are on for this device. You should see a test alert now." : "Couldn't turn on alerts. Try again.");
    } catch {
      setPushNote("Couldn't turn on alerts on this device.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return error ? <p className="text-sm text-amber-800">{error}</p> : null;
  }
  const s = state.settings;

  if (!open) {
    const channels = [
      s.notify_push ? "this device" : null,
      s.notify_whatsapp ? "WhatsApp" : null,
      s.notify_email ? "email" : null,
    ].filter(Boolean);
    const mode = MODES.find((m) => m.id === s.reply_mode)?.label ?? "Off";
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-700">
          <span className="font-semibold text-slate-900">Ava replies:</span> {mode}
          {s.reply_mode !== "off"
            ? channels.length
              ? `, alerts by ${channels.join(", ")}`
              : ", no alerts switched on"
            : ""}
          {s.reply_mode !== "off" && s.notify_whatsapp && !state.hasPhone ? (
            <>
              {" · "}
              <button type="button" onClick={() => setOpen(true)} className="text-amber-800 underline underline-offset-2">
                add your mobile for WhatsApp
              </button>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        >
          Change
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Ava replies</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Done
        </button>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        People who reply within minutes book far more calls. Ava reads every LinkedIn reply as it lands.
      </p>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">How Ava handles replies</legend>
        {MODES.map((m) => {
          const locked = m.id === "autopilot" && !state.autopilotAvailable;
          const selected = s.reply_mode === m.id;
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm ${selected ? "border-sky-700 bg-sky-50" : "border-slate-200"} ${locked ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <input
                  id={`ava-mode-${m.id}`}
                  type="radio"
                  name="ava-mode"
                  checked={selected}
                  disabled={locked}
                  onChange={() => void save({ reply_mode: m.id })}
                />
                {m.label}
                {locked ? <span className="text-xs font-normal text-slate-500">· BCA turns this on when you&apos;re ready</span> : null}
              </span>
              <span className="mt-1 text-slate-600">{m.detail}</span>
            </label>
          );
        })}
      </fieldset>

      {s.reply_mode !== "off" ? (
        <div className="mt-5 space-y-3 text-sm">
          <p className="font-medium text-slate-800">Where Ava tells you</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input id="ava-push" type="checkbox" checked={s.notify_push} onChange={(e) => void save({ notify_push: e.target.checked })} />
              This phone or computer
            </label>
            <button
              type="button"
              onClick={() => void enablePush()}
              disabled={busy}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              {busy ? "Turning on…" : "Turn on alerts on this device"}
            </button>
          </div>
          {pushNote ? <p className="text-slate-600">{pushNote}</p> : null}
          <label className="flex items-center gap-2">
            <input id="ava-whatsapp" type="checkbox" checked={s.notify_whatsapp} onChange={(e) => void save({ notify_whatsapp: e.target.checked })} />
            WhatsApp from BCA
            {state.hasPhone && !state.whatsappReady ? <span className="text-slate-500">· starting soon</span> : null}
          </label>
          {s.notify_whatsapp ? (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <label htmlFor="ava-phone" className="text-slate-700">
                Your mobile
              </label>
              <input
                id="ava-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+44 7700 900123"
                value={phoneDraft ?? state.phone}
                onChange={(e) => setPhoneDraft(e.target.value)}
                className="w-48 rounded-md border border-slate-300 px-2.5 py-1.5"
              />
              {phoneDraft != null && phoneDraft !== state.phone ? (
                <button
                  type="button"
                  onClick={() => void savePhone()}
                  disabled={phoneSaving}
                  className="rounded-md bg-sky-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                >
                  {phoneSaving ? "Saving…" : "Save"}
                </button>
              ) : !state.hasPhone ? (
                <span className="text-amber-800">Add it so Ava can message you</span>
              ) : null}
            </div>
          ) : null}
          <label className="flex items-center gap-2">
            <input id="ava-email" type="checkbox" checked={s.notify_email} onChange={(e) => void save({ notify_email: e.target.checked })} />
            Email to yourself
          </label>
          <p className="text-xs text-slate-500">WhatsApp alerts pause between 9pm and 7am.</p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-amber-800">{error}</p> : null}
    </section>
  );
}
