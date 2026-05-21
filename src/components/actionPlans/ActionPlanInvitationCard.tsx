"use client";

import type { ActionOutlineLine } from "@/lib/actionPlans/types";
import { ActionOutlineEditor } from "@/components/actionPlans/ActionOutlineEditor";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

export type ActionPlanInvitationSummary = {
  id: string;
  templateId: string;
  status: string;
  invitedAt: string;
  title: string;
  description: string | null;
};

type ActionPlanInvitationCardProps = {
  invitation: ActionPlanInvitationSummary;
  previewItems?: ActionOutlineLine[];
  previewLoading?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onAccept: (invitationId: string) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
  busy?: boolean;
};

export function ActionPlanInvitationCard({
  invitation,
  previewItems = [],
  previewLoading = false,
  expanded: expandedProp,
  onToggleExpand,
  onAccept,
  onDecline,
  busy = false,
}: ActionPlanInvitationCardProps) {
  const [expandedInternal, setExpandedInternal] = useState(false);
  const expanded = expandedProp ?? expandedInternal;
  const toggleExpand =
    onToggleExpand ??
    (() => {
      setExpandedInternal((value) => !value);
    });

  return (
    <div className="mx-auto mb-4 max-w-5xl rounded-2xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Action plan offered to you
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{invitation.title}</h3>
          {invitation.description ? (
            <p className="mt-1 text-sm text-slate-600">{invitation.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDecline(invitation.id)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAccept(invitation.id)}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Accept plan
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleExpand}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-sky-800 hover:text-sky-950"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
        {expanded ? "Hide preview" : "Preview actions"}
      </button>

      {expanded ? (
        <div className="mt-3 rounded-xl border border-sky-100 bg-white">
          {previewLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : previewItems.length ? (
            <ActionOutlineEditor
              items={previewItems.map((item) => ({ ...item, isLocked: true }))}
              onItemsChange={() => {}}
              mode="template"
              isRowLocked={() => true}
              emptyMessage="No actions in this plan."
            />
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">No actions in this plan.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
