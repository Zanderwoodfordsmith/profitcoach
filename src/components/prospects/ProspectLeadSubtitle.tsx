"use client";

import { Globe } from "lucide-react";
import {
  formatBusinessLabel,
  formatProspectJobTitle,
} from "@/lib/prospectDisplayFormat";
import { companyWebsiteHref } from "@/lib/leadFinder/display";

type Props = {
  jobTitle: string | null;
  businessName: string | null;
  companyWebsite?: string | null;
  editable?: boolean;
  onEdit?: () => void;
};

export function WebsiteGlobe({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-row-action
      onClick={(e) => e.stopPropagation()}
      className="inline-flex shrink-0 text-slate-400 hover:text-sky-700"
      title={`Open ${label}`}
      aria-label={`Open ${label}`}
    >
      <Globe className="h-3 w-3" aria-hidden />
    </a>
  );
}

export function ProspectLeadSubtitle({
  jobTitle,
  businessName,
  companyWebsite,
  editable = false,
  onEdit,
}: Props) {
  const title = formatProspectJobTitle(jobTitle);
  const business = formatBusinessLabel(businessName);
  const websiteHref = companyWebsiteHref(companyWebsite);
  const websiteLabel = business || "Website";
  const openLabel = business ? `${business} website` : "website";
  const plain = [title, business].filter(Boolean).join(" · ");

  if (!title && !business && !websiteHref) {
    if (!editable) return null;
    return (
      <button
        type="button"
        data-row-action
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
        className="mt-px block max-w-full text-left text-xs leading-snug text-slate-400 hover:text-sky-700"
        title="Edit contact details"
      >
        Title · Business
      </button>
    );
  }

  if (websiteHref) {
    return (
      <div className="mt-px flex min-w-0 max-w-full items-center gap-1 text-xs leading-snug text-slate-500">
        {title ? <span className="min-w-0 truncate">{title}</span> : null}
        {title ? <span className="shrink-0">·</span> : null}
        <WebsiteGlobe href={websiteHref} label={openLabel} />
        <a
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          data-row-action
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 truncate text-sky-700 hover:underline"
          title={`Open ${openLabel}`}
        >
          {websiteLabel}
        </a>
      </div>
    );
  }

  if (!editable) {
    return (
      <span className="mt-px block truncate text-xs leading-snug text-slate-500">
        {plain}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-row-action
      onClick={(e) => {
        e.stopPropagation();
        onEdit?.();
      }}
      className="mt-px block max-w-full truncate text-left text-xs leading-snug text-slate-500 hover:text-sky-700"
      title="Edit contact details"
    >
      {plain}
    </button>
  );
}
