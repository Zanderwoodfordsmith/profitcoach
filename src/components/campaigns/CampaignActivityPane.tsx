"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Bell, Check, Clock } from "lucide-react";
import {
  ActivityTableHeader,
  ActivityTableRow,
  leadChip,
  shortStepLabel,
  ACTIVITY_ROW_GRID,
} from "@/components/campaigns/CampaignActivityRows";
import { LinkedInRemindQueue } from "@/components/campaigns/LinkedInRemindQueue";
import { demoPreviewActivityFeed } from "@/lib/campaigns/demoPreview";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { CampaignFeedItem } from "@/lib/unipile/campaignActivityFeed";

type PaneTab = "due" | "sent" | "planned";

const TABS: {
  id: PaneTab;
  label: string;
  icon: typeof Bell;
}[] = [
  { id: "due", label: "To do", icon: Bell },
  { id: "planned", label: "Planned", icon: Clock },
  { id: "sent", label: "Done", icon: Check },
];

function personName(item: CampaignFeedItem) {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.company ||
    "Unknown"
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-0" aria-hidden>
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className={`${ACTIVITY_ROW_GRID} items-center border-b border-slate-100 px-3 py-3`}
        >
          <div className="h-3.5 flex-1 rounded bg-slate-100" />
          <div className="h-5 w-[9.5rem] shrink-0 rounded-full bg-slate-100" />
          <div className="h-3.5 w-[5.25rem] shrink-0 rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function FeedList({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: CampaignFeedItem[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">{emptyTitle}</p>
        <p className="mt-1 text-xs text-slate-500">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityTableHeader />
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.map((item) => (
          <ActivityTableRow
            key={item.id}
            name={personName(item)}
            status={leadChip(item.leadStatus)}
            next={shortStepLabel(item.stepType)}
          />
        ))}
      </ul>
    </div>
  );
}

export function CampaignActivityPane({ preview = false }: { preview?: boolean }) {
  const tabId = useId();
  const [tab, setTab] = useState<PaneTab>("due");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<CampaignFeedItem[]>([]);
  const [planned, setPlanned] = useState<CampaignFeedItem[]>([]);
  const [waiting, setWaiting] = useState<CampaignFeedItem[]>([]);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (preview) {
        const dummy = demoPreviewActivityFeed();
        if (cancelled) return;
        setSent(dummy.sent);
        setPlanned(dummy.planned);
        setWaiting(dummy.waiting);
        setDueCount(dummy.dueCount);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const headers = await getCoachAuthHeaders();
        if (!headers) throw new Error("Sign in required.");
        const [feedRes, countsRes] = await Promise.all([
          fetch("/api/coach/linkedin-outreach/activity-feed", { headers }),
          fetch("/api/coach/linkedin-outreach/remind?view=counts", { headers }),
        ]);
        const feedBody = (await feedRes.json().catch(() => ({}))) as {
          error?: string;
          sent?: CampaignFeedItem[];
          planned?: CampaignFeedItem[];
          waiting?: CampaignFeedItem[];
        };
        const countsBody = (await countsRes.json().catch(() => ({}))) as {
          counts?: { due?: number; overdue?: number };
        };
        if (!feedRes.ok) {
          throw new Error(feedBody.error || "Could not load activity.");
        }
        if (cancelled) return;
        setSent(feedBody.sent ?? []);
        setPlanned(feedBody.planned ?? []);
        setWaiting(feedBody.waiting ?? []);
        const due =
          (countsBody.counts?.due ?? 0) + (countsBody.counts?.overdue ?? 0);
        setDueCount(due);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Load failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const plannedAll = useMemo(
    () => [...planned, ...waiting],
    [planned, waiting]
  );

  const tabCounts: Record<PaneTab, number> = {
    due: dueCount,
    sent: sent.length,
    planned: plannedAll.length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        className="grid shrink-0 grid-cols-3 border-b border-slate-200 bg-slate-100"
        role="tablist"
        aria-label="Campaign activity"
      >
        {TABS.map((item, index) => {
          const selected = tab === item.id;
          const count = tabCounts[item.id];
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabId}-${item.id}`}
              aria-selected={selected}
              aria-controls={`${tabId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                  return;
                }
                event.preventDefault();
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % TABS.length
                    : (index - 1 + TABS.length) % TABS.length;
                const nextId = TABS[next].id;
                setTab(nextId);
                requestAnimationFrame(() => {
                  document.getElementById(`${tabId}-${nextId}`)?.focus();
                });
              }}
              className={`-mb-px flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 pt-3.5 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                selected
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {item.label}
              {count > 0 ? (
                <span
                  className={`text-[11px] font-medium tabular-nums ${
                    selected ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div
        id={`${tabId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabId}-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === "due" ? (
          <LinkedInRemindQueue embedded preview={preview} />
        ) : error && !loading ? (
          <p className="px-4 py-6 text-sm text-rose-600">{error}</p>
        ) : loading ? (
          <FeedSkeleton />
        ) : tab === "sent" ? (
          <FeedList
            items={sent}
            emptyTitle="Nothing sent yet"
            emptyBody="Invites and messages that go out will list here."
          />
        ) : (
          <FeedList
            items={plannedAll}
            emptyTitle="Nothing queued"
            emptyBody="Queued invites and messages will list here."
          />
        )}
      </div>
    </div>
  );
}
