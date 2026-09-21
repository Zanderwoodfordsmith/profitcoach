"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import {
  CAMPAIGN_PRIORITY_LEVELS,
  campaignPriorityLevelFromStored,
  campaignPriorityValues,
  type CampaignPriorityLevel,
} from "@/lib/unipile/campaignPriority";

type CampaignSettings = {
  id: string;
  status: string;
  outreach_priority?: number | null;
  outreach_weight?: number | null;
  stop_on_reply?: boolean | null;
  source_playbook_id?: string | null;
};

type CampaignLife = "live" | "archive" | "delete";

const PRIORITY_LABEL: Record<CampaignPriorityLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const LIFE_TABS: Array<{
  id: CampaignLife;
  label: string;
  tip: string;
}> = [
  {
    id: "live",
    label: "Live",
    tip: "Stays in your campaign list. Turn sending on or off with the switch next to the name.",
  },
  {
    id: "archive",
    label: "Archive",
    tip: "Hides it from the list. Restore it later from Archived, or pick Live again.",
  },
  {
    id: "delete",
    label: "Delete",
    tip: "Removes this campaign, its steps, and everyone in its queue. Conversations and prospect records stay. This cannot be undone.",
  },
];

function TabInfoTip({
  label,
  selected,
  onLight,
  align = "left",
  children,
}: {
  label: string;
  selected: boolean;
  onLight?: boolean;
  align?: "left" | "center" | "right";
  children: ReactNode;
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
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
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
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`rounded-full p-0.5 pr-1.5 focus-visible:outline-none focus-visible:ring-2 ${
          selected && onLight
            ? "text-amber-900/70 hover:bg-amber-950/10 hover:text-amber-950 focus-visible:ring-amber-900/30"
            : selected
              ? "text-white/80 hover:bg-white/15 hover:text-white focus-visible:ring-white/40"
              : "text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 focus-visible:ring-[#0c5290]/40"
        }`}
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
          className={`absolute top-full z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-relaxed text-slate-600 shadow-lg ${
            align === "right"
              ? "right-0"
              : align === "center"
                ? "left-1/2 -translate-x-1/2"
                : "left-0"
          }`}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function CampaignSettingsModal({
  open,
  campaign,
  busy,
  onClose,
  onCampaignChange,
  onSave,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  open: boolean;
  campaign: CampaignSettings;
  busy: boolean;
  onClose: () => void;
  onCampaignChange: (patch: Partial<CampaignSettings>) => void;
  onSave: (patch: Record<string, unknown>) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const titleId = useId();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const archived = campaign.status === "archived";
  const life: Exclude<CampaignLife, "delete"> = archived ? "archive" : "live";
  const stopOnReply = campaign.stop_on_reply !== false;
  const priority = campaignPriorityLevelFromStored(
    campaign.outreach_priority,
    campaign.outreach_weight
  );

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmingDelete) {
        setConfirmingDelete(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmingDelete]);

  if (!open) return null;

  function setPriority(level: CampaignPriorityLevel) {
    const next = campaignPriorityValues(level);
    onCampaignChange(next);
    onSave(next);
  }

  function setLife(next: CampaignLife) {
    if (next === "delete") {
      setConfirmingDelete(true);
      return;
    }
    if (confirmingDelete) setConfirmingDelete(false);
    if (next === "archive") {
      if (!archived) onArchive();
      return;
    }
    if (archived) onUnarchive();
  }

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
        className="relative w-full max-w-md overflow-visible rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Campaign settings
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

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Priority</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              High campaigns send first and take a larger share of today&apos;s
              invites.
            </p>
            <div
              className="mt-3 grid grid-cols-3 rounded-full bg-slate-100 p-0.5"
              role="tablist"
              aria-label="Campaign priority"
            >
              {CAMPAIGN_PRIORITY_LEVELS.map((level) => {
                const selected = priority === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    disabled={busy}
                    onClick={() => setPriority(level)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold leading-tight transition duration-150 disabled:opacity-50 ${
                      selected
                        ? "bg-[#0c5290] text-white"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {PRIORITY_LABEL[level]}
                  </button>
                );
              })}
            </div>
          </div>

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
              onClick={() => {
                const next = !stopOnReply;
                onCampaignChange({ stop_on_reply: next });
                onSave({ stop_on_reply: next });
              }}
              className={`relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 ${
                stopOnReply
                  ? "bg-emerald-700 focus-visible:ring-emerald-700/40"
                  : "bg-slate-200 focus-visible:ring-slate-300"
              }`}
            >
              {stopOnReply ? (
                <span
                  className="pointer-events-none absolute top-1/2 left-[6px] -translate-y-1/2 text-[10px] font-bold tracking-wide text-white"
                  aria-hidden
                >
                  On
                </span>
              ) : null}
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  stopOnReply ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Campaign</p>
            <div
              className="mt-3 grid grid-cols-3 rounded-full bg-slate-100 p-0.5"
              role="tablist"
              aria-label="Campaign status"
            >
              {LIFE_TABS.map((tab, index) => {
                const selected = confirmingDelete
                  ? tab.id === "delete"
                  : life === tab.id;
                const onLight = selected && tab.id === "archive";
                const pill =
                  selected && tab.id === "live"
                    ? "bg-emerald-700 text-white"
                    : selected && tab.id === "archive"
                      ? "bg-amber-400 text-amber-950"
                      : selected && tab.id === "delete"
                        ? "bg-rose-800 text-white"
                        : "text-slate-500";
                return (
                  <span
                    key={tab.id}
                    className={`flex min-w-0 w-full items-center justify-center gap-0.5 rounded-full transition duration-150 ${pill}`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      disabled={busy}
                      onClick={() => setLife(tab.id)}
                      className={`py-1.5 pl-2.5 text-[13px] font-semibold leading-tight disabled:opacity-50 ${
                        selected ? "" : "hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                    <TabInfoTip
                      label={`About ${tab.label.toLowerCase()}`}
                      selected={selected}
                      onLight={onLight}
                      align={
                        index === 0 ? "left" : index === 2 ? "right" : "center"
                      }
                    >
                      {tab.tip}
                    </TabInfoTip>
                  </span>
                );
              })}
            </div>
            {confirmingDelete ? (
              <div className="mt-3">
                <p className="text-xs leading-snug text-rose-800">
                  Removes this campaign, its steps, and the queue. Conversations
                  and prospects stay.
                  {campaign.source_playbook_id
                    ? " A blank starter may come back — archive it instead to hide it."
                    : ""}
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDelete}
                    className="rounded-full bg-rose-800 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-rose-900 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
