"use client";

import type { ReactNode } from "react";
import { WhatsAppGlyph } from "@/components/icons/WhatsAppGlyph";
import { formatPhoneDisplay, phoneToTelHref } from "@/lib/formatPhoneDisplay";
import { ProspectEmptyValue } from "@/components/prospects/ProspectEmptyValue";

type Props = {
  phone?: string | null;
  email?: string | null;
  hasWhatsApp?: boolean;
  empty?: ReactNode;
};

export function ContactInfoCell({
  phone,
  email,
  hasWhatsApp = false,
  empty,
}: Props) {
  const phoneValue = phone?.trim() || null;
  const emailValue = email?.trim() || null;
  if (!phoneValue && !emailValue) {
    return empty ?? <ProspectEmptyValue />;
  }

  const formattedPhone = phoneValue
    ? formatPhoneDisplay(phoneValue) ?? phoneValue
    : null;
  const telHref = phoneValue ? phoneToTelHref(phoneValue) : null;

  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5">
      {phoneValue ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {telHref ? (
            <a
              href={telHref}
              data-row-action
              className="min-w-0 truncate text-sm tabular-nums text-slate-800 hover:text-sky-700 hover:underline"
              title={`Call ${formattedPhone}`}
              onClick={(e) => e.stopPropagation()}
            >
              {formattedPhone}
            </a>
          ) : (
            <span className="min-w-0 truncate text-sm tabular-nums text-slate-800">
              {formattedPhone}
            </span>
          )}
          {hasWhatsApp ? (
            <span title="WhatsApp available" className="inline-flex shrink-0">
              <WhatsAppGlyph className="h-3.5 w-3.5" />
              <span className="sr-only">WhatsApp available</span>
            </span>
          ) : null}
        </span>
      ) : null}
      {emailValue ? (
        <a
          href={`mailto:${emailValue}`}
          data-row-action
          className={`min-w-0 truncate hover:text-sky-700 hover:underline ${
            phoneValue
              ? "text-xs leading-snug text-slate-500"
              : "text-sm text-slate-800"
          }`}
          title={emailValue}
          onClick={(e) => e.stopPropagation()}
        >
          {emailValue}
        </a>
      ) : null}
    </div>
  );
}
