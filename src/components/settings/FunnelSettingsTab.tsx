"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { CalendarSyncStatusNote } from "@/components/ghl/CalendarSyncStatusNote";
import {
  OutlinedTextArea,
  OutlinedTextField,
} from "@/components/settings/OutlinedFormField";
import type { CalendarSyncStatus } from "@/lib/ghlCalendarSync";

const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";
const PUBLIC_SHARE_HOST = "theprofitcoach.com";

function publicShareUrl(path: string): string {
  return `${PUBLIC_SHARE_HOST}${path}`;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="mt-6 max-w-2xl space-y-6">{children}</div>
    </section>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{children}</p>;
}

function LinkPreviewRow({
  label,
  href,
  displayUrl,
}: {
  label: string;
  href: string;
  displayUrl: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <code className="mt-1 block truncate text-sm text-slate-800">
          {displayUrl}
        </code>
      </div>
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
      >
        Open
      </Link>
    </div>
  );
}

export type FunnelSettingsTabProps = {
  appOrigin: string;
  coachSlug: string;
  onCoachSlugChange: (value: string) => void;
  landingEyebrow: string;
  onLandingEyebrowChange: (value: string) => void;
  crmProfileName: string;
  onCrmProfileNameChange: (value: string) => void;
  crmLocationId: string;
  onCrmLocationIdChange: (value: string) => void;
  calendarEmbedCode: string;
  onCalendarEmbedCodeChange: (value: string) => void;
  leadWebhookUrl: string;
  onLeadWebhookUrlChange: (value: string) => void;
  calendarSyncStatus: CalendarSyncStatus;
  linkFirstName: string;
  onLinkFirstNameChange: (value: string) => void;
  linkLastName: string;
  onLinkLastNameChange: (value: string) => void;
  linkEmail: string;
  onLinkEmailChange: (value: string) => void;
  linkPhone: string;
  onLinkPhoneChange: (value: string) => void;
  assessmentLinkExample: string | null;
  generatedAssessmentLink: string | null;
  linkGenerateError: string | null;
  linkCopied: boolean;
  onGenerateAssessmentLink: () => void;
  onCopyAssessmentLink: () => void;
  saving: boolean;
  saveMessage: "success" | "error" | null;
  saveError: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function FunnelSettingsTab({
  appOrigin,
  coachSlug,
  onCoachSlugChange,
  landingEyebrow,
  onLandingEyebrowChange,
  crmProfileName,
  onCrmProfileNameChange,
  crmLocationId,
  onCrmLocationIdChange,
  calendarEmbedCode,
  onCalendarEmbedCodeChange,
  leadWebhookUrl,
  onLeadWebhookUrlChange,
  calendarSyncStatus,
  linkFirstName,
  onLinkFirstNameChange,
  linkLastName,
  onLinkLastNameChange,
  linkEmail,
  onLinkEmailChange,
  linkPhone,
  onLinkPhoneChange,
  assessmentLinkExample,
  generatedAssessmentLink,
  linkGenerateError,
  linkCopied,
  onGenerateAssessmentLink,
  onCopyAssessmentLink,
  saving,
  saveMessage,
  saveError,
  onSubmit,
}: FunnelSettingsTabProps) {
  const slugReady = coachSlug.trim().length > 0;
  const scorePath = slugReady ? `/score/${coachSlug.trim()}` : "/score/your-slug";
  const assessmentPath = slugReady
    ? `/assessment/${coachSlug.trim()}`
    : "/assessment/your-slug";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <SectionCard
        title="Your links"
        description="Set your public slug, share your BOSS score link, and build personalised assessment URLs."
      >
        <div>
          <label
            htmlFor="coach_slug"
            className="block text-sm font-medium text-slate-700"
          >
            URL slug
          </label>
          <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
            <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              {PUBLIC_SHARE_HOST}/score/
            </span>
            <input
              id="coach_slug"
              type="text"
              value={coachSlug}
              onChange={(e) => onCoachSlugChange(e.target.value.toLowerCase())}
              placeholder="your-name"
              autoComplete="off"
              spellCheck={false}
              className="block min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <FieldHint>
            Lowercase letters, numbers, and hyphens only. Your score link becomes{" "}
            <span className="font-mono text-[11px] text-slate-700">
              {publicShareUrl(scorePath)}
            </span>
            .
          </FieldHint>
        </div>

        <OutlinedTextField
          id="landing_eyebrow"
          label="Hero eyebrow"
          value={landingEyebrow}
          onChange={(e) => onLandingEyebrowChange(e.target.value)}
          placeholder="e.g. For engineering founders, £500K–£5M"
          wrapperClassName="w-full"
        />

        {slugReady ? (
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <LinkPreviewRow
              label="BOSS score link"
              displayUrl={publicShareUrl(scorePath)}
              href={scorePath}
            />
            <LinkPreviewRow
              label="Direct assessment"
              displayUrl={publicShareUrl(assessmentPath)}
              href={assessmentPath}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add a slug above to preview and share your links.
          </p>
        )}

        <div className="space-y-4 border-t border-slate-100 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Personalised assessment link
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Send a prospect straight into the assessment. Include their email
              and we create the contact when they open the link.
            </p>
            {assessmentLinkExample ? (
              <FieldHint>
                Example:{" "}
                <code className="break-all font-mono text-[11px] text-slate-700">
                  {assessmentLinkExample}
                </code>
              </FieldHint>
            ) : null}
          </div>

          {slugReady ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <OutlinedTextField
                  id="link_first_name"
                  label="First name"
                  value={linkFirstName}
                  onChange={(e) => onLinkFirstNameChange(e.target.value)}
                  placeholder="John"
                  wrapperClassName="w-full"
                />
                <OutlinedTextField
                  id="link_last_name"
                  label="Last name"
                  value={linkLastName}
                  onChange={(e) => onLinkLastNameChange(e.target.value)}
                  placeholder="Jones"
                  wrapperClassName="w-full"
                />
                <OutlinedTextField
                  id="link_email"
                  label="Email"
                  type="email"
                  value={linkEmail}
                  onChange={(e) => onLinkEmailChange(e.target.value)}
                  placeholder="john@example.com"
                  wrapperClassName="w-full sm:col-span-2"
                />
                <OutlinedTextField
                  id="link_phone"
                  label="Phone (optional)"
                  type="tel"
                  value={linkPhone}
                  onChange={(e) => onLinkPhoneChange(e.target.value)}
                  placeholder="+44 7700 900123"
                  wrapperClassName="w-full sm:col-span-2"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onGenerateAssessmentLink}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Generate link
                </button>
                {linkGenerateError ? (
                  <span className="text-sm text-rose-600">{linkGenerateError}</span>
                ) : null}
              </div>

              {generatedAssessmentLink ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                  <label
                    htmlFor="generated_assessment_link"
                    className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    Generated link
                  </label>
                  <textarea
                    id="generated_assessment_link"
                    readOnly
                    rows={3}
                    value={generatedAssessmentLink}
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm"
                  />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <button
                      type="button"
                      onClick={onCopyAssessmentLink}
                      className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
                    >
                      {linkCopied ? "Copied!" : "Copy link"}
                    </button>
                    <a
                      className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      href={generatedAssessmentLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Set your slug first to generate personalised links.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="CRM & lead capture"
        description="Connect your Pro Coach Platform location, show a booking calendar on results, and optionally forward leads to a webhook."
      >
        <OutlinedTextField
          id="crm_profile_name"
          label="CRM profile name"
          value={crmProfileName}
          onChange={(e) => onCrmProfileNameChange(e.target.value)}
          placeholder="AMF Consulting"
          wrapperClassName="w-full"
        />

        <div>
          <OutlinedTextField
            id="crm_location_id"
            label="CRM location ID"
            value={crmLocationId}
            onChange={(e) => onCrmLocationIdChange(e.target.value)}
            placeholder="BsRxKtV0lVHcvvZ6qHtu"
            wrapperClassName="w-full"
          />
          <FieldHint>
            Paste the location ID or full URL (
            <code className="font-mono text-[11px]">
              {CRM_LOCATION_BASE_URL}/&lt;location-id&gt;
            </code>
            ).
          </FieldHint>
        </div>

        <OutlinedTextArea
          id="calendar_embed_code"
          label="Booking calendar embed"
          rows={6}
          value={calendarEmbedCode}
          onChange={(e) => onCalendarEmbedCodeChange(e.target.value)}
          placeholder='<iframe src="https://..." …></iframe>'
          wrapperClassName="w-full"
        />
        <CalendarSyncStatusNote status={calendarSyncStatus} />

        <div>
          <OutlinedTextField
            id="lead_webhook_url"
            label="Lead webhook URL"
            type="url"
            value={leadWebhookUrl}
            onChange={(e) => onLeadWebhookUrlChange(e.target.value)}
            placeholder="https://hooks.example.com/coach-leads"
            wrapperClassName="w-full"
          />
          <FieldHint>
            Optional. We POST when we capture an email and again with the score.
            Leave blank to disable.
          </FieldHint>
        </div>
      </SectionCard>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save funnel settings"}
        </button>
        {saveMessage === "success" ? (
          <span className="text-sm text-green-700">Saved.</span>
        ) : null}
        {saveMessage === "error" && saveError ? (
          <span className="text-sm text-rose-600">{saveError}</span>
        ) : null}
      </div>
    </form>
  );
}
