"use client";

import { ClipboardList, UserRound } from "lucide-react";

export function ScorecardInsertButtons({
  assessmentUrl,
  personalisedUrl,
  onInsert,
  disabled,
}: {
  assessmentUrl?: string | null;
  personalisedUrl?: string | null;
  onInsert: (text: string) => void;
  disabled?: boolean;
}) {
  const generic = assessmentUrl?.trim() || "";
  const personal = personalisedUrl?.trim() || "";
  if (!generic && !personal) return null;

  function insert(url: string, personalised: boolean) {
    const line = personalised
      ? "Here's your personalised BOSS Scorecard:"
      : "Here's the 3-minute BOSS Scorecard:";
    onInsert(`${line}\n${url}`);
  }

  return (
    <div className="flex items-center gap-0.5">
      {generic ? (
        <button
          type="button"
          title="Insert BOSS Scorecard link"
          aria-label="Insert BOSS Scorecard link"
          disabled={disabled}
          onClick={() => insert(generic, false)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : null}
      {personal && personal !== generic ? (
        <button
          type="button"
          title="Insert personalised BOSS Scorecard link"
          aria-label="Insert personalised BOSS Scorecard link"
          disabled={disabled}
          onClick={() => insert(personal, true)}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <UserRound className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
