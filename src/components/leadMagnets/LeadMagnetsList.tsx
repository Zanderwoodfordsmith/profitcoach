"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import {
  LEAD_MAGNETS,
  magnetShareCopyUrl,
  magnetShareDisplayUrl,
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
        const displayUrl = magnetShareDisplayUrl(path, appOrigin);
        const copyUrl = magnetShareCopyUrl(path, appOrigin);
        const editorHref = `${prefix}/campaigns/magnets/${magnet.id}`;
        const sequenceHint = magnet.sequences
          .map((seq) => seq.title)
          .join(" · ");

        return (
          <li
            key={magnet.id}
            className="border-b border-slate-100 last:border-b-0"
          >
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-5">
              <Link
                href={editorHref}
                className="group flex min-w-0 flex-1 gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-36">
                  <Image
                    src={magnet.imageSrc}
                    alt={magnet.imageAlt}
                    fill
                    className="object-cover object-top transition group-hover:scale-[1.02]"
                    sizes="144px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 group-hover:text-[#0c5290]">
                    {magnet.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {magnet.description}
                  </p>
                  {sequenceHint ? (
                    <p className="mt-1.5 text-xs font-medium text-slate-500">
                      {sequenceHint}
                    </p>
                  ) : null}
                </div>
              </Link>
              <div className="flex min-w-0 flex-col gap-2 sm:w-56 sm:shrink-0 sm:items-end">
                <code className="block w-full truncate rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {displayUrl}
                </code>
                <div className="flex items-center gap-3 text-sm">
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
  );
}
