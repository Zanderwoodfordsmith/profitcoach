"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Heart,
  LayoutTemplate,
  MessageCircle,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  sortByCampaignLibraryKind,
  type CampaignLibraryKind,
  type CoachCampaignTemplate,
} from "@/lib/campaignLibrary/types";
import { campaignStepTypeLabel } from "@/lib/unipile/campaignStepTypes";

const KIND_ICON: Record<CampaignLibraryKind, LucideIcon> = {
  connector: UserPlus,
  reactivation: RotateCcw,
  nurture: Heart,
  positive_reply: MessageCircle,
};

export function campaignTemplateActionSummary(stepTypes: string[]): string {
  const actions = stepTypes.filter((type) => type && type !== "wait");
  const count = stepTypes.length;
  const stepsLabel = `${count} step${count === 1 ? "" : "s"}`;
  if (actions.length === 0) return stepsLabel;
  const labels = actions
    .slice(0, 3)
    .map((type) => campaignStepTypeLabel(type));
  const extra = actions.length > 3 ? ` +${actions.length - 3}` : "";
  return `${labels.join(" · ")}${extra} · ${stepsLabel}`;
}

export function usePublishedCampaignTemplates(enabled: boolean) {
  const { impersonatingCoachId } = useImpersonation();
  const [templates, setTemplates] = useState<CoachCampaignTemplate[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const headers = await getCoachAuthHeaders(impersonatingCoachId);
        if (!headers) throw new Error("Sign in required.");
        const res = await fetch(
          "/api/coach/linkedin-outreach/campaign-templates",
          { headers }
        );
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          templates?: CoachCampaignTemplate[];
        };
        if (!res.ok) throw new Error(body.error || "Could not load templates.");
        if (!cancelled) {
          setTemplates(body.templates ?? []);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load templates.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, impersonatingCoachId]);

  const loading = enabled && status !== "ready" && status !== "error";
  return { templates, loading, error };
}

export function CampaignTemplateList({
  templates,
  loading,
  error,
  busy = false,
  onPick,
}: {
  templates: CoachCampaignTemplate[];
  loading: boolean;
  error: string | null;
  busy?: boolean;
  onPick: (template: CoachCampaignTemplate) => void;
}) {
  if (loading) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-500">
        Loading templates…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </p>
    );
  }
  if (templates.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-500">
        No published templates yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sortByCampaignLibraryKind(templates).map((template) => {
        const Icon = KIND_ICON[template.kind] ?? LayoutTemplate;
        return (
          <li key={template.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(template)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left hover:border-[#0c5290] hover:bg-sky-50/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
                <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-slate-900">
                  {template.name}
                </span>
                {CAMPAIGN_LIBRARY_KIND_LABEL[template.kind] !== template.name ? (
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    {CAMPAIGN_LIBRARY_KIND_LABEL[template.kind]}
                  </span>
                ) : null}
                {template.description ? (
                  <span className="mt-1 block text-sm leading-snug text-slate-600">
                    {template.description}
                  </span>
                ) : null}
                <span className="mt-1.5 block text-xs text-slate-500">
                  {campaignTemplateActionSummary(template.step_types)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CampaignTemplatePickerModal({
  open,
  busy = false,
  error = null,
  onClose,
  onPick,
}: {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onPick: (template: CoachCampaignTemplate) => void;
}) {
  const { templates, loading, error: loadError } =
    usePublishedCampaignTemplates(open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="Choose a template"
      subtitle="This writes the steps. You can edit them after."
      maxWidthClassName="max-w-lg"
      overlayClassName="z-[80]"
      footer={
        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="max-h-[min(28rem,60vh)] overflow-y-auto px-5 py-4">
        {error ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <CampaignTemplateList
          templates={templates}
          loading={loading}
          error={loadError}
          busy={busy}
          onPick={onPick}
        />
      </div>
    </Modal>
  );
}

export function TemplatePickerBackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back
    </button>
  );
}
