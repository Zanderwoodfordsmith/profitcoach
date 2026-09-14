"use client";

import { CampaignLimitSlider } from "@/components/campaigns/CampaignLimitSlider";

type CampaignSettings = {
  id: string;
  outreach_priority?: number | null;
  outreach_weight?: number | null;
  stop_on_reply?: boolean | null;
};

export function CampaignSettingsForm({
  campaign,
  busy,
  onCampaignChange,
  onSave,
  onArchive,
}: {
  campaign: CampaignSettings;
  busy: boolean;
  onCampaignChange: (patch: Partial<CampaignSettings>) => void;
  onSave: (patch: Record<string, unknown>) => void;
  onArchive: () => void;
}) {
  const priority = Math.max(1, Number(campaign.outreach_priority ?? 100));
  const weight = Math.max(1, Number(campaign.outreach_weight ?? 1));

  return (
    <div className="mt-4 max-w-lg space-y-5">
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          Share of account budget
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Daily limits live on your account. Use these when more than one
          campaign is running.
        </p>
        <div className="mt-5 space-y-6">
          <CampaignLimitSlider
            label="Priority (lower runs first)"
            value={priority}
            min={1}
            max={100}
            onChange={(outreach_priority) =>
              onCampaignChange({ outreach_priority })
            }
            onCommit={(outreach_priority) => onSave({ outreach_priority })}
          />
          <CampaignLimitSlider
            label="Weight (share of invites)"
            value={weight}
            min={1}
            max={10}
            onChange={(outreach_weight) =>
              onCampaignChange({ outreach_weight })
            }
            onCommit={(outreach_weight) => onSave({ outreach_weight })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Stop when they reply
            </h3>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">
              Cancels remaining steps for that person. Everyone else keeps
              going.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={campaign.stop_on_reply !== false}
            aria-label="Stop when they reply"
            disabled={busy}
            onClick={() => {
              const next = campaign.stop_on_reply === false;
              onCampaignChange({ stop_on_reply: next });
              onSave({ stop_on_reply: next });
            }}
            className={`relative mt-0.5 h-6 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
              campaign.stop_on_reply !== false
                ? "bg-emerald-700"
                : "bg-slate-200"
            }`}
          >
            {campaign.stop_on_reply !== false ? (
              <span
                className="pointer-events-none absolute top-1/2 left-[6px] -translate-y-1/2 text-[10px] font-bold tracking-wide text-white"
                aria-hidden
              >
                On
              </span>
            ) : null}
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                campaign.stop_on_reply !== false ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>
      </section>

      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
        >
          Archive campaign
        </button>
      </div>
    </div>
  );
}
