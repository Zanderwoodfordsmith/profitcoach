"use client";

import { useEffect, useState } from "react";
import { FilePlus, LayoutTemplate } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  CampaignTemplateList,
  TemplatePickerBackButton,
  usePublishedCampaignTemplates,
} from "@/components/campaigns/CampaignTemplatePicker";
import type { CoachCampaignTemplate } from "@/lib/campaignLibrary/types";
import type { CampaignChannel } from "@/lib/unipile/campaigns";

type Screen = "choose" | "templates";

export function CampaignCreateModal({
  open,
  busy,
  error,
  onClose,
  onCreateBlank,
  onCreateFromTemplate,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreateBlank: (name: string, channel: CampaignChannel) => void;
  onCreateFromTemplate: (name: string, template: CoachCampaignTemplate) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("linkedin");
  const [screen, setScreen] = useState<Screen>("choose");
  const { templates, loading, error: templatesError } =
    usePublishedCampaignTemplates(open && screen === "templates");

  useEffect(() => {
    if (!open) {
      setName("");
      setChannel("linkedin");
      setScreen("choose");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={screen === "templates" ? "Choose a template" : "Create campaign"}
      subtitle={
        screen === "templates"
          ? name.trim()
            ? `For "${name.trim()}"`
            : "Uses the template name if you leave this blank."
          : "Name it, then start blank or from a template."
      }
      maxWidthClassName="max-w-lg"
      overlayClassName="z-[80]"
    >
      <div className="px-5 py-4">
        {screen === "templates" ? (
          <>
            <TemplatePickerBackButton
              disabled={busy}
              onClick={() => setScreen("choose")}
            />
            <CampaignTemplateList
              templates={templates}
              loading={loading}
              error={templatesError}
              busy={busy}
              onPick={(template) => onCreateFromTemplate(name, template)}
            />
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-800">
              Name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled campaign"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none ring-[#0c5290]/30 placeholder:text-slate-400 focus:ring-2"
              />
            </label>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800">Channel</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(
                  [
                    ["linkedin", "LinkedIn"],
                    ["email", "Email"],
                    ["whatsapp", "WhatsApp"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => setChannel(id)}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
                      channel === id
                        ? "border-[#0c5290] bg-sky-50 text-[#0c5290]"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {channel === "whatsapp"
                  ? "People need a phone number. LinkedIn is not required."
                  : channel === "email"
                    ? "People need an email address."
                    : "People need a LinkedIn profile."}
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onCreateBlank(name, channel)}
                className="flex min-h-[7.5rem] flex-col items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:border-[#0c5290] hover:bg-sky-50/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
                  <FilePlus className="h-5 w-5" strokeWidth={2.1} aria-hidden />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-slate-900">
                    Blank
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                    Write the invite and follow-ups yourself.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy || channel !== "linkedin"}
                onClick={() => setScreen("templates")}
                className="flex min-h-[7.5rem] flex-col items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:border-[#0c5290] hover:bg-sky-50/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
                  <LayoutTemplate
                    className="h-5 w-5"
                    strokeWidth={2.1}
                    aria-hidden
                  />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-slate-900">
                    Templates
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                    {channel === "linkedin"
                      ? "Start from a sequence that is already written."
                      : "Templates are LinkedIn sequences."}
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
