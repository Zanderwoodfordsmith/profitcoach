import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BeyondleanPremium } from "@/components/beyondlean/BeyondleanPremium";
import { BeyondleanV5 } from "@/components/beyondlean/BeyondleanV5";
import { BeyondleanSite, LookSwitch, type BeyondleanLook } from "@/components/beyondlean/BeyondleanSite";

/**
 * Paul Swift's own website (Beyondlean Ltd, roadmap job 116).
 * Local preview only until it's released: production 404s unless BEYONDLEAN_SITE_LIVE=1.
 */
function siteMode() {
  const production = process.env.NODE_ENV === "production";
  return {
    enabled: !production || process.env.BEYONDLEAN_SITE_LIVE === "1",
    preview: !production,
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Paul Swift | Beyondlean Business Coaching",
  description:
    "Paul Swift spent 25 years fixing how work gets done at Airbus, in banking, energy and defence. Now he coaches owners of growing UK businesses.",
  robots: { index: false, follow: false },
};

export default async function BeyondleanPage({ searchParams }: PageProps) {
  const { enabled, preview } = siteMode();
  if (!enabled) notFound();
  const { look } = await searchParams;
  if (look === "calm" || look === "bold") {
    return <BeyondleanSite look={look satisfies BeyondleanLook} preview={preview} />;
  }
  if (look === "bca" || look === "dark") {
    const dark = look === "dark";
    return (
      <BeyondleanPremium
        theme={dark ? undefined : "bca"}
        switcher={preview ? <LookSwitch look={dark ? "dark" : "bca"} /> : null}
      />
    );
  }
  return <BeyondleanV5 switcher={preview ? <LookSwitch look="v5" /> : null} />;
}
