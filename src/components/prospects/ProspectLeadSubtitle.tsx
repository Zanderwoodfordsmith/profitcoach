"use client";

import {
  formatProspectLabel,
  formatProspectPersonName,
} from "@/lib/prospectDisplayFormat";

type Props = {
  jobTitle: string | null;
  businessName: string | null;
  editable?: boolean;
  onEdit?: () => void;
};

function formatSubtitle(jobTitle: string | null, businessName: string | null): string {
  const title = formatProspectLabel(jobTitle);
  const business = formatProspectLabel(businessName);
  const parts = [title, business].filter(Boolean);
  return parts.join(" · ");
}

export function ProspectLeadSubtitle({
  jobTitle,
  businessName,
  editable = false,
  onEdit,
}: Props) {
  const subtitle = formatSubtitle(jobTitle, businessName);

  if (!editable) {
    return subtitle ? (
      <span className="mt-px block text-xs leading-snug text-slate-500">{subtitle}</span>
    ) : null;
  }

  return (
    <button
      type="button"
      data-row-action
      onClick={(e) => {
        e.stopPropagation();
        onEdit?.();
      }}
      className="mt-px block max-w-full text-left text-xs leading-snug text-slate-500 hover:text-sky-700"
      title="Edit contact details"
    >
      {subtitle || (
        <span className="text-slate-400">Title · Business</span>
      )}
    </button>
  );
}
