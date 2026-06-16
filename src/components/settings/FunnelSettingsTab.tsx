"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Info, Play } from "lucide-react";
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

const CRM_BOSS_SCORE_MASS_SEND_URL =
  "https://www.theprofitcoach.com/assessment/{{ custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}";

const CRM_BOSS_PRO_MASS_SEND_URL =
  "https://www.theprofitcoach.com/assessment-pro/{{ custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}";

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
  accent,
  headerAside,
  children,
}: {
  title: string;
  description?: string;
  /** Subtle top accent bar for product cards */
  accent?: "sky" | "slate";
  /** Compact control aligned to the right of the title block (e.g. slug field). */
  headerAside?: ReactNode;
  children?: ReactNode;
}) {
  const accentClass =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-500 to-sky-400"
      : accent === "slate"
        ? "bg-gradient-to-r from-slate-400 to-slate-300"
        : null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {accentClass ? <div className={`h-1 ${accentClass}`} aria-hidden /> : null}
      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
          {headerAside ? (
            <div className="w-full shrink-0 sm:w-80">{headerAside}</div>
          ) : null}
        </div>
        {children ? (
          <div className="mt-4 space-y-4">{children}</div>
        ) : null}
      </div>
    </section>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{children}</p>;
}

function LinkPreviewRow({
  title,
  subtitle,
  href,
  displayUrl,
  copied,
  onCopy,
  onPersonalise,
  onQrCode,
  showShareUrl = true,
  primary = false,
}: {
  title: string;
  subtitle?: ReactNode;
  href: string;
  displayUrl?: string;
  copied?: boolean;
  onCopy?: () => void;
  onPersonalise?: () => void;
  onQrCode?: () => void;
  showShareUrl?: boolean;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3.5 ${
        primary
          ? "border-sky-200 bg-sky-50/60 ring-1 ring-sky-100"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{title}</p>
            {primary ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Main link
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {subtitle}
            </p>
          ) : null}
          {showShareUrl && displayUrl ? (
            <code
              className={`mt-2 block truncate rounded px-2 py-1 text-xs ${
                primary
                  ? "bg-white/80 text-slate-700"
                  : "bg-white/60 text-slate-600"
              }`}
            >
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
    </div>
  );
}

function CollapsibleCrmMassSendLink({
  templateUrl,
  copied,
  onCopy,
}: {
  templateUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2 text-left transition hover:opacity-90"
      >
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            <span className="text-sm font-medium text-slate-700">
              Mass send from Pro Coach Platform
            </span>
          </span>
          {!expanded ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
              Send to a list in the CRM — each contact is personalised
              automatically.
            </span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3 pl-6">
          <FieldHint>
            Paste this link into campaigns, emails, or SMS in Pro Coach Platform.
            Merge fields pull each contact&apos;s name, email, and business from
            their record, so you can message a list without creating links one by
            one. Set your{" "}
            <code className="font-mono text-[11px]">coach_url_slug</code> custom
            value to your public slug above.
          </FieldHint>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">CRM link</p>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
              <code>{templateUrl}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleEmbedSection({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700 transition hover:text-slate-900"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
          aria-hidden
        />
        Embed on your website
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3 pl-6">
          <FieldHint>
            Paste a snippet into your site to host the Boss Score in an iframe.
            Leads and bookings still flow through your funnel as normal.
          </FieldHint>
          {children}
        </div>
      ) : null}
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
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
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

function SidebarVideoCard({
  title,
  description,
  duration,
  src,
}: {
  title: string;
  description: string;
  duration: string;
  src: string;
}) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function startPlayback() {
    setPlaying(true);
    window.requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {playing ? (
        <video
          ref={videoRef}
          className="aspect-video w-full bg-slate-900"
          controls
          playsInline
          preload="metadata"
          src={src}
        >
          Your browser does not support video playback.
        </video>
      ) : (
        <button
          type="button"
          onClick={startPlayback}
          className="group relative block aspect-video w-full bg-slate-900"
        >
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-sky-700 shadow-md transition group-hover:scale-105">
              <Play className="h-5 w-5 fill-current" strokeWidth={0} />
            </span>
          </span>
        </button>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <span className="shrink-0 text-xs text-slate-400">{duration}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function FunnelSettingsSidebar() {
  return (
    <aside className="w-full min-w-0 lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
      <div className="flex flex-col gap-4">
        <SidebarVideoCard
          title="Your links"
          description="Slug, Boss Score landing vs scorecard, Boss Pro, and personalised links."
          duration="3 min"
          src="/tutorials/start-using-boss-and-links.mp4"
        />
        <SidebarVideoCard
          title="Calendar & CRM"
          description="Pro Coach Platform location, calendar embed, and lead webhook."
          duration="3 min"
          src="/tutorials/setup-crm-and-calendar.mp4"
        />
      </div>
    </aside>
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
        <div className="space-y-6 border-t border-black/5 px-5 pb-6 pt-5">
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
    <form onSubmit={onSubmit} className="flex w-full min-w-0 flex-col gap-6">
      <ProspectsLandingStats
        coachSlug={slug || null}
        impersonatingCoachId={impersonatingCoachId ?? null}
      />

      <div className="grid w-full min-w-0 gap-6 lg:grid-cols-3 lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
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
            title="Your public URL"
            description="This slug is yours across every share link — Boss Score, Boss Pro, and personalised URLs all build from it."
            headerAside={
              <div>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 pl-2 pr-1.5 text-xs text-slate-500 sm:text-sm">
                    {PUBLIC_SHARE_HOST}/
                  </span>
                  <input
                    id="coach_slug"
                    type="text"
                    value={coachSlug}
                    onChange={(e) =>
                      onCoachSlugChange(e.target.value.toLowerCase())
                    }
                    placeholder="your-name"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Public URL slug"
                    className="block min-w-0 flex-1 border-0 bg-transparent py-2 pl-2 pr-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <FieldHint>
                  Lowercase letters, numbers, and hyphens only.
                </FieldHint>
              </div>
            }
          >
            {!slugReady ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Add a slug to unlock Boss Score and Boss Pro links below.
              </p>
            ) : null}
          </SectionCard>

          {slugReady ? (
            <>
              <SectionCard
                accent="sky"
                title="Boss Score"
                description="Lead-generation funnel with a landing page and short scorecard."
              >
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Landing page
                  </p>
                  <div className="mt-3">
                    <OutlinedTextField
                      id="landing_eyebrow"
                      label="Audience line"
                      value={landingEyebrow}
                      onChange={(e) => onLandingEyebrowChange(e.target.value)}
                      placeholder="e.g. For engineering founders, £500K–£5M"
                      wrapperClassName="w-full"
                    />
                    <FieldHint>
                      Small text above your headline — who the scorecard is for.
                    </FieldHint>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Share links
                  </p>
                  <div className="grid gap-3 lg:grid-cols-1">
                    <LinkPreviewRow
                      primary
                      title="Landing page"
                      subtitle="Full funnel — opt-in, then scorecard. Best link to share widely."
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
                      title="Scorecard only"
                      subtitle="Skips the landing page. Personalise before sharing."
                      displayUrl={shareDisplayUrl(assessmentPath, appOrigin)}
                      href={assessmentPath}
                      copied={copiedLinkKey === "boss-score-assessment"}
                      onCopy={() =>
                        void copyShareLink(
                          "boss-score-assessment",
                          shareCopyUrl(assessmentPath, appOrigin)
                        )
                      }
                      onPersonalise={() => openPersonaliseModal("boss-score")}
                    />
                  </div>
                </div>

                <CollapsibleCrmMassSendLink
                  templateUrl={CRM_BOSS_SCORE_MASS_SEND_URL}
                  copied={copiedLinkKey === "crm-boss-score-mass"}
                  onCopy={() =>
                    void copyShareLink(
                      "crm-boss-score-mass",
                      CRM_BOSS_SCORE_MASS_SEND_URL
                    )
                  }
                />

                <CollapsibleEmbedSection>
                  <EmbedSnippetBlock
                    label="Full funnel embed"
                    hint="Starts with the opt-in landing page."
                    code={optInEmbedCode}
                    copied={copiedLinkKey === "boss-score-embed-optin"}
                    onCopy={() =>
                      void copyShareLink("boss-score-embed-optin", optInEmbedCode)
                    }
                  />
                  <EmbedSnippetBlock
                    label="Scorecard-only embed"
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
                </CollapsibleEmbedSection>
              </SectionCard>

              <SectionCard
                accent="slate"
                title="Boss Pro"
                description="Full diagnostic — 50 questions across all playbooks. Links are personalised per prospect."
              >
                <LinkPreviewRow
                  title="Assessment"
                  subtitle={
                    <>
                      Use{" "}
                      <span className="font-medium">Personalise</span> for a
                      named prospect, or{" "}
                      <Link
                        href={prospectsHref}
                        className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Prospects → Get link
                      </Link>
                      .
                    </>
                  }
                  displayUrl={shareDisplayUrl(assessmentProPath, appOrigin)}
                  href={assessmentProPath}
                  copied={copiedLinkKey === "boss-pro-assessment"}
                  onCopy={() =>
                    void copyShareLink(
                      "boss-pro-assessment",
                      shareCopyUrl(assessmentProPath, appOrigin)
                    )
                  }
                  onPersonalise={() => openPersonaliseModal("boss-pro")}
                />

                <CollapsibleCrmMassSendLink
                  templateUrl={CRM_BOSS_PRO_MASS_SEND_URL}
                  copied={copiedLinkKey === "crm-boss-pro-mass"}
                  onCopy={() =>
                    void copyShareLink(
                      "crm-boss-pro-mass",
                      CRM_BOSS_PRO_MASS_SEND_URL
                    )
                  }
                />
              </SectionCard>
            </>
          ) : null}

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
        </div>

        <FunnelSettingsSidebar />
      </div>

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
    </form>
  );
}
