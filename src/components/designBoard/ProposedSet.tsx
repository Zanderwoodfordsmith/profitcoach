"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { MarkControls, type Save } from "./MarkControls";
import { Preview } from "./Preview";
import type { Inventory, Mark } from "./types";

type Step = { id: string; name: string; cls: string; px: number; weights: string; use: string; sample: ReactNode; upTo: number };

/** The short text scale. upTo: live sizes up to this many px fold into the step. */
const TEXT: Step[] = [
  {
    id: "kicker",
    name: "Kicker",
    cls: "text-kicker font-semibold uppercase text-sky-700",
    px: 11,
    weights: "semibold, capitals",
    use: "The small line above a heading.",
    sample: "Get clients",
    upTo: 0,
  },
  { id: "caption", name: "Caption", cls: "text-caption text-slate-500", px: 12, weights: "normal or medium", use: "Dates, hints, badges, table headings, small buttons.", sample: "Updated 2 hours ago", upTo: 12.99 },
  { id: "ui", name: "UI", cls: "text-ui text-slate-700", px: 14, weights: "normal, medium for emphasis", use: "Menus, buttons, labels, lists. Most of the app.", sample: "Prospects · Campaigns · Scripts", upTo: 15.2 },
  { id: "read", name: "Reading", cls: "text-read text-slate-700", px: 16, weights: "normal, roomy lines", use: "Scripts, lessons, the Blueprint. Anything you read for a while.", sample: "Thanks for making the time. Before we start, what made you book this call today?", upTo: 17 },
  { id: "subhead", name: "Subhead", cls: "text-subhead font-semibold text-slate-900", px: 18, weights: "semibold", use: "Section and card headings.", sample: "Your next three calls", upTo: 21 },
  { id: "title", name: "Title", cls: "text-title font-semibold text-slate-900", px: 24, weights: "semibold", use: "Page titles.", sample: "Get Clients", upTo: 27 },
  {
    id: "heading",
    name: "Heading",
    cls: "text-heading",
    px: 30,
    weights: "light then semibold",
    use: "Big headings on overview pages, in the BCA two-weight style.",
    sample: (
      <>
        <span className="font-light text-slate-500">Your Blueprint: </span>
        <span className="font-semibold text-slate-900">three parts left</span>
      </>
    ),
    upTo: 34,
  },
  {
    id: "display",
    name: "Display",
    cls: "text-display",
    px: 40,
    weights: "light then semibold, bold for numbers",
    use: "Showpieces: assessment headlines, scores, reports.",
    sample: (
      <>
        <span className="font-light text-slate-500">BOSS Score </span>
        <span className="font-bold text-slate-900">72</span>
      </>
    ),
    upTo: Infinity,
  },
];

const IDS = { buttons: "proposed-buttons", text: "proposed-text", cards: "proposed-cards" };
export const PROPOSED_IDS = Object.values(IDS);

function Block({ title, intro, children, mark }: { title: string; intro: string; children: ReactNode; mark: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h3 className="text-subhead font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 max-w-[64ch] text-ui text-slate-500">{intro}</p>
        </div>
        {mark}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-kicker font-semibold uppercase text-slate-400">{children}</p>;
}

export function ProposedSet({ inv, marks, save }: { inv: Inventory; marks: Record<string, Mark>; save: Save }) {
  const top = (kind: "button" | "card", n: number) => inv.families.filter((f) => f.kind === kind).slice(0, n);

  // Which live sizes each step takes over, and how many uses that is.
  const takeover = new Map<string, { sizes: Set<number>; uses: number }>();
  for (const t of inv.textStyles) {
    const step = TEXT.find((s) => s.upTo > 0 && t.px <= s.upTo)!;
    const e = takeover.get(step.id) ?? { sizes: new Set(), uses: 0 };
    e.sizes.add(+t.px.toFixed(2));
    e.uses += t.count;
    takeover.set(step.id, e);
  }

  const markFor = (id: string, label: string) => (
    <MarkControls key={marks[id]?.note ?? ""} id={id} kind="proposed" label={label} mark={marks[id]} save={save} yes="Yes, use this" no="Not yet" />
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-slate-50 p-6 sm:p-8">
        <h3 className="text-subhead font-semibold text-slate-900">My proposal</h3>
        <ul className="mt-3 flex max-w-[72ch] flex-col gap-2 text-ui text-slate-600">
          <li>Say yes to each set, or not yet with a note. Once it&apos;s yes, I swap the app over one area at a time, with before and after shots for a one-minute look.</li>
          <li>Lighter weights throughout: normal for text, medium for buttons and emphasis, semibold for headings. Bold only for numbers and the one thing that must stand out.</li>
          <li>Showpieces keep their punch. A one-off that looks good, like an assessment headline, moves to Display or Heading rather than shrinking. Anything with no close match comes to you on that area&apos;s checklist.</li>
        </ul>
      </section>

      <Block
        title="Buttons: four kinds, two sizes, all pills"
        intro="Pills in BCA navy, like the BCA site and Ava. Main is the one action that matters on a screen. Second sits beside it. Quiet is for small extras. Delete is for things you can't undo."
        mark={markFor(IDS.buttons, "Buttons: main, second, quiet, delete; normal and small; pills")}
      >
        <Label>Proposed</Label>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-100 p-6">
          {(["normal", "small"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <span className="w-16 text-caption text-slate-400">{size === "normal" ? "Normal" : "Small"}</span>
              <Button size={size}>
                <Plus className={size === "normal" ? "h-4 w-4" : "h-3.5 w-3.5"} /> Add prospect
              </Button>
              <Button size={size} variant="second">
                Save draft
              </Button>
              <Button size={size} variant="quiet">
                See all
              </Button>
              <Button size={size} variant="delete">
                <Trash2 className={size === "normal" ? "h-4 w-4" : "h-3.5 w-3.5"} /> Delete
              </Button>
              <Button size={size} disabled>
                Saving…
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Label>Today&apos;s four most used</Label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {top("button", 4).map((f) => (
              <div key={f.id} className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-5">
                <Preview kind="button" version={f.versions[0]} />
                <p className="text-caption text-slate-500">
                  {f.count} uses, {f.versionCount} ways
                </p>
              </div>
            ))}
          </div>
        </div>
      </Block>

      <Block
        title={`Text: eight sizes, down from ${new Set(inv.textStyles.map((t) => t.px)).size}`}
        intro="One font. UI for using the app, Reading for long text, the rest for headings. Each line says which of today's sizes it takes over."
        mark={markFor(IDS.text, "Text: kicker 11, caption 12, UI 14, reading 16, subhead 18, title 24, heading 30, display 40; lighter weights")}
      >
        <div className="flex flex-col divide-y divide-slate-100">
          {TEXT.map((s) => {
            const t = takeover.get(s.id);
            return (
              <div key={s.id} className="grid gap-2 py-5 first:pt-0 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
                <div>
                  <p className="text-ui font-medium text-slate-900">{s.name}</p>
                  <p className="text-caption text-slate-500">
                    {s.px}px · {s.weights}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={s.cls}>{s.sample}</p>
                  <p className="mt-2 text-caption text-slate-500">{s.use}</p>
                  {t ? (
                    <p className="mt-1 text-caption text-slate-400 [overflow-wrap:anywhere]">
                      Takes over {t.uses} uses at {[...t.sizes].sort((a, b) => a - b).map((x) => `${x}px`).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-caption text-slate-400">Takes over the small capital labels.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Block>

      <Block
        title="Cards: three kinds"
        intro="Same corners for all three. Shadows only on things you click or that pop up, so the page stays calm."
        mark={markFor(IDS.cards, "Cards: plain, raised, soft; rounded-2xl")}
      >
        <Label>Proposed</Label>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-subhead font-semibold text-slate-900">Plain</p>
            <p className="mt-1 text-ui text-slate-500">Most things: a list, a form, a summary.</p>
          </Card>
          <Card variant="raised">
            <p className="text-subhead font-semibold text-slate-900">Raised</p>
            <p className="mt-1 text-ui text-slate-500">Things you click into, and pop-ups.</p>
          </Card>
          <Card variant="soft">
            <p className="text-subhead font-semibold text-slate-900">Soft</p>
            <p className="mt-1 text-ui text-slate-500">A quiet panel inside a page or a card.</p>
          </Card>
        </div>
        <div className="mt-6">
          <Label>Today&apos;s three most used</Label>
          <div className="grid gap-3 md:grid-cols-3">
            {top("card", 3).map((f) => (
              <div key={f.id} className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 p-5">
                <Preview kind="card" version={f.versions[0]} />
                <p className="text-caption text-slate-500">
                  {f.count} uses, {f.versionCount} ways
                </p>
              </div>
            ))}
          </div>
        </div>
      </Block>
    </div>
  );
}
