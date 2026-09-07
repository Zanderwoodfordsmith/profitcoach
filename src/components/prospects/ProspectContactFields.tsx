"use client";

import { ExternalLink } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/WhatsAppGlyph";
import { InlineEditableText } from "@/components/prospects/InlineEditableText";
import { formatPhoneDisplay } from "@/lib/formatPhoneDisplay";
import { normalizeProspectLabel } from "@/lib/prospectDisplayFormat";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import { canonicalLinkedInProfileUrl } from "@/lib/salesNavigator/linkedinUrl";

export type ProspectContactValues = {
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  business_name?: string | null;
  company_website?: string | null;
  linkedin_url?: string | null;
};

type Props = {
  values: ProspectContactValues;
  saving?: boolean;
  /** True when we've already messaged / synced this contact on WhatsApp. */
  whatsappKnown?: boolean;
  onSave: (patch: ProspectFieldPatch) => Promise<void> | void;
};

export function ProspectContactFields({
  values,
  saving = false,
  whatsappKnown = false,
  onSave,
}: Props) {
  const website = values.company_website?.trim() || null;
  const linkedIn = values.linkedin_url?.trim() || null;

  return (
    <div className="space-y-3">
      <InlineEditableText
        label="Email"
        value={values.email}
        placeholder="Add email"
        type="email"
        saving={saving}
        validate={(raw) => {
          const trimmed = raw.trim();
          if (!trimmed) return "Email is required.";
          if (!trimmed.includes("@")) return "Enter a valid email.";
          return null;
        }}
        normalize={(raw) => raw.trim().toLowerCase() || null}
        onSave={(next) => onSave({ email: next })}
      />
      <div>
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] text-slate-400">Phone</div>
          {whatsappKnown && values.phone?.trim() ? (
            <span
              className="inline-flex items-center"
              title="WhatsApp available"
            >
              <WhatsAppGlyph className="h-3 w-3" />
              <span className="sr-only">WhatsApp available</span>
            </span>
          ) : null}
        </div>
        <div className="mt-0.5">
          <InlineEditableText
            value={values.phone}
            placeholder="Add phone"
            type="tel"
            saving={saving}
            normalize={(raw) => raw.trim() || null}
            onSave={(next) => onSave({ phone: next })}
            display={(v) => formatPhoneDisplay(v)}
          />
        </div>
      </div>
      <InlineEditableText
        label="Title"
        value={values.job_title}
        placeholder="Add title"
        saving={saving}
        normalize={(raw) => normalizeProspectLabel(raw)}
        onSave={(next) => onSave({ job_title: next })}
      />
      <InlineEditableText
        label="Business"
        value={values.business_name}
        placeholder="Add business"
        saving={saving}
        normalize={(raw) => normalizeProspectLabel(raw)}
        onSave={(next) => onSave({ business_name: next })}
      />
      <div>
        <div className="text-[11px] text-slate-400">Website</div>
        <div className="mt-0.5 flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <InlineEditableText
              value={values.company_website}
              placeholder="Add website"
              type="url"
              saving={saving}
              normalize={(raw) => raw.trim() || null}
              onSave={(next) => onSave({ company_website: next })}
              display={(v) => (
                <span className="break-all text-sm text-slate-800">
                  {v.replace(/^https?:\/\/(www\.)?/i, "")}
                </span>
              )}
            />
          </div>
          {website ? (
            <a
              href={
                /^https?:\/\//i.test(website) ? website : `https://${website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              title="Open website"
              className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-sky-700"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-slate-400">LinkedIn</div>
        <div className="mt-0.5 flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <InlineEditableText
              value={values.linkedin_url}
              placeholder="Add LinkedIn URL"
              type="url"
              saving={saving}
              normalize={(raw) => raw.trim() || null}
              onSave={(next) => onSave({ linkedin_url: next })}
              display={(v) => (
                <span className="break-all text-sm text-slate-800">
                  {v.replace(/^https?:\/\/(www\.)?/i, "")}
                </span>
              )}
            />
          </div>
          {linkedIn ? (
            <a
              href={canonicalLinkedInProfileUrl(linkedIn) ?? linkedIn}
              target="_blank"
              rel="noreferrer"
              title="Open LinkedIn"
              className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-sky-700"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
