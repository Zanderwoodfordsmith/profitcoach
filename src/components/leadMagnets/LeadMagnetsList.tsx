"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import {
  LEAD_MAGNETS,
  magnetShareCopyUrl,
} from "@/lib/leadMagnets/catalog";

type Props = {
  coachSlug: string | null;
  appOrigin: string;
};

export function LeadMagnetsList({ coachSlug, appOrigin }: Props) {
  const pathname = usePathname() ?? "";
  const prefix = (pathname.startsWith("/admin") ? "/admin" : "/coach") as
    | "/admin"
    | "/coach";
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const slugReady = Boolean(coachSlug);

  async function copyLink(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore — coach can select from the displayed URL
    }
  }

  return (
    <ul>
      {LEAD_MAGNETS.map((magnet) => {
        const slug = coachSlug || "your-slug";
        const path = magnet.pathForSlug(slug);
        const copyUrl = magnetShareCopyUrl(path, appOrigin);
        const editorHref = `${prefix}/campaigns/magnets/${magnet.id}`;

        return (
          <li
            key={magnet.id}
            className="border-b border-slate-100 last:border-b-0"
          >
            <div className="flex items-start gap-4 px-5 py-4">
              <Link
                href={editorHref}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2 sm:h-24 sm:w-36"
              >
                <Image
                  src={magnet.imageSrc}
                  alt={magnet.imageAlt}
                  fill
                  className="object-cover object-top"
                  sizes="144px"
                  priority
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <Link
                    href={editorHref}
                    className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                  >
                    <h2 className="text-ui font-semibold tracking-tight text-slate-900 hover:text-[#0c5290]">
                      {magnet.title}
                    </h2>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2.5 text-sm">
                    <span className="font-mono text-caption text-slate-500">
                      {path}
                    </span>
                    {slugReady ? (
                      <button
                        type="button"
                        onClick={() => void copyLink(magnet.id, copyUrl)}
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {copiedId === magnet.id ? "Copied" : "Copy"}
                      </button>
                    ) : null}
                    <Link
                      href={path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open
                    </Link>
                  </div>
                </div>
                <Link
                  href={editorHref}
                  className="mt-1 block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
                >
                  <p className="text-sm leading-relaxed text-slate-600">
                    {magnet.description}
                  </p>
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
