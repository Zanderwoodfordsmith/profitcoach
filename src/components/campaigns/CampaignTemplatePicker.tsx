"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Heart,
  LayoutTemplate,
  MessageCircle,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  CAMPAIGN_LIBRARY_KIND_LABEL,
  sortByCampaignLibraryKind,
  type CampaignLibraryKind,
  type CoachCampaignTemplate,
} from "@/lib/campaignLibrary/types";
import {
  campaignStepCountsInTotal,
  campaignStepTypeLabel,
} from "@/lib/unipile/campaignStepTypes";
import type { CampaignChannel } from "@/lib/unipile/campaigns";

const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  whatsapp: "WhatsApp",
};

/** Only templates that make this kind of campaign. */
export function templatesForChannel(
  templates: CoachCampaignTemplate[],
  channel: CampaignChannel
): CoachCampaignTemplate[] {
  return templates.filter((t) => (t.channel ?? "linkedin") === channel);
}

export function noTemplatesText(channel: CampaignChannel): string {
  if (channel === "linkedin") return "No templates yet.";
  const label = CHANNEL_LABEL[channel];
  return `No ${label} templates yet. To make one, open the ⋯ menu on one of your ${label} campaigns and pick Save as template.`;
}

const KIND_ICON: Record<CampaignLibraryKind, LucideIcon> = {
  connector: UserPlus,
  reactivation: RotateCcw,
  nurture: Heart,
  positive_reply: MessageCircle,
};

export function campaignTemplateActionSummary(stepTypes: string[]): string {
  const actions = stepTypes.filter((type) => campaignStepCountsInTotal(type));
  const count = actions.length;
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

  /** Rename or delete one of the coach's own templates; throws with a message. */
  const rename = useCallback(
    async (id: string, name: string) => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaign-templates/${encodeURIComponent(id)}`,
        { method: "PATCH", headers, body: JSON.stringify({ name }) }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        template?: CoachCampaignTemplate;
      };
      if (!res.ok || !body.template) {
        throw new Error(body.error || "Could not rename it.");
      }
      const updated = body.template;
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    [impersonatingCoachId]
  );

  const remove = useCallback(
    async (id: string) => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaign-templates/${encodeURIComponent(id)}`,
        { method: "DELETE", headers }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not delete it.");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [impersonatingCoachId]
  );

  const loading = enabled && status !== "ready" && status !== "error";
  return { templates, loading, error, rename, remove };
}

export function CampaignTemplateList({
  templates,
  loading,
  error,
  busy = false,
  onPick,
  onRename,
  onDelete,
  emptyText = "No templates yet.",
}: {
  templates: CoachCampaignTemplate[];
  loading: boolean;
  error: string | null;
  busy?: boolean;
  onPick: (template: CoachCampaignTemplate) => void;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  emptyText?: string;
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
        {emptyText}
      </p>
    );
  }

  const mine = templates.filter((t) => t.mine);
  const bca = sortByCampaignLibraryKind(templates.filter((t) => !t.mine));
  const card = (template: CoachCampaignTemplate) => (
    <TemplateCard
      key={template.id}
      template={template}
      busy={busy}
      onPick={onPick}
      onRename={template.mine ? onRename : undefined}
      onDelete={template.mine ? onDelete : undefined}
    />
  );

  if (mine.length === 0) {
    return <ul className="space-y-2">{bca.map(card)}</ul>;
  }
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 px-1 text-xs font-semibold text-slate-500">
          Your templates
        </h3>
        <ul className="space-y-2">{mine.map(card)}</ul>
      </section>
      {bca.length > 0 ? (
        <section>
          <h3 className="mb-2 px-1 text-xs font-semibold text-slate-500">
            BCA templates
          </h3>
          <ul className="space-y-2">{bca.map(card)}</ul>
        </section>
      ) : null}
    </div>
  );
}

const TEMPLATE_CARD_CLASS =
  "flex w-full items-start gap-3 px-4 py-3.5 text-left hover:border-[#0c5290] hover:bg-sky-50/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2";

/** One template. The coach's own also get rename and delete, done in place. */
function TemplateCard({
  template,
  busy,
  onPick,
  onRename,
  onDelete,
}: {
  template: CoachCampaignTemplate;
  busy: boolean;
  onPick: (template: CoachCampaignTemplate) => void;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [name, setName] = useState(template.name);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = KIND_ICON[template.kind] ?? LayoutTemplate;
  const editable = Boolean(onRename || onDelete);

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError(null);
    try {
      await action();
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  if (mode === "rename" && onRename) {
    return (
      <li className={cardClass("raised", "px-4 py-3.5")}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void run(() => onRename(template.id, name.trim()));
          }}
        >
          <input
            autoFocus
            aria-label="Template name"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setName(template.name);
                setMode("view");
              }
            }}
            className={fieldClass("input", "normal", "min-w-0 flex-1")}
          />
          <button
            type="submit"
            disabled={working || !name.trim()}
            className={buttonClass("main")}
          >
            Save
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => {
              setName(template.name);
              setMode("view");
            }}
            className={buttonClass("quiet")}
          >
            Cancel
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </li>
    );
  }

  if (mode === "delete" && onDelete) {
    return (
      <li className={cardClass("raised", "px-4 py-3.5")}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-slate-800">
            Delete “{template.name}”? Campaigns made from it stay as they are.
          </p>
          <button
            type="button"
            disabled={working}
            onClick={() => void run(() => onDelete(template.id))}
            className={buttonClass("delete")}
          >
            Delete
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => setMode("view")}
            className={buttonClass("quiet")}
          >
            Cancel
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </li>
    );
  }

  return (
    <li className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => onPick(template)}
        className={cardClass("raised", `${TEMPLATE_CARD_CLASS}${editable ? " pr-20" : ""}`)}
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290]">
          <Icon className="h-5 w-5" strokeWidth={2.1} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-ui font-semibold text-slate-900">
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
      {editable ? (
        <span className="absolute right-3 top-3 flex gap-1">
          {onRename ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("rename")}
              aria-label={`Rename ${template.name}`}
              title="Rename"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("delete")}
              aria-label={`Delete ${template.name}`}
              title="Delete"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

export function CampaignTemplatePickerModal({
  open,
  channel = "linkedin",
  busy = false,
  error = null,
  onClose,
  onPick,
}: {
  open: boolean;
  /** The campaign's channel: only its templates are offered. */
  channel?: CampaignChannel;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onPick: (template: CoachCampaignTemplate) => void;
}) {
  const { templates, loading, error: loadError, rename, remove } =
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
            className={buttonClass("quiet")}
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
          templates={templatesForChannel(templates, channel)}
          loading={loading}
          error={loadError}
          busy={busy}
          onPick={onPick}
          onRename={rename}
          onDelete={remove}
          emptyText={noTemplatesText(channel)}
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
