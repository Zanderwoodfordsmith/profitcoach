"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

import { requestAvaOpen } from "@/components/ava/avaPageLink";

import { useDraftLayer, type DraftMissing } from "./DraftLayer";
import { usePractice } from "./PracticeProvider";

/**
 * BCA's strip under a coach's Blueprint top bar (job 248, 21 Nov): Ava's draft
 * is on this page and not released, what she wrote without, and one Release
 * for everything of hers on the page. Changes go through Ava's panel on the
 * right. The page's status stays as it is (five statuses). Coaches never see it.
 */
export function DraftStrip() {
  const layer = useDraftLayer();
  const { reload, coachName } = usePractice();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const first = coachName.split(/\s+/)[0] || "the coach";

  if (!layer || (!layer.items.length && !note)) return null;
  const latest = layer.items.map((item) => item.created_at).sort().at(-1);
  const edited = layer.items.some((item) => item.edited);

  async function release() {
    if (!layer) return;
    setBusy(true);
    setNote(null);
    for (const item of layer.items) {
      const err = await layer.post(item.kind === "answers" ? { action: "save_answers", id: item.id } : { action: "save", id: item.id });
      if (err) {
        setBusy(false);
        setNote(err);
        await layer.refresh();
        return;
      }
    }
    await layer.refresh();
    reload();
    setBusy(false);
    setNote(`Released. ${first} can see it now, and Ava starts on the next step.`);
  }

  if (!layer.items.length) {
    return (
      <div className="bp-no-print border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 md:px-5" role="status">
        {note}
      </div>
    );
  }

  return (
    <div className="bp-no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-amber-200 bg-amber-50 px-4 py-2 md:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
        <p
          className="text-ui font-medium whitespace-nowrap text-slate-900"
          title={latest ? `Drafted ${new Date(latest).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${edited ? ", changed since" : ""}` : undefined}
        >
          Ava&apos;s draft, not released
        </p>
        {layer.missing.length ? <MissingNote items={layer.missing} /> : null}
        {note ? <span className="text-caption text-rose-700">{note}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => requestAvaOpen()} className={buttonClass("quiet", "small")}>
          Ask Ava
        </button>
        <button type="button" disabled={busy} onClick={() => void release()} className={buttonClass("main", "small")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Release
        </button>
      </div>
    </div>
  );
}

/** What Ava wrote without: a small note that opens the list. */
function MissingNote({ items }: { items: DraftMissing[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={badgeClass("amber", "cursor-pointer bg-amber-100 hover:bg-amber-200")}>
        {items.length} {items.length === 1 ? "thing" : "things"} missing
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className={cardClass("raised", "absolute left-0 z-30 mt-2 w-72 p-3")}>
          <p className="text-caption text-slate-500">Ava wrote this without:</p>
          <ul className="mt-2 space-y-2">
            {items.map((m) => (
              <li key={m.label} className="text-sm">
                <span className="block text-slate-900">{m.label}</span>
                <span className="block text-caption text-slate-500">{m.coach ? "The coach fills this in" : "BCA fills this in"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
