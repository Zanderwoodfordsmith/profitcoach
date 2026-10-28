"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { GOOGLE_FONTS_HREF } from "@/lib/printPack/brand.js";
import { makeCoach } from "@/lib/printPack/coach.js";
import { GENERIC, PERSONAL, PLACEHOLDER_COACH } from "@/lib/printPack/catalog.js";
import {
  downloadPng,
  downloadSvg,
  imageUrlToDataUri,
  printPdf,
  svgForInline,
} from "@/lib/printPack/browserExport";
import type { ProgrammeBrochure } from "@/lib/practiceKnowledge/brochure";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
import { ProgrammeBrochureCard } from "./ProgrammeBrochure";
import { TOOLKIT_VIEWS, type ToolkitGraphicsView } from "./ToolkitTabs";

type ToolkitDetails = {
  name: string | null;
  first_name: string | null;
  business: string | null;
  avatar_url: string | null;
  coach_slug: string | null;
  brochure?: ProgrammeBrochure;
};

type CatalogItem = {
  id: string;
  title: string;
  size: string;
  png: number;
  print?: boolean;
  personalTwin?: boolean;
  section?: string;
  group?: string;
  render: (ctx: { coach?: unknown; eventName?: string }) => string;
};

/** What the print-pack drawing code needs to know about the coach. */
type PrintCoach = {
  name: string;
  business: string;
  displayUrl: string;
  qr: { viewBox: string; body: string } | null;
  avatarDataUri: string | null;
};

const GENERIC_ITEMS = (GENERIC as CatalogItem[]).filter((item) => !item.personalTwin);
const PERSONAL_ITEMS = PERSONAL as CatalogItem[];
const EVENT_ID = "p-banner-event";

/** Drive folder names carry a number for ordering; the Toolkit shows the plain name. */
const sectionLabel = (section: string) => {
  const plain = section.replace(/^\d+\.\s*/, "");
  // Your graphics already has a "Social media posts" group; the brand one holds the slide-size old vs new.
  return plain === "Social media posts" ? "Old vs new" : plain;
};
const cardTitle = (title: string) => title.replace(/^Post - /, "");

/** One Toolkit sub-tab: the brochure, one group of your graphics, or the brand graphics. */
export function ToolkitHub({ view }: { view: ToolkitGraphicsView }) {
  const pathname = usePathname() ?? "";
  const linksHref = pathname.startsWith("/admin") ? "/admin/share" : "/coach/share";
  const { impersonatingCoachId } = useImpersonation();
  const [details, setDetails] = useState<ToolkitDetails | null>(null);
  const [coach, setCoach] = useState<PrintCoach>(PLACEHOLDER_COACH as PrintCoach);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Profit Workshop");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const headers = await getCoachAuthHeaders(impersonatingCoachId);
        if (!headers) throw new Error("not signed in");
        const res = await fetch("/api/coach/toolkit", { headers });
        if (!res.ok) throw new Error("load failed");
        const body = (await res.json()) as ToolkitDetails;
        if (cancelled) return;
        setDetails(body);
        const avatarDataUri = await imageUrlToDataUri(body.avatar_url);
        const base = {
          name: body.name ?? PLACEHOLDER_COACH.name,
          business: body.business ?? "",
          avatarDataUri,
        };
        const next: PrintCoach = body.coach_slug
          ? ((await makeCoach({ ...base, slug: body.coach_slug }, { link: "score" })) as PrintCoach)
          : { ...PLACEHOLDER_COACH, ...base };
        if (!cancelled) setCoach(next);
      } catch {
        if (!cancelled) setLoadError("We couldn't load your details, so these show placeholders. Refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  const personalSvgs = useMemo(() => {
    const out: Record<string, string> = {};
    for (const item of PERSONAL_ITEMS) if (item.id !== EVENT_ID) out[item.id] = item.render({ coach });
    return out;
  }, [coach]);
  const eventSvg = useMemo(
    () => PERSONAL_ITEMS.find((i) => i.id === EVENT_ID)?.render({ coach, eventName }) ?? "",
    [coach, eventName]
  );
  const genericSvgs = useMemo(() => {
    const out: Record<string, string> = {};
    for (const item of GENERIC_ITEMS) out[item.id] = item.render({});
    return out;
  }, []);

  const firstName = details?.first_name ?? null;
  const hasLink = Boolean(details?.coach_slug);
  const genericSections = [...new Set(GENERIC_ITEMS.map((i) => i.section ?? ""))];
  const viewMeta = TOOLKIT_VIEWS.find((v) => v.id === view);
  const personalGroup = viewMeta && "group" in viewMeta ? viewMeta.group : null;
  const groupItems = personalGroup ? PERSONAL_ITEMS.filter((i) => i.group === personalGroup) : [];

  return (
    <div className="space-y-14 pb-12">
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} precedence="default" />

      {view === "brochure" ? (
        <ProgrammeBrochureCard pack={details?.brochure ?? null} pathname={pathname} />
      ) : null}

      {personalGroup ? (
        <section className="space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-base leading-relaxed text-slate-600">
              Each one carries your name, photo and a QR code that opens your BOSS Scorecard page.
              Download a PNG to post, a PDF to print, or the SVG for a designer.
            </p>
            {details && hasLink ? (
              <p className="text-sm text-slate-500">
                QR codes open <span className="font-medium text-slate-700">{coach.displayUrl}</span>
              </p>
            ) : null}
            {details && !hasLink ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Set your public link in{" "}
                <Link href={linksHref} className="font-medium underline underline-offset-2">
                  Links
                </Link>{" "}
                to put your own QR code on these.
              </p>
            ) : null}
            {loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
          </div>

          <AssetGroup count={groupItems.length}>
            {groupItems.map((item) => (
              <AssetCard
                key={item.id}
                item={item}
                svg={item.id === EVENT_ID ? eventSvg : personalSvgs[item.id]}
                fileBase={firstName ? `${item.title} - ${firstName}` : item.title}
              >
                {item.id === EVENT_ID ? (
                  <label className="block text-sm">
                    <span className="font-medium text-slate-700">Event name</span>
                    <input
                      id="toolkit-event-name"
                      value={eventName}
                      maxLength={40}
                      onChange={(e) => setEventName(e.target.value)}
                      className={fieldClass("input", "normal", "mt-1")}
                    />
                  </label>
                ) : null}
              </AssetCard>
            ))}
          </AssetGroup>
        </section>
      ) : null}

      {view === "brand" ? (
        <section className="space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-base leading-relaxed text-slate-600">
              The BOSS Compass, BOSS Wheel and the 50 playbooks, for slides, workbooks and posts.
            </p>
          </div>
          {genericSections.map((section) => (
            <AssetGroup key={section} title={sectionLabel(section)} count={GENERIC_ITEMS.filter((i) => i.section === section).length}>
              {GENERIC_ITEMS.filter((i) => i.section === section).map((item) => (
                <AssetCard key={item.id} item={item} svg={genericSvgs[item.id]} fileBase={item.title} />
              ))}
            </AssetGroup>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function AssetGroup({ title, count, children }: { title?: string; count: number; children: ReactNode }) {
  // Four cards fill one wide row instead of leaving one alone under three.
  const cols = count === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3";
  return (
    <div className="space-y-3">
      {title ? <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3> : null}
      <div className={`grid gap-4 ${cols}`}>{children}</div>
    </div>
  );
}

type Busy = "png" | "pdf" | null;

function AssetCard({
  item,
  svg,
  fileBase,
  children,
}: {
  item: CatalogItem;
  svg: string;
  fileBase: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const inline = useMemo(() => svgForInline(svg), [svg]);

  async function run(kind: Exclude<Busy, null>) {
    setError(null);
    setBusy(kind);
    try {
      if (kind === "png") await downloadPng(svg, item.png, `${fileBase}.png`);
      else await printPdf(svg, fileBase);
    } catch {
      setError(
        kind === "png"
          ? "Couldn't make the PNG. Try again, or download the SVG."
          : "Couldn't open the print view. Try again, or download the SVG."
      );
    } finally {
      setBusy(null);
    }
  }

  const primary = buttonClass("main", "small");
  const secondary = buttonClass("second", "small");

  return (
    <article className={cardClass("plain", "flex flex-col overflow-hidden [content-visibility:auto]")}>
      <div
        className="flex h-60 items-center justify-center bg-slate-50 p-3 [&>svg]:h-full [&>svg]:w-full"
        role="img"
        aria-label={`Preview: ${item.title}`}
        dangerouslySetInnerHTML={{ __html: inline }}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h4 className="text-base font-semibold leading-snug text-slate-900">{cardTitle(item.title)}</h4>
          <p className="text-sm text-slate-500">{item.size}</p>
        </div>
        {children}
        <div className="mt-auto flex flex-wrap gap-2">
          {item.print ? (
            <>
              <button type="button" className={primary} disabled={busy !== null} onClick={() => void run("pdf")} aria-label={`Print or save ${item.title} as PDF`}>
                {busy === "pdf" ? "Opening…" : "PDF"}
              </button>
              <button type="button" className={secondary} disabled={busy !== null} onClick={() => void run("png")} aria-label={`Download ${item.title} as PNG`}>
                {busy === "png" ? "Preparing…" : "PNG"}
              </button>
            </>
          ) : (
            <button type="button" className={primary} disabled={busy !== null} onClick={() => void run("png")} aria-label={`Download ${item.title} as PNG`}>
              {busy === "png" ? "Preparing…" : "PNG"}
            </button>
          )}
          <button type="button" className={secondary} disabled={busy !== null} onClick={() => downloadSvg(svg, `${fileBase}.svg`)} aria-label={`Download ${item.title} as SVG`}>
            SVG
          </button>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </article>
  );
}
