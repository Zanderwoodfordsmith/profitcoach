"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import {
  BLUEPRINT_GROUPS,
  sectionKey,
  type BlueprintLink,
  type BlueprintSection,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import {
  isNewsletterLibraryId,
  issueHeading,
  newsletterLibraryId,
  newsletterOverviewKey,
  newsletterPieceKey,
  newsletterPieceStarter,
  newsletterStarter,
  newsletterTitle,
  type NewsletterPiece,
} from "@/lib/practiceKnowledge/newsletters";

import { usePractice } from "../PracticeProvider";
import { SectionView } from "./SectionView";

/** What sits inside one issue, in the order you read it. InMail and a second article are not here: the issue is the article. */
const PARTS: { piece: NewsletterPiece | "issue"; title: string; note: string; roomy?: boolean }[] = [
  { piece: "cover", title: "Cover photo", note: "The banner for this issue" },
  { piece: "issue", title: "Content", note: "What goes out in this issue", roomy: true },
  { piece: "post", title: "Post about this issue", note: "For the feed, so people open it" },
  { piece: "inbox", title: "Note to your top 100", note: "The inbox message. The first line is personal." },
];

function sectionRefFor(page: BlueprintLink, section: BlueprintSection): SectionRef {
  const group = BLUEPRINT_GROUPS.find((item) => item.pages.some((candidate) => candidate.slug === page.slug))!;
  return { group, page, section, key: sectionKey(page, section) };
}

function librarySection(id: string, piece: "issue" | NewsletterPiece, title: string): BlueprintSection {
  const suffix = piece === "issue" ? "" : `-${piece}`;
  return {
    id: `nl-${id}${suffix}`,
    key: `content:nl-${id}${suffix}`,
    title,
    source: "we_build",
  };
}

export function NewsletterPage({ page }: { page: BlueprintLink }) {
  const { payload, knowledge, saveField, putLibrarySection, clearLibrarySection } = usePractice();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIssue, setOpenIssue] = useState<string | null>(null);

  if (!payload || !knowledge) return null;

  const info = page.sections.find((section) => section.id === "info");
  const main = page.sections.find((section) => section.id === "newsletter");
  const analogy = page.sections.find((section) => section.id === "analogy");
  const kpis = page.sections.find((section) => section.id === "kpis");
  const added = (payload.practice.newsletter_added?.value ?? []).filter(isNewsletterLibraryId);

  async function addIssue() {
    const name = title.trim();
    if (!name || busy) return;
    if (added.length >= 20) {
      setError("Twenty issues is the limit.");
      return;
    }
    const id = newsletterLibraryId();
    setBusy(true);
    setError(null);
    const ok = await putLibrarySection(newsletterOverviewKey(id), newsletterStarter(name));
    setBusy(false);
    if (!ok) {
      setError("Could not add that issue.");
      return;
    }
    saveField({ path: "practice.newsletter_added", label: "Issues", kind: "list" }, [...added, id]);
    setTitle("");
    setAdding(false);
    setOpenIssue(id);
  }

  async function removeIssue(id: string) {
    if (busy || !knowledge) return;
    if (!window.confirm("Remove this issue? The text goes with it.")) return;
    const built = knowledge.built_sections;
    setBusy(true);
    setError(null);
    const keys = [newsletterOverviewKey(id), ...(["cover", "inbox", "post", "inmail", "article"] as const).map((piece) => newsletterPieceKey(id, piece))].filter(
      (key) => built[key]
    );
    for (const key of keys) {
      const ok = await clearLibrarySection(key);
      if (!ok) {
        setBusy(false);
        setError("Could not remove that issue.");
        return;
      }
    }
    saveField(
      { path: "practice.newsletter_added", label: "Issues", kind: "list" },
      added.filter((item) => item !== id)
    );
    setBusy(false);
    if (openIssue === id) setOpenIssue(null);
  }

  return (
    <div className="space-y-5">
      {info ? <SectionView sectionRef={sectionRefFor(page, info)} /> : null}

      <section className="overflow-hidden rounded-2xl border border-[#dbe3ec] bg-white shadow-[0_1px_2px_rgba(5,30,54,0.05)] print:rounded-none print:border-0 print:shadow-none">
        <header className="bp-head rounded-t-2xl px-5 py-3 @2xl:px-6">
          <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">Newsletters</h3>
        </header>

        {main ? (
          <IssueRow
            page={page}
            id="main"
            title={issueHeading(knowledge.built_sections["content:newsletter"]?.blocks, "First issue")}
            open={openIssue === "main"}
            onToggle={() => setOpenIssue((current) => (current === "main" ? null : "main"))}
            overview={main}
          />
        ) : null}

        {added.map((id) => (
          <IssueRow
            key={id}
            page={page}
            id={id}
            title={newsletterTitle(knowledge.built_sections[newsletterOverviewKey(id)]?.blocks, "Issue")}
            open={openIssue === id}
            onToggle={() => setOpenIssue((current) => (current === id ? null : id))}
            overview={librarySection(id, "issue", "Content")}
            onRemove={() => void removeIssue(id)}
          />
        ))}

        {analogy && knowledge.built_sections["content:analogy"] ? (
          <IssueRow
            page={page}
            id="analogy"
            title={issueHeading(knowledge.built_sections["content:analogy"]?.blocks, "Analogy")}
            open={openIssue === "analogy"}
            onToggle={() => setOpenIssue((current) => (current === "analogy" ? null : "analogy"))}
            overview={analogy}
            parts={false}
          />
        ) : null}
        {kpis && knowledge.built_sections["content:kpis"] ? (
          <IssueRow
            page={page}
            id="kpis"
            title={issueHeading(knowledge.built_sections["content:kpis"]?.blocks, "KPIs")}
            open={openIssue === "kpis"}
            onToggle={() => setOpenIssue((current) => (current === "kpis" ? null : "kpis"))}
            overview={kpis}
            parts={false}
          />
        ) : null}

        <div className="border-t border-[#e6eaf0] px-5 py-3">
          {adding ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addIssue();
              }}
            >
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title, for example Cash in scaffolding"
                className="min-w-[16rem] flex-1 rounded-lg border border-[#dbe3ec] px-3 py-2 text-sm text-[var(--bp-ink)] outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]"
              />
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setTitle("");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[#f4f7fa]"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add an issue
            </button>
          )}
          {error ? <p className="mt-2 text-sm text-[#9b2c2c]">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}

function IssueRow({
  page,
  id,
  title,
  open,
  onToggle,
  overview,
  parts = true,
  onRemove,
}: {
  page: BlueprintLink;
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  overview: BlueprintSection;
  parts?: boolean;
  onRemove?: () => void;
}) {
  const library = id !== "main" && id !== "analogy" && id !== "kpis";

  return (
    <div className="border-b border-[#e6eaf0]">
      <div className="flex items-center gap-2 px-5 py-3 @2xl:px-6">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748b] transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
          <span className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">{title}</span>
        </button>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="bp-no-print shrink-0 text-xs font-semibold text-[#94a3b8] hover:text-[#9b2c2c]">
            Remove
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-[#e6eaf0]">
          {parts ? (
            PARTS.map((part) => (
              <PartBar
                key={part.piece}
                page={page}
                issueId={library ? id : "main"}
                library={library}
                piece={part.piece}
                title={part.title}
                note={part.note}
                roomy={part.roomy}
                overview={part.piece === "issue" ? overview : undefined}
              />
            ))
          ) : (
            <PartBar
              page={page}
              issueId={id}
              library={false}
              piece="issue"
              title="Content"
              note="What goes out in this issue"
              roomy
              overview={overview}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function PartBar({
  page,
  issueId,
  library,
  piece,
  title,
  note,
  roomy = false,
  overview,
}: {
  page: BlueprintLink;
  issueId: string;
  library: boolean;
  piece: NewsletterPiece | "issue";
  title: string;
  note: string;
  roomy?: boolean;
  overview?: BlueprintSection;
}) {
  const { knowledge, putLibrarySection } = usePractice();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key =
    piece === "issue"
      ? issueId === "analogy" || issueId === "kpis"
        ? `content:${issueId}`
        : newsletterOverviewKey(issueId)
      : newsletterPieceKey(issueId, piece);
  const built = knowledge?.built_sections[key];
  const section =
    overview ??
    (library
      ? librarySection(issueId, piece, title)
      : page.sections.find((item) => item.id === (piece === "issue" ? "newsletter" : piece)));

  return (
    <div className="border-b border-[#d5e0ea] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="bp-subhead flex w-full items-center gap-2 px-5 py-2.5 text-left @2xl:px-6"
      >
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#3d5166] transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
        <span className="text-[0.9375rem] font-semibold text-[#0b1b2e]">{title}</span>
        <span className="text-sm font-normal text-[#5c6b7c]">{note}</span>
      </button>
      {open && section ? (
        library && piece !== "issue" && !built ? (
          <div className="px-5 py-4 @2xl:px-6">
            <p className="text-sm text-[var(--bp-muted)]">Nothing here yet.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void putLibrarySection(key, newsletterPieceStarter(piece)).finally(() => setBusy(false));
              }}
              className="bp-no-print mt-2 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-40"
            >
              Add this
            </button>
          </div>
        ) : (
          <SectionView
            bare
            roomy={roomy}
            emptyHint="Not written yet."
            canWrite={!library}
            sectionRef={sectionRefFor(page, section)}
          />
        )
      ) : null}
    </div>
  );
}
