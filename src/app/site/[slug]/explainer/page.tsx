import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { cache } from "react";
import { CoachExplainer } from "@/components/coachExplainer/CoachExplainer";
import { PrintOnLoad } from "@/components/coachExplainer/PrintOnLoad";
import { figtree } from "@/fonts";
import { EXPLAINER_LENGTHS, parseExplainerCall, parseExplainerLength, type ExplainerLength } from "@/lib/coachExplainer/copy";
import { explainerFromBlueprint } from "@/lib/coachExplainer/fromBlueprint";
import { loadCoachSiteAndRow } from "@/lib/coachSite/load";
import { coachSiteMode } from "@/lib/coachSite/mode";

/**
 * A coach's before-our-call explainer, filled from their Blueprint. Same
 * release rule as the coach website: local preview only until coach sites go
 * live. ?length=ongoing|ninety|blend and ?fee=1 set the version; print the
 * page to save the PDF. ?call=review|roadmap matches the digital explainer.
 */

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const loadFor = cache(async (slug: string) => {
  const mode = coachSiteMode();
  if (!mode.enabled) return null;
  return loadCoachSiteAndRow(slug, { approvedOnly: !mode.preview });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadFor(slug);
  if (!loaded) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `${loaded.site.name} | Read this before our call`,
    robots: { index: false, follow: false },
  };
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CoachExplainerPage({ params, searchParams }: PageProps) {
  const [{ slug }, query, head] = await Promise.all([params, searchParams, headers()]);
  const loaded = await loadFor(slug);
  if (!loaded) notFound();

  const length = parseExplainerLength(one(query.length));
  const showFee = one(query.fee) === "1";
  // Set by the digital explainer's "Save as PDF": same version, then the print dialog.
  const call = parseExplainerCall(one(query.call));
  const print = one(query.print) === "1";
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "theprofitcoach.com";
  const origin = host.startsWith("localhost") ? "theprofitcoach.com" : host;
  const coach = explainerFromBlueprint(loaded.site, loaded.row);
  // Tagged, so a scan from the brochure shows as "via QR code" on the prospect.
  const qrSvg = await QRCode.toString(`https://${origin}${loaded.site.links.score}?utm_source=qr&utm_medium=print&utm_campaign=explainer`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0d1f31", light: "#0000" },
  }).catch(() => null);
  const base = `/site/${encodeURIComponent(loaded.site.slug)}/explainer`;
  const href = (next: { length?: ExplainerLength; fee?: boolean }) => {
    const l = next.length ?? length;
    const f = next.fee ?? showFee;
    const params = new URLSearchParams();
    if (l !== "ongoing") params.set("length", l);
    if (f) params.set("fee", "1");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className={figtree.variable}>
      <nav className="cx-bar" aria-label="Explainer settings">
        <div className="cx-bar__group">
          <span>Length</span>
          {EXPLAINER_LENGTHS.map((option) => (
            <Link key={option.value} href={href({ length: option.value })} aria-current={option.value === length}>
              {option.label}
            </Link>
          ))}
        </div>
        <div className="cx-bar__group">
          <span>Price</span>
          <Link href={href({ fee: false })} aria-current={!showFee}>
            Before the call (no price)
          </Link>
          <Link href={href({ fee: true })} aria-current={showFee}>
            Between calls (with price)
          </Link>
        </div>
      </nav>
      <CoachExplainer coach={coach} length={length} showFee={showFee} origin={origin} qrSvg={qrSvg} call={call} />
      {print ? <PrintOnLoad /> : null}
    </div>
  );
}
