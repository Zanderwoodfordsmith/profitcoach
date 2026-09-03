"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";

const PUBLIC_SHARE_HOST = "theprofitcoach.com";

type LeadMagnet = {
  id: string;
  title: string;
  description: string;
  pathForSlug: (slug: string) => string;
  imageSrc: string;
  imageAlt: string;
};

const LEAD_MAGNETS: LeadMagnet[] = [
  {
    id: "boss-score",
    title: "Boss Score Assessment",
    description:
      "Short scorecard lead magnet — owners opt in, take the assessment, and land in your prospects list.",
    pathForSlug: (slug) => `/score/${slug}`,
    imageSrc: "/landing/v2/dashboard.png",
    imageAlt: "Boss Score assessment preview",
  },
  {
    id: "boss-score-pro",
    title: "Boss Score Pro Assessments",
    description:
      "Full 50-question diagnostic across every playbook — share when you want a deeper read on the business.",
    pathForSlug: (slug) => `/assessment-pro/${slug}`,
    imageSrc: "/landing/c/hero-dashboard.png",
    imageAlt: "Boss Score Pro assessment preview",
  },
];

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

export function LeadMagnetsList() {
  const pathname = usePathname() ?? "";
  const { impersonatingCoachId } = useImpersonation();
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const settingsHref = pathname.startsWith("/admin")
    ? "/admin/account?tab=funnel"
    : "/coach/settings?tab=funnel";

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("Sign in to load your share links.");
          setLoading(false);
        }
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch("/api/coach/profile", { headers });
      if (cancelled) return;
      if (!res.ok) {
        setError("Unable to load your coach profile.");
        setLoading(false);
        return;
      }
      const body = (await res.json()) as { coach_slug?: string | null };
      setCoachSlug(body.coach_slug?.trim() || null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  async function copyLink(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore — coach can select from the displayed URL
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading lead magnets…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  const slugReady = Boolean(coachSlug);

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {!slugReady ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add your public URL slug in{" "}
          <Link
            href={settingsHref}
            className="font-medium text-amber-950 underline underline-offset-2"
          >
            Funnel settings
          </Link>{" "}
          to unlock shareable lead magnet links.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {LEAD_MAGNETS.map((magnet) => {
          const slug = coachSlug || "your-slug";
          const path = magnet.pathForSlug(slug);
          const displayUrl = shareDisplayUrl(path, appOrigin);
          const copyUrl = shareCopyUrl(path, appOrigin);

          return (
            <li
              key={magnet.id}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-5 sm:p-5"
            >
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-36">
                <Image
                  src={magnet.imageSrc}
                  alt={magnet.imageAlt}
                  fill
                  className="object-cover object-top"
                  sizes="144px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">
                  {magnet.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {magnet.description}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <code className="block min-w-0 truncate rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200">
                    {displayUrl}
                  </code>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {slugReady ? (
                      <button
                        type="button"
                        onClick={() => void copyLink(magnet.id, copyUrl)}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {copiedId === magnet.id ? "Copied!" : "Copy"}
                      </button>
                    ) : null}
                    <Link
                      href={path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:text-sky-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
