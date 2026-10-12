"use client";

import { UserSearch } from "lucide-react";
import {
  salesNavImportBarPercent,
  type SalesNavImportProgressView,
} from "@/lib/salesNavigator/activeImportView";

type Props = {
  listName: string;
  view: SalesNavImportProgressView;
};

function prettyBand(label: string): string {
  return label.replace(/(\d)-(\d)/g, "$1–$2");
}

function bandPhrase(label: string | null): string | null {
  if (!label) return null;
  const pretty = prettyBand(label);
  if (pretty.includes("·")) return pretty;
  return `Company size ${pretty}`;
}

function statusLine(view: SalesNavImportProgressView): string {
  const found = view.progressCount.toLocaleString();
  if (view.finalizing) {
    return `Saving ${found} ${view.progressCount === 1 ? "person" : "people"} into this list`;
  }
  const band = bandPhrase(view.segmentLabel);
  const place =
    view.segmentTotal > 1
      ? `${view.segmentIndex + 1} of ${view.segmentTotal}`
      : null;
  if (band && view.segmentTotalCount && view.segmentTotalCount > 0) {
    const count = `${view.segmentScraped.toLocaleString()} of ${view.segmentTotalCount.toLocaleString()}`;
    return place ? `${band} (${place}), ${count}` : `${band}, ${count}`;
  }
  if (band && place) return `${band} (${place}), ${found} people found`;
  if (band) return `${band}, ${found} people found`;
  return `${found} ${view.progressCount === 1 ? "person" : "people"} found`;
}

function detailLine(view: SalesNavImportProgressView): string {
  if (view.finalizing) {
    return "They show up here as soon as the save finishes.";
  }
  const next = view.upcomingLabels.map(prettyBand);
  const tail =
    "People show up in this list when the import finishes. You can leave this page.";
  if (next.length === 0) return tail;
  if (next.length === 1) return `Next: ${next[0]}. ${tail}`;
  const last = next[next.length - 1];
  const rest = next.slice(0, -1).join(", ");
  return `Next: ${rest}, then ${last}. ${tail}`;
}

export function SalesNavImportWaitPanel({ listName, view }: Props) {
  const pct = salesNavImportBarPercent(view);
  const status = statusLine(view);
  const description =
    view.name && view.name !== listName
      ? view.name
      : "Pulling people from Sales Navigator.";

  return (
    <div className="flex max-w-xl items-start gap-3 text-left">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[#0c5290]">
        <UserSearch className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{listName}</p>
        <p className="mt-0.5 truncate text-xs text-slate-600">{description}</p>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          aria-label={status}
        >
          {pct == null ? (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#0c5290]" />
          ) : (
            <div
              className="h-full rounded-full bg-[#0c5290] transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <p className="mt-2 text-sm font-medium tabular-nums text-slate-900" aria-live="polite">
          {status}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{detailLine(view)}</p>
      </div>
    </div>
  );
}
