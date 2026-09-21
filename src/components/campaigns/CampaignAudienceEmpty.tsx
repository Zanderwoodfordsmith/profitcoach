"use client";

import {
  Link2,
  ListOrdered,
  Search,
  Users,
  UserRound,
} from "lucide-react";
import type { CampaignAddProspectsMode } from "@/lib/campaigns/addProspectsMode";

export const CAMPAIGN_ADD_PROSPECT_METHODS: Array<{
  id: CampaignAddProspectsMode;
  label: string;
  hint: string;
  icon: typeof Users;
}> = [
  {
    id: "named",
    label: "From your pool",
    hint: "People you already imported",
    icon: Users,
  },
  {
    id: "list",
    label: "From your prospects",
    hint: "Anyone already in your list",
    icon: UserRound,
  },
  {
    id: "search",
    label: "Search LinkedIn",
    hint: "Sales Nav URL or keywords",
    icon: Search,
  },
  {
    id: "urls",
    label: "Paste profile URLs",
    hint: "One LinkedIn URL per line",
    icon: Link2,
  },
];

type Props = {
  variant: "overview" | "prospects";
  running?: boolean;
  hasSteps?: boolean;
  onAdd: (mode: CampaignAddProspectsMode) => void;
  onSetupSteps?: () => void;
};

export function CampaignAudienceEmpty({
  variant,
  running = false,
  hasSteps = false,
  onAdd,
  onSetupSteps,
}: Props) {
  const overview = variant === "overview";
  const heading = overview
    ? running
      ? "Nobody in the queue yet"
      : "This campaign is not running yet"
    : "Nobody in this campaign yet";
  const body = overview
    ? running
      ? "Add people so this campaign has someone to message."
      : "Set up the sequence, add people, then turn it on at the top."
    : "Choose how you want to add people.";

  return (
    <div className="flex min-h-[min(36rem,70vh)] items-center justify-center px-2 py-10 pb-28 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-[38rem] text-center">
        <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-[34rem] text-base leading-relaxed text-slate-600 sm:text-[1.0625rem]">
          {body}
        </p>

        {overview && onSetupSteps ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={onSetupSteps}
              className={`inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2 ${
                hasSteps
                  ? "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                  : "bg-[#0c5290] text-white hover:bg-[#0a457a]"
              }`}
            >
              <ListOrdered className="h-5 w-5" strokeWidth={2.1} aria-hidden />
              {hasSteps ? "Review steps" : "Set up steps"}
            </button>
          </div>
        ) : null}

        <div className={overview ? "mt-10" : "mt-8"}>
          {overview ? (
            <p className="text-sm font-semibold text-slate-800">Add people</p>
          ) : null}
          <div className={`grid gap-2.5 sm:grid-cols-2 ${overview ? "mt-3" : ""}`}>
            {CAMPAIGN_ADD_PROSPECT_METHODS.map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => onAdd(method.id)}
                  className="flex min-h-[3.5rem] items-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left hover:border-[#0c5290] hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 focus-visible:ring-offset-2"
                >
                  <Icon
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#0c5290]"
                    strokeWidth={2.1}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">
                      {method.label}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-600">
                      {method.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
