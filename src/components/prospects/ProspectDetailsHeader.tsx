"use client";

import type { ReactNode } from "react";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { ProspectHeaderTags } from "@/components/prospects/ProspectHeaderTags";
import { phoneToTelHref } from "@/lib/formatPhoneDisplay";

type Props = {
  avatar: ReactNode;
  displayName: string;
  jobTitle?: string | null;
  businessDraft: string;
  onBusinessChange: (value: string) => void;
  onBusinessSave: () => void;
  phone?: string | null;
  email?: string | null;
  linkedIn?: string | null;
  prospectHref?: string | null;
  /** Open the full prospect profile in place (conversation stays mounted). */
  onOpenProfile?: () => void;
  tags: string[];
  tagCatalog?: string[];
  tagsSaving?: boolean;
  canEditTags?: boolean;
  onTagsChange: (tags: string[]) => Promise<void> | void;
  onEmail?: () => void;
};

function ActionButton({
  label,
  disabled,
  href,
  external,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  href?: string | null;
  external?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = `inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-700`;

  if (href && !disabled) {
    return (
      <a
        href={href}
        title={label}
        aria-label={label}
        className={className}
        {...(external
          ? { target: "_blank", rel: "noreferrer" }
          : undefined)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export function ProspectDetailsHeader({
  avatar,
  displayName,
  jobTitle,
  businessDraft,
  onBusinessChange,
  onBusinessSave,
  phone,
  email,
  linkedIn,
  prospectHref,
  onOpenProfile,
  tags,
  tagCatalog = [],
  tagsSaving = false,
  canEditTags = false,
  onTagsChange,
  onEmail,
}: Props) {
  const telHref = phoneToTelHref(phone);
  const linkedInHref = linkedIn?.trim() || null;
  const title = jobTitle?.trim() || null;

  return (
    <div className="flex items-start gap-3">
      {onOpenProfile ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-label={`Open ${displayName} profile`}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        {onOpenProfile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="group flex max-w-full items-center gap-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={`Open ${displayName} profile`}
          >
            <span className="truncate text-lg font-semibold leading-none tracking-tight text-slate-900 group-hover:text-sky-800">
              {displayName}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sky-700"
              aria-hidden
            />
          </button>
        ) : (
          <h3 className="truncate text-lg font-semibold leading-none tracking-tight text-slate-900">
            {displayName}
          </h3>
        )}
        <input
          value={businessDraft}
          onChange={(e) => onBusinessChange(e.target.value)}
          onBlur={onBusinessSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Add business name"
          aria-label="Business name"
          title="Edit business name"
          className="mt-px w-full border-0 border-b border-transparent bg-transparent px-0 py-0 text-sm leading-snug text-slate-600 outline-none placeholder:text-slate-400 hover:border-slate-300 hover:text-slate-800 focus:border-sky-500 focus:text-slate-900"
        />
        {title ? (
          <p className="truncate text-xs leading-snug text-slate-500">{title}</p>
        ) : null}

        <div className="mt-2 flex items-center gap-1.5">
          <ActionButton
            label={telHref ? "Call" : "Add a phone number"}
            href={telHref}
            disabled={!telHref}
          >
            <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </ActionButton>
          <ActionButton
            label={email ? "Email" : "Add an email"}
            disabled={!email}
            onClick={onEmail}
          >
            <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </ActionButton>
          <ActionButton
            label={linkedInHref ? "LinkedIn profile" : "Add a LinkedIn URL"}
            href={linkedInHref}
            external
            disabled={!linkedInHref}
          >
            <LinkedInSolidIcon className="h-3.5 w-3.5" />
          </ActionButton>
        </div>

        <div className="mt-2">
          <ProspectHeaderTags
            tags={tags}
            catalog={tagCatalog}
            saving={tagsSaving}
            disabled={!canEditTags}
            onChange={onTagsChange}
          />
        </div>

        {prospectHref && !onOpenProfile ? (
          <a
            href={prospectHref}
            className="mt-1.5 inline-block text-xs font-medium text-sky-700 hover:text-sky-800"
          >
            View prospect →
          </a>
        ) : null}
      </div>
    </div>
  );
}
