"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";

function channelLabel(channel: string | undefined): string {
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp";
  return "LinkedIn";
}

/** Name it, save it: the campaign's steps and settings become the coach's own template. */
export function SaveCampaignTemplateModal({
  campaign,
  onClose,
}: {
  campaign: { id: string; name: string; channel?: string } | null;
  onClose: () => void;
}) {
  const { impersonatingCoachId } = useImpersonation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    setName(campaign?.name ?? "");
    setError(null);
    setSavedName(null);
  }, [campaign]);

  async function save() {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/campaign-templates", {
        method: "POST",
        headers,
        body: JSON.stringify({ campaign_id: campaign.id, name }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        template?: { name: string };
      };
      if (!res.ok) throw new Error(body.error || "Could not save the template.");
      setSavedName(body.template?.name ?? name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={campaign != null}
      onClose={onClose}
      busy={busy}
      title={savedName ? "Template saved" : "Save as template"}
      subtitle={
        savedName
          ? undefined
          : "Saves the steps and sending settings, not the people. It's just for you: no other coach sees it."
      }
      maxWidthClassName="max-w-md"
      overlayClassName="z-[80]"
      footer={
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {savedName ? (
            <button type="button" onClick={onClose} className={buttonClass("main")}>
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className={buttonClass("quiet")}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="save-campaign-template"
                disabled={busy}
                className={buttonClass("main")}
              >
                {busy ? "Saving…" : "Save template"}
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="px-5 py-4">
        {savedName ? (
          <p className="text-sm leading-relaxed text-slate-700">
            “{savedName}” is under <span className="font-semibold">Your templates</span>{" "}
            when you start a new {channelLabel(campaign?.channel)} campaign and pick
            Templates.
          </p>
        ) : (
          <form
            id="save-campaign-template"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="block text-sm font-medium text-slate-800">
              Template name
              <input
                autoFocus
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled template"
                className={fieldClass("input", "normal", "mt-1.5")}
              />
            </label>
            {error ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </Modal>
  );
}
