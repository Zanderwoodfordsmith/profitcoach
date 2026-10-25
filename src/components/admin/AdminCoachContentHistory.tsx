"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { LinkedInCalendarTab } from "./linkedin/LinkedInCalendarTab";
import { LinkedInHistoryStats } from "./linkedin/LinkedInHistoryStats";
import { NewsletterIssuesTab } from "./linkedin/NewsletterIssuesTab";
import { daysAgoLabel, useLinkedInHistory } from "./linkedin/useLinkedInHistory";

/** What a coach has posted on LinkedIn and their newsletter issues, for the admin coach page. */
export function AdminCoachContentHistory({ coachId }: { coachId: string }) {
  const getHeaders = useCallback(() => getCoachAuthHeaders(coachId), [coachId]);
  const history = useLinkedInHistory(getHeaders);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setMessage(null);
    const error = await history.runImport();
    setMessage(error ?? "Imported from LinkedIn.");
  }

  const lastOk = history.data?.last_import?.last_ok_at;
  const daysSince = history.data?.last_import?.days_since_ok ?? null;

  return (
    <section className={cardClass("plain", "space-y-5 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Posts and newsletter</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {lastOk
              ? `Imported from their LinkedIn, updated ${daysAgoLabel(daysSince)}.`
              : "Not imported from LinkedIn yet."}
          </p>
        </div>
        {history.data?.connected ? (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={history.importing}
            className={buttonClass("second", "small")}
          >
            {history.importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {history.importing ? "Importing…" : lastOk ? "Refresh" : "Import now"}
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {history.error ? <p className="text-sm text-rose-700">{history.error}</p> : null}

      <LinkedInHistoryStats history={history.data} loading={history.loading} importing={history.importing} />

      {history.data?.last_import?.last_ok_at ? (
        <>
          <LinkedInCalendarTab items={[]} history={history.data.posts} issues={history.data.issues} onOpenIssue={setOpenIssueId} />
          <NewsletterIssuesTab
            history={history.data}
            loading={history.loading}
            importing={history.importing}
            onImport={() => void refresh()}
            getHeaders={getHeaders}
            openIssueId={openIssueId}
            onOpenIssue={setOpenIssueId}
            blueprintHref={null}
          />
        </>
      ) : null}
    </section>
  );
}
