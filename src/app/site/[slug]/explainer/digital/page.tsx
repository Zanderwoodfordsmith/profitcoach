import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CoachExplainerDigital } from "@/components/coachExplainer/CoachExplainerDigital";
import { figtree } from "@/fonts";
import {
  EXPLAINER_CALLS,
  EXPLAINER_LENGTHS,
  parseExplainerCall,
  parseExplainerLength,
  type ExplainerCall,
  type ExplainerLength,
} from "@/lib/coachExplainer/copy";
import { explainerFromBlueprint } from "@/lib/coachExplainer/fromBlueprint";
import { loadCoachSiteAndRow } from "@/lib/coachSite/load";
import { coachSiteMode } from "@/lib/coachSite/mode";
import "@/components/coachExplainer/explainer.css";

/**
 * A coach's explainer to read on screen, beside the A4 version at
 * /site/[slug]/explainer. ?call=review (default, before the BOSS Score Review)
 * or ?call=roadmap (before the Profit Roadmap call, with the price);
 * ?length= as on the A4 version. Same release rule as the coach website.
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

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadFor(slug);
  if (!loaded) return { title: "Not found", robots: { index: false, follow: false } };
  const call = parseExplainerCall(one(query.call)) ?? "review";
  const kicker = EXPLAINER_CALLS.find((c) => c.value === call)!.kicker;
  return { title: `${loaded.site.name} | ${kicker}`, robots: { index: false, follow: false } };
}

export default async function CoachExplainerDigitalPage({ params, searchParams }: PageProps) {
  const [{ slug }, query, head] = await Promise.all([params, searchParams, headers()]);
  const loaded = await loadFor(slug);
  if (!loaded) notFound();

  const call = parseExplainerCall(one(query.call)) ?? "review";
  const length = parseExplainerLength(one(query.length));
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "theprofitcoach.com";
  const origin = host.startsWith("localhost") ? "https://theprofitcoach.com" : `https://${host}`;
  const coach = explainerFromBlueprint(loaded.site, loaded.row);

  const base = `/site/${encodeURIComponent(loaded.site.slug)}/explainer`;
  const query_ = (next: { call: ExplainerCall; length: ExplainerLength }) => {
    const p = new URLSearchParams({ call: next.call });
    if (next.length !== "ongoing") p.set("length", next.length);
    return p;
  };
  const href = (next: Partial<{ call: ExplainerCall; length: ExplainerLength }>) =>
    `${base}/digital?${query_({ call: next.call ?? call, length: next.length ?? length })}`;
  // The PDF is the A4 version of the same call, printed.
  const pdf = query_({ call, length });
  if (call === "roadmap") pdf.set("fee", "1");
  pdf.set("print", "1");
  const pdfHref = `${base}?${pdf}`;

  return (
    <div className={figtree.variable}>
      {coachSiteMode().preview ? (
        <nav className="cx-bar cxd-preview" aria-label="Explainer settings">
          <div className="cx-bar__group">
            <span>Version</span>
            {EXPLAINER_CALLS.map((option) => (
              <Link key={option.value} href={href({ call: option.value })} aria-current={option.value === call}>
                {option.label}
              </Link>
            ))}
          </div>
          <div className="cx-bar__group">
            <span>Length</span>
            {EXPLAINER_LENGTHS.map((option) => (
              <Link key={option.value} href={href({ length: option.value })} aria-current={option.value === length}>
                {option.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
      <CoachExplainerDigital coach={coach} call={call} length={length} origin={origin} pdfHref={pdfHref} />
    </div>
  );
}
