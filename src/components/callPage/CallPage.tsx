"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  Link2,
  MoveRight,
  NotebookPen,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  X,
} from "lucide-react";
import { figtree, instrumentSerif } from "@/fonts";
import { StartApplyPanelNative } from "@/components/booking/StartApplyPanelNative";
import { ConstraintWheel } from "@/components/beyondlean/v5/ConstraintWheel";
import { Editable, Paragraphs } from "@/components/directoryProfile/Editable";
import type { CallPageContent } from "@/lib/callPage/content";
import { supabaseClient } from "@/lib/supabaseClient";
import "@/components/beyondlean/beyondleanPremium.css";
import "@/components/beyondlean/beyondleanBca.css";
import "@/components/beyondlean/beyondleanV5.css";
import "@/components/beyondlean/v5/pages.css";
import "@/components/beyondlean/v5/how.css";
import "@/components/beyondlean/v5/book.css";
import "./callPage.css";

export type CallPageCoach = {
  slug: string;
  name: string;
  firstName: string;
  photoUrl: string | null;
  /** One line under the name in the hero chip. */
  summary: string | null;
};

export type CallPageCall = { slug: string; name: string; minutes: number };

/** A simple line of work, with the slow step and the pile in front of it. */
const LINE = ["Enquiries", "Quotes", "Orders", "Delivery", "Invoicing"];
const SLOW = 1;
const BOOK_ICONS = [User, NotebookPen, ShieldCheck];

type SaveState = "saved" | "saving" | "error";

/** A two-weight heading whose halves are both editable. */
function Heading2({
  editing,
  id,
  as: Tag = "h2",
  light,
  strong,
  onLight,
  onStrong,
  center = false,
}: {
  editing: boolean;
  id: string;
  as?: "h1" | "h2";
  light: string;
  strong: string;
  onLight: (v: string) => void;
  onStrong: (v: string) => void;
  center?: boolean;
}) {
  return (
    <Tag id={id} className={`v5-h2${center ? " is-center" : ""}`}>
      <Editable
        as="span"
        value={light}
        editing={editing}
        label="Heading, first part"
        placeholder="First part of the heading"
        maxLength={120}
        onCommit={onLight}
      />{" "}
      <Editable
        as="strong"
        value={strong}
        editing={editing}
        label="Heading, bold part"
        placeholder="Bold part of the heading"
        maxLength={120}
        onCommit={onStrong}
      />
    </Tag>
  );
}

/** A list of one-line items: edit each; clear one to remove it; add more while editing. */
function LineList({
  editing,
  items,
  onChange,
  label,
  max,
}: {
  editing: boolean;
  items: string[];
  onChange: (next: string[]) => void;
  label: string;
  max: number;
}) {
  const shown = editing ? items : items.filter((x) => x.trim());
  return (
    <>
      {shown.map((text, i) => (
        <li key={i}>
          <Editable
            as="span"
            value={text}
            editing={editing}
            label={`${label} ${i + 1}`}
            placeholder="Clear this to remove it"
            maxLength={240}
            onCommit={(v) =>
              onChange(
                items.map((x, j) => (j === i ? v : x)).filter((x) => x.trim()),
              )
            }
          />
        </li>
      ))}
      {editing && items.length < max ? (
        <li className="cp-add-row">
          <button
            type="button"
            className="cp-add"
            onClick={() => onChange([...items, "New line"])}
          >
            <Plus aria-hidden /> Add a line
          </button>
        </li>
      ) : null}
    </>
  );
}

/**
 * A coach's first-call page, built like Paul's /beyondlean/constraint-call: the promise,
 * why effort hasn't moved it, the booking card, what they leave with, how the call goes,
 * who it's for, questions. Every word is the coach's (Ava drafts it from their Blueprint);
 * signed in, the coach edits it in place.
 */
export function CallPage({
  coach,
  call,
  initial,
  hasSaved,
  forceLive,
}: {
  coach: CallPageCoach;
  call: CallPageCall;
  initial: CallPageContent;
  /** False while the page still shows the default words. */
  hasSaved: boolean;
  forceLive: boolean;
}) {
  const [c, setC] = useState<CallPageContent>(initial);
  const [editor, setEditor] = useState<{
    actingAsAdmin: boolean;
    coachId: string;
  } | null>(null);
  const [mode, setMode] = useState<"edit" | "live">("live");
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saved, setSaved] = useState(hasSaved);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const api = `/api/coach/call-page?slug=${encodeURIComponent(coach.slug)}`;

  useEffect(() => {
    if (forceLive) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(api, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (cancelled || !res?.ok) return;
      const body = (await res.json()) as {
        actingAsAdmin: boolean;
        coachId: string;
      };
      setEditor(body);
      setMode(body.actingAsAdmin ? "live" : "edit");
    })();
    return () => {
      cancelled = true;
    };
  }, [api, forceLive]);

  const headers = useCallback(async () => {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token)
      throw new Error(
        "You have been signed out. Sign in again to keep editing.",
      );
    const h: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (editor?.actingAsAdmin) h["x-impersonate-coach-id"] = editor.coachId;
    return h;
  }, [editor]);

  /** Saves the whole page; saves run one at a time so the last one wins. */
  const persist = useCallback(
    (next: CallPageContent) => {
      setSave("saving");
      setError(null);
      const run = queue.current.then(async () => {
        try {
          const res = await fetch(api, {
            method: "PATCH",
            headers: await headers(),
            body: JSON.stringify({ sales: next }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!res.ok)
            throw new Error(body.error || "That did not save. Try again.");
          setSave("saved");
          setSaved(true);
        } catch (err) {
          setSave("error");
          setError(
            err instanceof Error && err.message
              ? err.message
              : "That did not save.",
          );
        }
      });
      queue.current = run;
    },
    [api, headers],
  );

  /** Change one part of the page and save it. */
  function update(fn: (draft: CallPageContent) => void) {
    setC((prev) => {
      const next = structuredClone(prev);
      fn(next);
      persist(next);
      return next;
    });
  }

  async function draftWithAva() {
    if (drafting) return;
    if (
      saved &&
      !window.confirm(
        "Ava will rewrite every word on this page from your Blueprint. Carry on?",
      )
    ) {
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/call-page/draft?slug=${encodeURIComponent(coach.slug)}`,
        {
          method: "POST",
          headers: await headers(),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        content?: CallPageContent;
        error?: string;
      };
      if (!res.ok || !body.content)
        throw new Error(
          body.error || "Ava could not draft the page. Try again.",
        );
      setC(body.content);
      persist(body.content);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Ava could not draft the page.",
      );
    } finally {
      setDrafting(false);
    }
  }

  const editing = Boolean(editor) && mode === "edit";
  const bookHref = "#book";
  const pagePath = `/call/${encodeURIComponent(coach.slug)}`;

  return (
    <div
      className={`bp-root bp-bca v5-root cp-root ${figtree.variable} ${instrumentSerif.variable}${
        editing ? " cp--editing" : ""
      }`}
    >
      <header className="cp-top">
        <div className="v5-wrap cp-top-inner">
          <span className="cp-top-coach">
            {coach.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coach.photoUrl} alt="" width={40} height={40} />
            ) : null}
            <strong>{coach.name}</strong>
          </span>
          <a className="cp-top-cta" href={bookHref}>
            Book your call <MoveRight aria-hidden />
          </a>
        </div>
      </header>

      <main>
        {/* The promise, with the wheel that shows it. */}
        <section className="v5-cc-hero cp-hero" aria-labelledby="cp-title">
          <div className="v5-hero-beams" aria-hidden />
          <div className="v5-wrap v5-cc-hero-grid">
            <div className="v5-cc-hero-copy">
              <p className="v5-badge is-outline">
                <Target aria-hidden /> The {call.name}
              </p>
              <Heading2
                editing={editing}
                as="h1"
                id="cp-title"
                light={c.hero.light}
                strong={c.hero.strong}
                onLight={(v) => update((d) => void (d.hero.light = v))}
                onStrong={(v) => update((d) => void (d.hero.strong = v))}
              />
              <Editable
                className="v5-page-lede"
                value={c.hero.lede}
                editing={editing}
                label="Opening line"
                placeholder="A few lines on what the call does for them"
                multiline
                maxLength={600}
                onCommit={(v) => update((d) => void (d.hero.lede = v))}
              />
              <div className="v5-cc-hero-actions">
                <a className="v5-cta-btn" href={bookHref}>
                  Pick a Time <MoveRight aria-hidden />
                </a>
                <ul className="v5-cc-facts">
                  <li>
                    <Clock aria-hidden /> {call.minutes} minutes
                  </li>
                  <li>
                    <User aria-hidden /> One to one
                  </li>
                  <li>
                    <Check aria-hidden /> Free
                  </li>
                </ul>
              </div>
            </div>
            <figure className="v5-cc-hero-wheel">
              <ConstraintWheel dark ground="#0a2d57" />
              <figcaption className="v5-glass v5-cc-chip is-areas">
                <strong>10 areas</strong>
                <span>checked in a set order</span>
              </figcaption>
              <div className="v5-glass v5-cc-chip is-paul">
                {coach.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coach.photoUrl} alt="" width={96} height={96} />
                ) : null}
                <span>
                  <strong>With {coach.name}</strong>
                  {coach.summary ? (
                    <span className="cp-chip-line">{coach.summary}</span>
                  ) : null}
                </span>
              </div>
            </figure>
          </div>
        </section>

        {/* Why more effort hasn't moved it: the slow step sets the pace. */}
        <section className="v5-section v5-white" aria-labelledby="cp-why-title">
          <div className="v5-wrap v5-cc-split">
            <div>
              <Heading2
                editing={editing}
                id="cp-why-title"
                light={c.why.light}
                strong={c.why.strong}
                onLight={(v) => update((d) => void (d.why.light = v))}
                onStrong={(v) => update((d) => void (d.why.strong = v))}
              />
              <Editable
                className="cp-prose"
                value={c.why.body}
                editing={editing}
                paragraphs
                multiline
                label="Why more effort hasn't worked"
                placeholder="Leave a blank line between paragraphs"
                maxLength={3000}
                onCommit={(v) => update((d) => void (d.why.body = v))}
              />
            </div>
            <figure
              className="v5-cc-line"
              aria-label="A line of work where quotes are the slow step and work piles up in front of it"
            >
              <ol>
                {LINE.map((name, i) => (
                  <li
                    key={name}
                    className={
                      i === SLOW
                        ? "is-slow"
                        : i < SLOW
                          ? "is-before"
                          : undefined
                    }
                  >
                    {i === SLOW && (
                      <span className="v5-cc-pile" aria-hidden>
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    <span className="v5-cc-station">{name}</span>
                    {i === SLOW && (
                      <span className="v5-cc-slow-tag">Your constraint</span>
                    )}
                  </li>
                ))}
              </ol>
              <figcaption>
                Speed up any other step and the pile just grows.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* The booking card, third on the page. */}
        <section
          className="v5-bk is-blue"
          id="book"
          aria-labelledby="cp-book-title"
        >
          <div className="v5-hero-beams" aria-hidden />
          <div className="v5-wrap v5-bk-grid">
            <div className="v5-bk-head">
              <Heading2
                editing={editing}
                id="cp-book-title"
                light={c.book.light}
                strong={c.book.strong}
                onLight={(v) => update((d) => void (d.book.light = v))}
                onStrong={(v) => update((d) => void (d.book.strong = v))}
              />
              <Editable
                value={c.book.line}
                editing={editing}
                label="Line under the booking heading"
                placeholder="One line on why to book now"
                multiline
                maxLength={300}
                onCommit={(v) => update((d) => void (d.book.line = v))}
              />
            </div>
            <div className="v5-bk-form">
              <StartApplyPanelNative
                variant="page"
                intent="owner"
                enableLeadCapture
                slug={coach.slug}
                calendarSlug={call.slug}
                title={`Book your ${call.name}`}
                lead="Tell me a bit about your business, then pick a time."
              />
            </div>
            <div className="v5-bk-trust">
              <ul className="v5-bk-points">
                {c.book.points.map((text, i) => {
                  const Icon = BOOK_ICONS[i % BOOK_ICONS.length];
                  return (
                    <li key={i}>
                      <Icon aria-hidden />
                      <Editable
                        as="span"
                        value={text}
                        editing={editing}
                        label={`Booking point ${i + 1}`}
                        placeholder="A short promise"
                        maxLength={80}
                        onCommit={(v) =>
                          update((d) => {
                            d.book.points[i] = v;
                            d.book.points = d.book.points.filter((x) =>
                              x.trim(),
                            );
                          })
                        }
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="v5-bk-paul">
                {coach.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coach.photoUrl} alt="" width={104} height={104} />
                ) : null}
                <span>
                  <strong>{coach.name}</strong>
                  {coach.summary ?? ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* What they walk away with. */}
        <section className="v5-section v5-soft" aria-labelledby="cp-done-title">
          <div className="v5-wrap">
            <div className="v5-head">
              <Heading2
                editing={editing}
                id="cp-done-title"
                light={c.done.light}
                strong={c.done.strong}
                onLight={(v) => update((d) => void (d.done.light = v))}
                onStrong={(v) => update((d) => void (d.done.strong = v))}
              />
              <Editable
                value={c.done.intro}
                editing={editing}
                label="How the call works"
                placeholder="How you work out the answer"
                multiline
                maxLength={800}
                onCommit={(v) => update((d) => void (d.done.intro = v))}
              />
            </div>
            <ol className="v5-cc-takeaways">
              {c.done.takeaways.map((t, i) => (
                <li key={i}>
                  <span className="v5-cc-num" aria-hidden>
                    {i + 1}
                  </span>
                  <Editable
                    as="h3"
                    value={t.title}
                    editing={editing}
                    label={`What they leave with ${i + 1}`}
                    placeholder="What they leave with"
                    maxLength={100}
                    onCommit={(v) =>
                      update((d) => void (d.done.takeaways[i].title = v))
                    }
                  />
                  <Editable
                    value={t.text}
                    editing={editing}
                    label={`What they leave with ${i + 1}, detail`}
                    placeholder="One line of detail"
                    multiline
                    maxLength={240}
                    onCommit={(v) =>
                      update((d) => void (d.done.takeaways[i].text = v))
                    }
                  />
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How the call goes, and why this coach. */}
        <section
          className="v5-section v5-white"
          aria-labelledby="cp-about-title"
        >
          <div className="v5-wrap v5-cc-split is-top">
            <div className="v5-how-visual v5-how-call">
              <p className="v5-how-label">The {call.minutes} minutes</p>
              <ol className="v5-how-agenda">
                {c.agenda.map((a, i) => (
                  <li key={i}>
                    <span className="v5-how-agenda-num" aria-hidden>
                      {i + 1}
                    </span>
                    <div>
                      <Editable
                        as="strong"
                        value={a.title}
                        editing={editing}
                        label={`Call step ${i + 1}`}
                        placeholder="Step"
                        maxLength={80}
                        onCommit={(v) =>
                          update((d) => void (d.agenda[i].title = v))
                        }
                      />
                      <Editable
                        as="span"
                        value={a.text}
                        editing={editing}
                        label={`Call step ${i + 1}, detail`}
                        placeholder="One line"
                        maxLength={160}
                        onCommit={(v) =>
                          update((d) => void (d.agenda[i].text = v))
                        }
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Heading2
                editing={editing}
                id="cp-about-title"
                light={c.about.light}
                strong={c.about.strong}
                onLight={(v) => update((d) => void (d.about.light = v))}
                onStrong={(v) => update((d) => void (d.about.strong = v))}
              />
              <Editable
                className="cp-prose"
                value={c.about.body}
                editing={editing}
                paragraphs
                multiline
                label="About you"
                placeholder="Your background in a few lines: what you've done and who for"
                maxLength={3000}
                onCommit={(v) => update((d) => void (d.about.body = v))}
              />
              {c.about.proof.trim() || editing ? (
                <blockquote className="v5-cc-proof">
                  <Editable
                    value={c.about.proof}
                    editing={editing}
                    multiline
                    label="One real result"
                    placeholder="One real result, with numbers if you have them (optional)"
                    maxLength={1500}
                    onCommit={(v) => update((d) => void (d.about.proof = v))}
                  />
                  <footer>
                    {coach.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coach.photoUrl} alt="" width={96} height={96} />
                    ) : null}
                    <span>
                      <strong>{coach.name}</strong>
                    </span>
                  </footer>
                </blockquote>
              ) : null}
            </div>
          </div>
        </section>

        {/* Who it's for. */}
        <section className="v5-section v5-soft" aria-labelledby="cp-fit-title">
          <div className="v5-wrap">
            <div className="v5-head is-center">
              <Heading2
                editing={editing}
                id="cp-fit-title"
                center
                light={c.fit.light}
                strong={c.fit.strong}
                onLight={(v) => update((d) => void (d.fit.light = v))}
                onStrong={(v) => update((d) => void (d.fit.strong = v))}
              />
              <Editable
                value={c.fit.intro}
                editing={editing}
                label="Who it's for, intro"
                placeholder="One line before the lists"
                multiline
                maxLength={400}
                onCommit={(v) => update((d) => void (d.fit.intro = v))}
              />
            </div>
            <div className="v5-fit">
              <div className="v5-fit-card is-yes">
                <h3>
                  <Check aria-hidden /> This is for you if
                </h3>
                <ul>
                  <LineList
                    editing={editing}
                    items={c.fit.forYou}
                    max={6}
                    label="For you if"
                    onChange={(next) =>
                      update((d) => void (d.fit.forYou = next))
                    }
                  />
                </ul>
              </div>
              <div className="v5-fit-card">
                <h3>
                  <X aria-hidden /> This is not for you if
                </h3>
                <ul>
                  <LineList
                    editing={editing}
                    items={c.fit.notForYou}
                    max={6}
                    label="Not for you if"
                    onChange={(next) =>
                      update((d) => void (d.fit.notForYou = next))
                    }
                  />
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Questions before they book. */}
        <section className="v5-section v5-white" aria-labelledby="cp-faq-title">
          <div className="v5-wrap v5-cc-faq">
            <div className="v5-head is-center">
              <h2 id="cp-faq-title" className="v5-h2 is-center">
                <span>Before you</span> <strong>book.</strong>
              </h2>
            </div>
            <div className="v5-faq2-list">
              {c.faq.map((f, i) =>
                editing ? (
                  <div key={i} className="cp-faq-edit">
                    <Editable
                      as="p"
                      className="cp-faq-q"
                      value={f.q}
                      editing
                      label={`Question ${i + 1}`}
                      placeholder="Clear the question and answer to remove it"
                      maxLength={160}
                      onCommit={(v) =>
                        update((d) => {
                          d.faq[i].q = v;
                          d.faq = d.faq.filter((x) => x.q.trim() || x.a.trim());
                        })
                      }
                    />
                    <Editable
                      value={f.a}
                      editing
                      multiline
                      label={`Answer ${i + 1}`}
                      placeholder="The answer"
                      maxLength={600}
                      onCommit={(v) =>
                        update((d) => {
                          d.faq[i].a = v;
                          d.faq = d.faq.filter((x) => x.q.trim() || x.a.trim());
                        })
                      }
                    />
                  </div>
                ) : f.q.trim() ? (
                  <details key={i} open={i === 0}>
                    <summary>
                      {f.q}
                      <span className="v5-faq2-ic" aria-hidden>
                        <Plus />
                      </span>
                    </summary>
                    <Paragraphs text={f.a} />
                  </details>
                ) : null,
              )}
              {editing && c.faq.length < 8 ? (
                <button
                  type="button"
                  className="cp-add"
                  onClick={() =>
                    update(
                      (d) =>
                        void d.faq.push({
                          q: "New question?",
                          a: "The answer.",
                        }),
                    )
                  }
                >
                  <Plus aria-hidden /> Add a question
                </button>
              ) : null}
            </div>
            <div className="v5-cc-faq-cta">
              <a className="v5-cta-btn" href={bookHref}>
                Book Your {call.name} <MoveRight aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>

      {editor ? (
        <>
          {error ? (
            <p className="cb-toolbar-error cp-toolbar-error" role="alert">
              {error}
            </p>
          ) : null}
          <div
            className="cp-toolbar"
            role="toolbar"
            aria-label="Edit your call page"
          >
            <span
              className="cp-toolbar__status"
              data-state={drafting ? "saving" : save}
              aria-live="polite"
            >
              <i aria-hidden />
              {drafting
                ? "Ava is writing…"
                : save === "saving"
                  ? "Saving…"
                  : save === "error"
                    ? "Not saved"
                    : saved
                      ? "Saved"
                      : "Starter words"}
            </span>
            <span className="cp-seg">
              <button
                type="button"
                aria-pressed={mode === "edit"}
                onClick={() => setMode("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                aria-pressed={mode === "live"}
                onClick={() => setMode("live")}
              >
                Live view
              </button>
            </span>
            <button
              type="button"
              className="cp-tbtn"
              onClick={() => void draftWithAva()}
              disabled={drafting}
            >
              <Sparkles aria-hidden />
              {saved ? "Ava, redraft" : "Ava, draft it"}
            </button>
            <button
              type="button"
              className="cp-tbtn"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${window.location.origin}${pagePath}`)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  });
              }}
            >
              {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              className="cp-tbtn cp-tbtn--wide"
              href={`${pagePath}?view=live`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              Open live page
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
