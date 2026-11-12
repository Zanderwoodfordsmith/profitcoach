"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type Sender = "app" | "crm";

type SenderState = {
  sender: Sender;
  chosen: boolean;
  hasCrmLink: boolean;
  emailAccount: string | null;
  callName: string;
};

/**
 * Lead magnet settings (job 214): who emails people after they take the
 * BOSS Score or BOSS Pro. One setting for every lead magnet: this app, from
 * the coach's own email, or their old CRM.
 */
export function LeadMagnetSettingsButton({
  impersonatingCoachId,
  prefix,
}: {
  impersonatingCoachId: string | null;
  prefix: "/coach" | "/admin";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("second", "small")}>
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.25} aria-hidden />
        Settings
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lead magnet settings"
        subtitle="These apply to every lead magnet."
        maxWidthClassName="max-w-lg"
      >
        {open ? <ScorecardEmailSender impersonatingCoachId={impersonatingCoachId} prefix={prefix} /> : null}
      </Modal>
    </>
  );
}

function ScorecardEmailSender({
  impersonatingCoachId,
  prefix,
}: {
  impersonatingCoachId: string | null;
  prefix: "/coach" | "/admin";
}) {
  const [state, setState] = useState<SenderState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await getCoachAuthHeaders(impersonatingCoachId);
    if (!headers) return;
    const res = await fetch("/api/coach/scorecard-email-sender", { headers });
    if (res.ok) setState((await res.json()) as SenderState);
    else setError("Could not load your settings.");
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(sender: Sender) {
    if (!state || sender === state.sender || saving) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Please sign in again.");
      const res = await fetch("/api/coach/scorecard-email-sender", {
        method: "PUT",
        headers,
        body: JSON.stringify({ sender }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save.");
      setState(body as SenderState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!state) {
    return <p className="px-5 py-4 text-sm text-slate-500">{error ?? "Loading…"}</p>;
  }

  const app = state.sender === "app";
  const option = (value: Sender, label: string) => (
    <button
      type="button"
      onClick={() => void choose(value)}
      disabled={saving}
      aria-pressed={state.sender === value}
      className={`px-3 py-1.5 text-sm font-medium transition ${
        state.sender === value
          ? "bg-sky-600 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h3 className="text-sm font-semibold text-slate-900">Who emails people after they take one?</h3>
      <div
        className="inline-flex w-fit overflow-hidden rounded-lg border border-slate-200 bg-white"
        role="group"
        aria-label="Who sends the emails"
      >
        {option("app", "This app")}
        <span className="w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
        {option("crm", "My old CRM")}
      </div>
      <p className="text-sm text-slate-600">
        {app
          ? state.emailAccount
            ? `This app sends their report straight away, then the follow-ups in each lead magnet's Sequences tab, from ${state.emailAccount}. Each email offers your ${state.callName}. The emails stop when they book or reply.`
            : "This app sends their report straight away from our support address, in your name. Connect your email so the report and the follow-ups come from you."
          : state.hasCrmLink
            ? "Your old CRM sends the report and follow-ups. Nothing goes from this app."
            : "Your old CRM is not connected, so nobody gets an email. Choose This app."}
      </p>
      {app && !state.emailAccount ? (
        <a
          href={`${prefix}/settings?tab=integrations`}
          className="w-fit text-sm font-medium text-[#0c5290] hover:underline"
        >
          Connect your email
        </a>
      ) : null}
      {app ? (
        <p className="text-xs text-slate-500">
          The call is named after your booking calendar.{" "}
          <a
            href={`${prefix}/calls?tab=settings&calendar=discovery`}
            className="font-medium text-[#0c5290] hover:underline"
          >
            Rename it
          </a>
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
