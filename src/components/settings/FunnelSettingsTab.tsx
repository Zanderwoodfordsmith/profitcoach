"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";
import {
  CALENDAR_SYNC_TONE_SHELL,
} from "@/components/ghl/CalendarSyncStatusNote";
import {
  OutlinedTextArea,
  OutlinedTextField,
} from "@/components/settings/OutlinedFormField";
import {
  PersonalisedLinkModal,
  type PersonalisedLinkProduct,
} from "@/components/settings/PersonalisedLinkModal";
import {
  normalizeCrmLocationId,
  type CalendarSyncStatus,
} from "@/lib/ghlCalendarSync";
import { buildEmbedSnippet } from "@/lib/embedMode";
import { ProspectsLandingStats } from "@/components/prospects/ProspectsLandingStats";
import { ShareQrCodeModal } from "@/components/settings/ShareQrCodeModal";

const CRM_APP_BASE_URL = "https://app.procoachplatform.com/";
const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";
const PUBLIC_SHARE_HOST = "theprofitcoach.com";

function shareDisplayUrl(path: string, appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${origin}${path}`;
  }
  return `${PUBLIC_SHARE_HOST}${path}`;
}

function shareCopyUrl(path: string, appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return `${origin}${path}`;
  }
  return `https://${PUBLIC_SHARE_HOST}${path}`;
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
  copied,
  onCopy,
  onPersonalise,
  onQrCode,
  showShareUrl = true,
}: {
  label: string;
  href: string;
  displayUrl?: string;
  copied?: boolean;
  onCopy?: () => void;
  onPersonalise?: () => void;
  onQrCode?: () => void;
  /** When false, only Open (and Personalise if provided) — no public URL or Copy. */
  showShareUrl?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {showShareUrl && displayUrl ? (
          <code className="mt-1 block truncate text-sm text-slate-800">
            {displayUrl}
          </code>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {onPersonalise ? (
          <button
            type="button"
            onClick={onPersonalise}
            className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
          >
            Personalise
          </button>
        ) : null}
        {showShareUrl && onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        ) : null}
        {showShareUrl && onQrCode ? (
          <button
            type="button"
            onClick={onQrCode}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            QR code
          </button>
        ) : null}
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Preview
        </Link>
      </div>
    </div>
  );
}

function FunnelProductPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmbedSnippetBlock({
  label,
  hint,
  code,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function crmStatusBadge(status: CalendarSyncStatus): {
  label: string;
  className: string;
} {
  if (status.ready) {
    return {
      label: "Ready",
      className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    };
  }
  if (status.tone === "warning") {
    return {
      label: "Finish setup",
      className: "bg-amber-100 text-amber-900 ring-amber-200",
    };
  }
  return {
    label: "Not set up",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
}

function ExpandableSetupTutorial({
  duration,
  collapsedTitle,
  collapsedDescription,
  expandedTitle,
  src,
}: {
  duration: string;
  collapsedTitle: string;
  collapsedDescription: string;
  expandedTitle: string;
  src: string;
}) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function openAndPlay() {
    setOpen(true);
    window.requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  }

  function closeVideo() {
    videoRef.current?.pause();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openAndPlay}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 text-left shadow-sm transition hover:border-sky-200 hover:bg-white"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm"
          aria-hidden
        >
          <Play className="h-5 w-5 fill-current" strokeWidth={0} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {collapsedTitle}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {duration}
            </span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
            {collapsedDescription}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{expandedTitle}</p>
          <p className="text-xs text-slate-500">{duration}</p>
        </div>
        <button
          type="button"
          onClick={closeVideo}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          Hide
        </button>
      </div>
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-lg border border-slate-200 bg-slate-900"
        controls
        playsInline
        preload="metadata"
        src={src}
      >
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function CrmSetupTutorial() {
  return (
    <ExpandableSetupTutorial
      duration="3 min"
      collapsedTitle="Watch setup walkthrough"
      collapsedDescription="Pro Coach Platform location, calendar embed, and lead webhook."
      expandedTitle="Setup walkthrough"
      src="/tutorials/setup-crm-and-calendar.mp4"
    />
  );
}

function LinksSetupTutorial() {
  return (
    <ExpandableSetupTutorial
      duration="3 min"
      collapsedTitle="Watch links walkthrough"
      collapsedDescription="Your slug, Boss Score opt-in vs scorecard, Boss Pro, and personalised links."
      expandedTitle="Boss & links walkthrough"
      src="/tutorials/start-using-boss-and-links.mp4"
    />
  );
}

function CollapsibleCrmSection({
  status,
  children,
}: {
  status: CalendarSyncStatus;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(() => !status.ready);
  const badge = crmStatusBadge(status);
  const shellClass = CALENDAR_SYNC_TONE_SHELL[status.tone];

  useEffect(() => {
    setExpanded(!status.ready);
  }, [status.ready]);

  return (
    <section
      className={`overflow-hidden rounded-xl border shadow-sm ${shellClass}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:brightness-[0.98]"
      >
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-600 transition-transform ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Calendar & CRM
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          {!expanded && !status.ready ? (
            <p className="mt-1 truncate text-sm text-slate-600">{status.message}</p>
          ) : expanded ? (
            <p className="mt-1 text-sm text-slate-600">
              Link your Pro Coach Platform location and booking calendar so
              prospects can schedule from scorecard results.
            </p>
          ) : null}
        </div>
      </button>
      {expanded ? (
        <div className="space-y-6 border-t border-black/5 px-5 pb-6 pt-5 max-w-2xl">
          <CrmSetupTutorial />
          {children}
        </div>
      ) : null}
    </section>
  );
}

function proCoachPlatformHref(crmLocationId: string): string {
  const locationId = normalizeCrmLocationId(crmLocationId);
  if (locationId) {
    return `${CRM_LOCATION_BASE_URL}/${encodeURIComponent(locationId)}`;
  }
  return CRM_APP_BASE_URL;
}

function CrmLeadCaptureFields({
  crmProfileName,
  onCrmProfileNameChange,
  crmLocationId,
  onCrmLocationIdChange,
  calendarEmbedCode,
  onCalendarEmbedCodeChange,
  leadWebhookUrl,
  onLeadWebhookUrlChange,
}: {
  crmProfileName: string;
  onCrmProfileNameChange: (value: string) => void;
  crmLocationId: string;
  onCrmLocationIdChange: (value: string) => void;
  calendarEmbedCode: string;
  onCalendarEmbedCodeChange: (value: string) => void;
  leadWebhookUrl: string;
  onLeadWebhookUrlChange: (value: string) => void;
}) {
  const platformHref = proCoachPlatformHref(crmLocationId);

  return (
    <>
      <p className="text-sm">
        <a
          href={platformHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          Open Pro Coach Platform
          <span aria-hidden> →</span>
        </a>
      </p>

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
          Required for a ready setup. We POST when we capture an email and again
          with the score.
        </FieldHint>
      </div>
    </>
  );
}

export type FunnelSettingsTabProps = {
  appOrigin: string;
  prospectsHref?: string;
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
  impersonatingCoachId?: string | null;
  saving: boolean;
  saveMessage: "success" | "error" | null;
  saveError: string | null;
  onSubmit: (e: FormEvent) => void;
};

export function FunnelSettingsTab({
  appOrigin,
  prospectsHref = "/coach/prospects",
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
  impersonatingCoachId,
  saving,
  saveMessage,
  saveError,
  onSubmit,
}: FunnelSettingsTabProps) {
  const slugReady = coachSlug.trim().length > 0;
  const slug = coachSlug.trim();
  const scorePath = slugReady ? `/score/${slug}` : "/score/your-slug";
  const assessmentPath = slugReady ? `/assessment/${slug}` : "/assessment/your-slug";
  const assessmentProPath = slugReady
    ? `/assessment-pro/${slug}`
    : "/assessment-pro/your-slug";
  const optInEmbedCode = buildEmbedSnippet(
    `${shareCopyUrl(scorePath, appOrigin)}?embed=1`,
    "Boss Score",
    "boss-score-optin",
    1400
  );
  const assessmentEmbedCode = buildEmbedSnippet(
    `${shareCopyUrl(assessmentPath, appOrigin)}?embed=1`,
    "Boss Score assessment",
    "boss-score-assessment",
    900
  );
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [personaliseProduct, setPersonaliseProduct] =
    useState<PersonalisedLinkProduct | null>(null);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);

  async function copyShareLink(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkKey(key);
      window.setTimeout(() => setCopiedLinkKey(null), 2000);
    } catch {
      // ignore — coach can select from display URL
    }
  }

  function openPersonaliseModal(product: PersonalisedLinkProduct) {
    setPersonaliseProduct(product);
  }

  function closePersonaliseModal() {
    setPersonaliseProduct(null);
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <ProspectsLandingStats
        coachSlug={slug || null}
        impersonatingCoachId={impersonatingCoachId ?? null}
      />

      <CollapsibleCrmSection status={calendarSyncStatus}>
        <CrmLeadCaptureFields
          crmProfileName={crmProfileName}
          onCrmProfileNameChange={onCrmProfileNameChange}
          crmLocationId={crmLocationId}
          onCrmLocationIdChange={onCrmLocationIdChange}
          calendarEmbedCode={calendarEmbedCode}
          onCalendarEmbedCodeChange={onCalendarEmbedCodeChange}
          leadWebhookUrl={leadWebhookUrl}
          onLeadWebhookUrlChange={onLeadWebhookUrlChange}
        />
      </CollapsibleCrmSection>

      <SectionCard
        title="Your links"
        description="Set your public slug, then copy or share your Boss Score or Boss Pro links."
      >
        <LinksSetupTutorial />
        <div>
          <label
            htmlFor="coach_slug"
            className="block text-sm font-medium text-slate-700"
          >
            Public URL slug
          </label>
          <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
            <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
              {PUBLIC_SHARE_HOST}/
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
            Lowercase letters, numbers, and hyphens only. Used in all share links
            below (e.g.{" "}
            <span className="font-mono text-[11px] text-slate-700">
              {shareDisplayUrl(scorePath, appOrigin)}
            </span>
            ).
          </FieldHint>
        </div>

        {!slugReady ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add a slug above to preview and share your links.
          </p>
        ) : (
          <div className="space-y-6 border-t border-slate-100 pt-6">
            <FunnelProductPanel
              title="Boss Score"
              description="Your lead-generation funnel — short scorecard with a landing page to capture opt-ins before the assessment."
            >
              <OutlinedTextField
                id="landing_eyebrow"
                label="Hero eyebrow"
                value={landingEyebrow}
                onChange={(e) => onLandingEyebrowChange(e.target.value)}
                placeholder="e.g. For engineering founders, £500K–£5M"
                wrapperClassName="w-full"
              />
              <div className="space-y-2">
                <LinkPreviewRow
                  label="Opt-in landing"
                  displayUrl={shareDisplayUrl(scorePath, appOrigin)}
                  href={scorePath}
                  copied={copiedLinkKey === "boss-score"}
                  onCopy={() =>
                    void copyShareLink(
                      "boss-score",
                      shareCopyUrl(scorePath, appOrigin)
                    )
                  }
                  onQrCode={() => setQrCodeOpen(true)}
                />
                <LinkPreviewRow
                  label="Scorecard"
                  href={assessmentPath}
                  showShareUrl={false}
                  onPersonalise={() => openPersonaliseModal("boss-score")}
                />
              </div>
              <div className="space-y-2 border-t border-slate-200/70 pt-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Embed on your own site
                  </p>
                  <FieldHint>
                    Paste a snippet into your website to host the Boss Score in
                    an iframe. It auto-resizes to fit — no scrollbars. Leads and
                    bookings still flow through your funnel as normal.
                  </FieldHint>
                </div>
                <EmbedSnippetBlock
                  label="Full funnel (opt-in → assessment)"
                  hint="Starts with the opt-in landing page."
                  code={optInEmbedCode}
                  copied={copiedLinkKey === "boss-score-embed-optin"}
                  onCopy={() =>
                    void copyShareLink("boss-score-embed-optin", optInEmbedCode)
                  }
                />
                <EmbedSnippetBlock
                  label="Assessment only"
                  hint="Skips the opt-in and goes straight to the scorecard."
                  code={assessmentEmbedCode}
                  copied={copiedLinkKey === "boss-score-embed-assessment"}
                  onCopy={() =>
                    void copyShareLink(
                      "boss-score-embed-assessment",
                      assessmentEmbedCode
                    )
                  }
                />
              </div>
            </FunnelProductPanel>

            <FunnelProductPanel
              title="Boss Pro"
              description="Full diagnostic — 50 questions across all playbooks."
            >
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <p className="font-medium">No shareable Boss Pro link here</p>
                <p className="mt-1 leading-relaxed text-rose-800">
                  Boss Pro has no landing page, so there is not a single URL to
                  copy on this page. Use{" "}
                  <span className="font-medium">Personalise</span> below to
                  generate a link for someone specific, or open{" "}
                  <Link
                    href={prospectsHref}
                    className="font-medium text-rose-900 underline hover:text-rose-950"
                  >
                    Prospects
                  </Link>{" "}
                  and click <span className="font-medium">Get link</span> in the
                  Boss Pro column.
                </p>
              </div>
              <LinkPreviewRow
                label="Assessment"
                href={assessmentProPath}
                showShareUrl={false}
                onPersonalise={() => openPersonaliseModal("boss-pro")}
              />
            </FunnelProductPanel>
          </div>
        )}
      </SectionCard>

      <PersonalisedLinkModal
        open={personaliseProduct != null}
        product={personaliseProduct}
        coachSlug={coachSlug}
        appOrigin={appOrigin}
        impersonatingCoachId={impersonatingCoachId}
        onClose={closePersonaliseModal}
      />

      <ShareQrCodeModal
        open={qrCodeOpen}
        title="Boss Score QR code"
        description="Scan to open your opt-in landing page. Download to print on slides, business cards, or event materials."
        url={shareCopyUrl(scorePath, appOrigin)}
        displayUrl={shareDisplayUrl(scorePath, appOrigin)}
        filenameStem={`boss-score-qr-${slug}`}
        onClose={() => setQrCodeOpen(false)}
      />

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
