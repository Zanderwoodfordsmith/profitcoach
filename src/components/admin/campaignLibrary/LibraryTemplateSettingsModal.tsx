"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { WeeklyHoursEditor } from "@/components/booking/WeeklyHoursEditor";
import { CampaignLimitSlider } from "@/components/campaigns/CampaignLimitSlider";
import type { CampaignLibraryTemplateSettings } from "@/lib/campaignLibrary/types";
import {
  DAILY_INVITE_LIMIT_MAX,
  DAILY_MESSAGE_LIMIT_MAX,
  DAILY_REACT_LIMIT_MAX,
} from "@/lib/unipile/campaignSendWindow";

export function LibraryTemplateSettingsModal({
  open,
  settings,
  busy,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  settings: CampaignLibraryTemplateSettings;
  busy: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CampaignLibraryTemplateSettings>) => void;
  onSave: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stopOnReply = settings.stop_on_reply !== false;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 pb-24 sm:pb-4">
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
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Template settings
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
        <div className="space-y-6 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                Stop when they reply
              </p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">
                Cancels remaining steps for that person. Everyone else keeps
                going.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={stopOnReply}
              aria-label="Stop when they reply"
              disabled={busy}
              onClick={() => onChange({ stop_on_reply: !stopOnReply })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                stopOnReply ? "bg-[#0c5290]" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  stopOnReply ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <CampaignLimitSlider
            label="Daily invites"
            value={settings.daily_invite_limit}
            max={DAILY_INVITE_LIMIT_MAX}
            onChange={(daily_invite_limit) => onChange({ daily_invite_limit })}
            onCommit={(daily_invite_limit) => onChange({ daily_invite_limit })}
          />
          <CampaignLimitSlider
            label="Daily messages"
            value={settings.daily_message_limit}
            max={DAILY_MESSAGE_LIMIT_MAX}
            onChange={(daily_message_limit) =>
              onChange({ daily_message_limit })
            }
            onCommit={(daily_message_limit) =>
              onChange({ daily_message_limit })
            }
          />
          <CampaignLimitSlider
            label="Daily reactions"
            value={settings.daily_react_limit}
            max={DAILY_REACT_LIMIT_MAX}
            onChange={(daily_react_limit) => onChange({ daily_react_limit })}
            onCommit={(daily_react_limit) => onChange({ daily_react_limit })}
          />

          <WeeklyHoursEditor
            title="Send window"
            hint="When this template is used, sends stay inside these hours."
            timezone={settings.timezone}
            onTimezoneChange={(timezone) => onChange({ timezone })}
            rules={settings.send_rules}
            onRulesChange={(send_rules) => onChange({ send_rules })}
            onSave={onSave}
            saving={busy}
            saveLabel="Save settings"
          />
        </div>
      </div>
    </div>
  );
}
