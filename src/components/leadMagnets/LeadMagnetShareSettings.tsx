"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Info } from "lucide-react";
import { OutlinedTextField } from "@/components/settings/OutlinedFormField";
import {
  PersonalisedLinkModal,
  type PersonalisedLinkProduct,
} from "@/components/settings/PersonalisedLinkModal";
import { ShareQrCodeModal } from "@/components/settings/ShareQrCodeModal";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { buildEmbedSnippet } from "@/lib/embedMode";
import {
  magnetShareCopyUrl,
  magnetShareDisplayUrl,
  type LeadMagnetId,
} from "@/lib/leadMagnets/catalog";

const CRM_BOSS_SCORE_MASS_SEND_URL =
  "https://www.theprofitcoach.com/assessment/{{ custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}";

const CRM_BOSS_PRO_MASS_SEND_URL =
  "https://www.theprofitcoach.com/assessment-pro/{{ custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}";

type Props = {
  magnetId: LeadMagnetId;
  coachSlug: string | null;
  appOrigin: string;
  impersonatingCoachId?: string | null;
  prospectsHref: string;
};

export function LeadMagnetShareSettings({
  magnetId,
  coachSlug,
  appOrigin,
  impersonatingCoachId,
  prospectsHref,
}: Props) {
  const slug = coachSlug?.trim() || "";
  const slugReady = slug.length > 0;
  const [landingEyebrow, setLandingEyebrow] = useState("");
  const [eyebrowSaving, setEyebrowSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [personaliseProduct, setPersonaliseProduct] =
    useState<PersonalisedLinkProduct | null>(null);
  const [qrOpen, setQrCodeOpen] = useState(false);

  useEffect(() => {
    if (magnetId !== "boss-score") return;
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/profile", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        landing_copy_overrides?: { eyebrow?: string } | null;
      };
      if (!cancelled && res.ok) {
        setLandingEyebrow(body.landing_copy_overrides?.eyebrow ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [magnetId]);

  async function copy(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  }

  async function saveEyebrow() {
    const headers = await getCoachAuthHeaders();
    if (!headers) return;
    setEyebrowSaving(true);
    await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        landing_copy_overrides: landingEyebrow.trim()
          ? { eyebrow: landingEyebrow.trim() }
          : {},
      }),
    });
    setEyebrowSaving(false);
  }

  const scorePath = slugReady ? `/score/${slug}` : "/score/your-slug";
  const assessmentPath = slugReady
    ? `/assessment/${slug}`
    : "/assessment/your-slug";
  const assessmentProPath = slugReady
    ? `/assessment-pro/${slug}`
    : "/assessment-pro/your-slug";

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm shadow-slate-200/40">
      <div>
        <p className="text-sm font-semibold text-slate-900">Share</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {magnetId === "boss-score"
            ? "Landing page, scorecard-only link, and embeds."
            : "Personalised diagnostic link."}
        </p>
      </div>

      {!slugReady ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Set your public URL on the Lead magnets tab so these links work.
        </p>
      ) : null}

      {magnetId === "boss-score" ? (
        <>
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Landing page
            </p>
            <div className="mt-3">
              <OutlinedTextField
                id="landing_eyebrow"
                label="Audience line"
                value={landingEyebrow}
                onChange={(e) => setLandingEyebrow(e.target.value)}
                placeholder="e.g. For engineering founders, £500K–£5M"
                wrapperClassName="w-full"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Small text above your headline — who the scorecard is for.
              </p>
              <button
                type="button"
                disabled={eyebrowSaving || !slugReady}
                onClick={() => void saveEyebrow()}
                className="mt-2 text-sm font-medium text-[#0c5290] hover:underline disabled:opacity-50"
              >
                {eyebrowSaving ? "Saving…" : "Save audience line"}
              </button>
            </div>
          </div>

          <LinkRow
            primary
            title="Landing page"
            subtitle="Full funnel — opt-in, then scorecard. Best link to share widely."
            displayUrl={magnetShareDisplayUrl(scorePath, appOrigin)}
            href={scorePath}
            copied={copiedKey === "landing"}
            onCopy={
              slugReady
                ? () =>
                    void copy(
                      "landing",
                      magnetShareCopyUrl(scorePath, appOrigin)
                    )
                : undefined
            }
            onQrCode={slugReady ? () => setQrCodeOpen(true) : undefined}
          />
          <LinkRow
            title="Scorecard only"
            subtitle="Skips the landing page. Personalise before sharing."
            displayUrl={magnetShareDisplayUrl(assessmentPath, appOrigin)}
            href={assessmentPath}
            copied={copiedKey === "assessment"}
            onCopy={
              slugReady
                ? () =>
                    void copy(
                      "assessment",
                      magnetShareCopyUrl(assessmentPath, appOrigin)
                    )
                : undefined
            }
            onPersonalise={
              slugReady ? () => setPersonaliseProduct("boss-score") : undefined
            }
          />

          <MassSendLink
            templateUrl={CRM_BOSS_SCORE_MASS_SEND_URL}
            copied={copiedKey === "mass"}
            onCopy={() => void copy("mass", CRM_BOSS_SCORE_MASS_SEND_URL)}
          />

          <EmbedSection>
            <EmbedBlock
              label="Full funnel embed"
              hint="Starts with the opt-in landing page."
              code={buildEmbedSnippet(
                `${magnetShareCopyUrl(scorePath, appOrigin)}?embed=1`,
                "Boss Score",
                "boss-score-optin",
                1400
              )}
              copied={copiedKey === "embed-optin"}
              onCopy={(code) => void copy("embed-optin", code)}
            />
            <EmbedBlock
              label="Scorecard-only embed"
              hint="Skips the opt-in and goes straight to the scorecard."
              code={buildEmbedSnippet(
                `${magnetShareCopyUrl(assessmentPath, appOrigin)}?embed=1`,
                "Boss Score assessment",
                "boss-score-assessment",
                900
              )}
              copied={copiedKey === "embed-assessment"}
              onCopy={(code) => void copy("embed-assessment", code)}
            />
          </EmbedSection>
        </>
      ) : (
        <>
          <LinkRow
            title="Assessment"
            subtitle={
              <>
                Use <span className="font-medium">Personalise</span> for a named
                prospect, or{" "}
                <Link
                  href={prospectsHref}
                  className="font-medium text-sky-700 hover:underline"
                >
                  Prospects → Get link
                </Link>
                .
              </>
            }
            displayUrl={magnetShareDisplayUrl(assessmentProPath, appOrigin)}
            href={assessmentProPath}
            copied={copiedKey === "pro"}
            onCopy={
              slugReady
                ? () =>
                    void copy(
                      "pro",
                      magnetShareCopyUrl(assessmentProPath, appOrigin)
                    )
                : undefined
            }
            onPersonalise={
              slugReady ? () => setPersonaliseProduct("boss-pro") : undefined
            }
          />
          <MassSendLink
            templateUrl={CRM_BOSS_PRO_MASS_SEND_URL}
            copied={copiedKey === "mass"}
            onCopy={() => void copy("mass", CRM_BOSS_PRO_MASS_SEND_URL)}
          />
        </>
      )}

      <PersonalisedLinkModal
        open={personaliseProduct != null}
        product={personaliseProduct}
        coachSlug={slug}
        appOrigin={appOrigin}
        impersonatingCoachId={impersonatingCoachId}
        onClose={() => setPersonaliseProduct(null)}
      />
      <ShareQrCodeModal
        open={qrOpen}
        title="Boss Score QR code"
        description="Scan to open your opt-in landing page. Download to print on slides, business cards, or event materials."
        url={magnetShareCopyUrl(scorePath, appOrigin)}
        displayUrl={magnetShareDisplayUrl(scorePath, appOrigin)}
        filenameStem={`boss-score-qr-${slug || "slug"}`}
        onClose={() => setQrCodeOpen(false)}
      />
    </section>
  );
}

function LinkRow({
  title,
  subtitle,
  href,
  displayUrl,
  copied,
  onCopy,
  onPersonalise,
  onQrCode,
  primary = false,
}: {
  title: string;
  subtitle?: ReactNode;
  href: string;
  displayUrl: string;
  copied?: boolean;
  onCopy?: () => void;
  onPersonalise?: () => void;
  onQrCode?: () => void;
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
          <code className="mt-2 block truncate rounded bg-white/80 px-2 py-1 text-xs text-slate-700">
            {displayUrl}
          </code>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {onPersonalise ? (
            <button
              type="button"
              onClick={onPersonalise}
              className="font-medium text-sky-700 hover:underline"
            >
              Personalise
            </button>
          ) : null}
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          ) : null}
          {onQrCode ? (
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

function MassSendLink({
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
        className="flex w-full items-start gap-2 text-left"
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
            <span className="mt-0.5 block text-xs text-slate-500">
              Send to a list in the CRM — each contact is personalised
              automatically.
            </span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-2 pl-6">
          <p className="text-xs leading-relaxed text-slate-500">
            Paste into campaigns, emails, or SMS. Set your{" "}
            <code className="font-mono text-[11px]">coach_url_slug</code>{" "}
            custom value to your public slug.
          </p>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">CRM link</p>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
              <code>{templateUrl}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmbedSection({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-sm font-medium text-slate-700"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
          aria-hidden
        />
        Embed on your website
      </button>
      {expanded ? <div className="mt-3 space-y-3 pl-6">{children}</div> : null}
    </div>
  );
}

function EmbedBlock({
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
  onCopy: (code: string) => void;
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
          onClick={() => onCopy(code)}
          className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
        >
          {copied ? "Copied!" : "Copy code"}
        </button>
      </div>
      <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
