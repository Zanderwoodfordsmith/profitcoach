"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { StudioHubCard } from "@/components/profitCoachAi/StudioHubCard";
import { isLeadFinderAllowedEmail } from "@/lib/leadFinderAccess";
import {
  STUDIO_HUB_CARDS,
  studioCardHref,
  type StudioHubCard as StudioHubCardConfig,
} from "@/lib/profitCoachAi/studioHub";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  basePath: string;
  /** In-panel: chat skills open in the AI panel instead of navigating away. */
  onPickSkill?: (outputId: string) => void;
  /** In-panel: open brain tab instead of navigating to message-generator. */
  onOpenBrain?: () => void;
};

export function StudioHubOverview({
  basePath,
  onPickSkill,
  onOpenBrain,
}: Props) {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [leadFinderAllowed, setLeadFinderAllowed] = useState(false);

  useEffect(() => {
    if (prefix !== "/admin") return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!cancelled) {
        setLeadFinderAllowed(isLeadFinderAllowedEmail(user?.email));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const cards = STUDIO_HUB_CARDS.filter((card: StudioHubCardConfig) => {
    if (card.adminOnly && prefix !== "/admin") return false;
    if (card.requireLeadFinderAccess && !leadFinderAllowed) return false;
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-1 pb-10 pt-2 sm:px-2">
      <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const href = studioCardHref(card, prefix, basePath);
          const useInPanel =
            onPickSkill && card.outputId && !card.dedicatedPath;
          return (
            <StudioHubCard
              key={card.id}
              href={useInPanel ? undefined : href}
              onSelect={
                useInPanel ? () => onPickSkill(card.outputId!) : undefined
              }
              eyebrow={card.eyebrow}
              eyebrowClassName={card.eyebrowClassName}
              title={card.title}
              description={card.description}
              accentClassName={card.accentClassName}
              ctaLabel={useInPanel ? "Start in chat" : "Open"}
            />
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/50 px-5 py-4 backdrop-blur-sm">
        <p className="text-sm font-medium text-slate-800">Your brain</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Superpowers, proof, and ideal-client notes that every tool here can
          use.
        </p>
        {onOpenBrain ? (
          <button
            type="button"
            onClick={onOpenBrain}
            className="mt-3 inline-flex text-sm font-medium text-sky-800 hover:text-sky-950"
          >
            Edit your brain
            <span aria-hidden className="ml-1">→</span>
          </button>
        ) : (
          <Link
            href={`${basePath}?tab=brain`}
            className="mt-3 inline-flex text-sm font-medium text-sky-800 hover:text-sky-950"
          >
            Edit your brain
            <span aria-hidden className="ml-1">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
