"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Camera,
  Info,
  Pencil,
  Move,
  MapPin,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CampaignOnOffToggle } from "@/components/campaigns/CampaignOnOffToggle";
import { Graphic } from "@/components/coachSite/Graphic";
import type { InlineGraphic } from "@/lib/coachSite/graphics";
import {
  DEFAULT_PHOTO_FOCUS,
  LIMITS,
  type CareerRow,
  type DirectoryCoachView,
  type ResultRow,
  type SectionKey,
} from "@/lib/directoryPage/types";
import { SOCIAL_NETWORK_META, type SocialNetwork } from "@/lib/shareLinks/socials";
import { Editable, Paragraphs } from "./Editable";
import { IntroVideo } from "./IntroVideo";

export type ProfileFields = Partial<{
  directory_summary: string;
  directory_bio: string;
  coach_business_name: string;
  location: string;
  directory_listed: boolean;
}>;

export type ProfileActions = {
  profile: (fields: ProfileFields) => void;
  extras: (patch: Record<string, unknown>) => Promise<DirectoryCoachView | null>;
  socials: (patch: { linkedin_url?: string; social_links?: Record<string, string> }) => Promise<string | null>;
  photo: (file: File) => Promise<string | null>;
  video: (file: File) => Promise<string | null>;
  draftBio: () => Promise<void>;
  drafting: boolean;
};

const LEVEL_LABEL: Record<string, string> = {
  certified: "Certified coach",
  professional: "Professional coach",
  elite: "Elite coach",
};

const SOCIAL_ORDER: Exclude<SocialNetwork, "linkedin">[] = [
  "website",
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "x",
];

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

type Keyed<T> = T & { key: string };

function keyed<T extends object>(rows: T[]): Keyed<T>[] {
  return rows.map((r) => ({ ...r, key: nextKey() }));
}

function strip<T extends object>(rows: Keyed<T>[]): T[] {
  return rows.map((r) => {
    const copy: Partial<Keyed<T>> = { ...r };
    delete copy.key;
    return copy as T;
  });
}

export function bookingHrefFor(view: DirectoryCoachView): string | null {
  if (view.extras.booking_url) return view.extras.booking_url;
  return view.hasCalendar ? `/book/${encodeURIComponent(view.slug)}` : null;
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

type Visibility = { hidden: boolean; setHidden: (hide: boolean) => void };

function visibility(view: DirectoryCoachView, actions: ProfileActions, key: SectionKey): Visibility {
  const list = view.extras.hidden ?? [];
  return {
    hidden: list.includes(key),
    setHidden: (hide) =>
      void actions.extras({ hidden: hide ? [...list.filter((k) => k !== key), key] : list.filter((k) => k !== key) }),
  };
}

/**
 * A section heading. While editing it carries a Shown / Hidden switch: an
 * empty section cannot be shown, so trying says why and puts the cursor in it.
 */
function SectionHead({
  id,
  editing,
  filled,
  vis,
  children,
}: {
  id: string;
  editing: boolean;
  filled: boolean;
  vis: Visibility;
  children: React.ReactNode;
}) {
  const [warn, setWarn] = useState(false);
  const head = useRef<HTMLDivElement>(null);
  const heading = (
    <h2 className="dp-h2" id={id}>
      {children}
    </h2>
  );
  if (!editing) return heading;
  const on = filled && !vis.hidden;
  return (
    <div className="dp-head" ref={head}>
      {heading}
      <CampaignOnOffToggle
        size="sm"
        on={on}
        ariaLabel={on ? "On your live page. Switch off to hide it" : "Off your live page. Switch on to show it"}
        onChange={() => {
          if (!filled) {
            setWarn(true);
            head.current?.closest("section")?.querySelector<HTMLElement>("textarea, input")?.focus();
            return;
          }
          setWarn(false);
          vis.setHidden(on);
        }}
      />
      {warn && !filled ? (
        <p className="dp-vis-warn" role="status">
          <Info aria-hidden />
          Add something below first. This stays hidden on your live page until you do.
        </p>
      ) : null}
    </div>
  );
}

/** A long bio folds after a few paragraphs on the live page. */
function Folded({ text, first }: { text: string; first: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`dp-prose${open ? "" : " dp-fold"}`} id="dp-about-text">
        <Paragraphs text={text} />
      </div>
      <button
        type="button"
        className="dp-linkbtn dp-more"
        aria-expanded={open}
        aria-controls="dp-about-text"
        onClick={() => setOpen(!open)}
      >
        {open ? "Show less" : `Read more about ${first}`}
      </button>
    </>
  );
}

function Photo({
  view,
  editing,
  actions,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
}) {
  const saved = view.extras.photo_focus ?? DEFAULT_PHOTO_FOCUS;
  const [focus, setFocus] = useState(saved);
  const [seen, setSeen] = useState(saved);
  if (saved.x !== seen.x || saved.y !== seen.y) {
    setSeen(saved);
    setFocus(saved);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editing || !view.avatarUrl || (e.target as HTMLElement).closest("button")) return;
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, fx: focus.x, fy: focus.y, w: box.width, h: box.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Dragging the photo right shows more of its left side.
    setFocus({
      x: clamp(d.fx - ((e.clientX - d.x) / d.w) * 160),
      y: clamp(d.fy - ((e.clientY - d.y) / d.h) * 160),
    });
  }

  function up() {
    if (!drag.current) return;
    drag.current = null;
    if (focus.x !== saved.x || focus.y !== saved.y) {
      void actions.extras({ photo_focus: { x: focus.x, y: focus.y } });
    }
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setError("That photo is over 2MB. Try a smaller one.");
      return;
    }
    setError(null);
    setBusy(true);
    const err = await actions.photo(f);
    setBusy(false);
    if (err) setError(err);
  }

  const initials = view.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`dp-photo${editing && view.avatarUrl ? " dp-photo--edit" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {view.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- coach photos come from Supabase storage
        <img
          src={view.avatarUrl}
          alt={`${view.name}`}
          draggable={false}
          style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
        />
      ) : (
        <div className="dp-monogram" aria-hidden>
          {initials}
        </div>
      )}
      {editing ? (
        <>
          <div className="dp-photo-tools">
            <button type="button" className="dp-chip" onClick={() => file.current?.click()} disabled={busy}>
              <Camera aria-hidden />
              {busy ? "Uploading…" : view.avatarUrl ? "Change photo" : "Add a photo"}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {view.avatarUrl ? (
            <span className="dp-chip dp-drag-hint">
              <Move aria-hidden />
              Drag to move your photo
            </span>
          ) : null}
          {error ? (
            <p className="dp-photo-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Socials({ view, editing, actions }: { view: DirectoryCoachView; editing: boolean; actions: ProfileActions }) {
  const [open, setOpen] = useState(false);
  const links: { label: string; href: string }[] = [];
  if (view.linkedinUrl) links.push({ label: "LinkedIn", href: view.linkedinUrl });
  for (const key of SOCIAL_ORDER) {
    const href = view.socials[key];
    if (href) links.push({ label: SOCIAL_NETWORK_META[key].label, href });
  }
  if (!links.length && !editing) return null;
  return (
    <>
      <ul className="dp-socials" aria-label={`${view.firstName} online`}>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
              <ArrowUpRight aria-hidden />
            </a>
          </li>
        ))}
        {editing ? (
          <li className="dp-socials__edit">
            <button type="button" onClick={() => setOpen(true)}>
              <Pencil aria-hidden />
              {links.length ? "Edit links" : "Add your links"}
            </button>
          </li>
        ) : null}
      </ul>
      {open ? <LinksModal view={view} actions={actions} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Booking link and socials, in a modal so the edit page keeps the live page's shape. */
function LinksModal({
  view,
  actions,
  onClose,
}: {
  view: DirectoryCoachView;
  actions: ProfileActions;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const [values, setValues] = useState<Record<string, string>>(() => ({
    booking_url: view.extras.booking_url ?? "",
    linkedin: view.linkedinUrl ?? "",
    ...Object.fromEntries(SOCIAL_ORDER.map((k) => [k, view.socials[k] ?? ""])),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function commit(key: string) {
    const value = values[key].trim();
    let err: string | null = null;
    if (key === "booking_url") {
      if (value === (view.extras.booking_url ?? "")) return;
      const next = await actions.extras({ booking_url: value });
      if (!next) err = "That booking link does not look right. Paste the full link.";
    } else if (key === "linkedin") {
      if (value === (view.linkedinUrl ?? "")) return;
      err = await actions.socials({ linkedin_url: value });
    } else {
      if (value === (view.socials[key as keyof typeof view.socials] ?? "")) return;
      const all = Object.fromEntries(SOCIAL_ORDER.map((k) => [k, k === key ? value : (view.socials[k] ?? "")]));
      err = await actions.socials({ social_links: all });
    }
    setErrors((e) => ({ ...e, [key]: err ?? "" }));
  }

  const field = (key: string, label: string, placeholder: string, hint?: string, wide?: boolean) => (
    <label className={`dp-input${wide ? " dp-input--wide" : ""}`} key={key}>
      {label}
      <input
        type="url"
        inputMode="url"
        value={values[key]}
        placeholder={placeholder}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        onBlur={() => void commit(key)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      {errors[key] ? <span className="dp-field-error">{errors[key]}</span> : hint ? <small>{hint}</small> : null}
    </label>
  );

  return createPortal(
    <div className="dp-portal dp-sheet" onClick={onClose}>
      <section
        className="dp-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-links-h"
        onClick={(e) => e.stopPropagation()}
      >
      <h2 className="dp-h2" id="dp-links-h">
        <span>Your</span> buttons and links
      </h2>
      <p>Empty links stay off your page.</p>
      <div className="dp-links">
        {field(
          "booking_url",
          "Booking link",
          "https://calendly.com/you/intro-call",
          view.hasCalendar
            ? "Leave empty to use your Profit Coach calendar."
            : "Add a link so owners can book a call with you.",
          true
        )}
        {field("linkedin", "LinkedIn", SOCIAL_NETWORK_META.linkedin.placeholder)}
        {SOCIAL_ORDER.map((k) => field(k, SOCIAL_NETWORK_META[k].label, SOCIAL_NETWORK_META[k].placeholder))}
      </div>
      <div className="dp-sheet__foot">
        <button type="button" className="dp-btn dp-btn--navy" onClick={onClose}>
          Done
        </button>
      </div>
      </section>
    </div>,
    document.body
  );
}

function Industries({
  view,
  editing,
  actions,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
}) {
  const [list, setList] = useState<string[]>(view.extras.industries ?? []);
  const [draft, setDraft] = useState("");
  const shown = editing ? list : (view.extras.industries ?? []);

  function save(next: string[]) {
    setList(next);
    void actions.extras({ industries: next });
  }

  function add() {
    const v = draft.trim().slice(0, LIMITS.industry);
    if (!v || list.some((i) => i.toLowerCase() === v.toLowerCase()) || list.length >= LIMITS.industries) return;
    setDraft("");
    save([...list, v]);
  }

  if (!editing && !shown.length) return null;
  return (
    <>
      <ul className="dp-tags" aria-label="Sectors">
        {shown.map((i) => (
          <li key={i} className="dp-tag">
            {i}
            {editing ? (
              <button type="button" aria-label={`Remove ${i}`} onClick={() => save(list.filter((x) => x !== i))}>
                <X aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
        {editing && list.length < LIMITS.industries ? (
          <li>
            <input
              className="dp-industry-input"
              value={draft}
              maxLength={LIMITS.industry}
              placeholder={list.length ? "Add another sector" : "Add a sector, like Engineering"}
              aria-label="Add a sector"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  add();
                }
              }}
              onBlur={add}
            />
          </li>
        ) : null}
      </ul>
      {editing && view.extras.industries_suggested && list.length ? (
        <p className="dp-source">Suggested from your bio and LinkedIn. Remove any that do not fit.</p>
      ) : null}
    </>
  );
}

function Career({
  view,
  editing,
  actions,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
}) {
  const [rows, setRows] = useState<Keyed<CareerRow>[]>(() => keyed(view.career));
  const shown = editing ? rows : view.career;
  const vis = visibility(view, actions, "career");
  if (!editing && (!shown.length || vis.hidden)) return null;

  function save(next: Keyed<CareerRow>[]) {
    setRows(next);
    void actions.extras({ career: strip(next).filter((r) => r.title || r.company) });
  }

  function change(key: string, patch: Partial<CareerRow>) {
    save(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function reset() {
    const next = await actions.extras({ career: null });
    if (next) setRows(keyed(next.career));
  }

  return (
    <section className={`dp-section${editing && vis.hidden ? " dp-section--off" : ""}`} aria-labelledby="dp-career-h">
      <SectionHead id="dp-career-h" editing={editing} filled={view.career.length > 0} vis={vis}>
        <span>Where {view.firstName}</span> has worked
      </SectionHead>
      {shown.length ? (
        <ol className="dp-ledger">
          {editing
            ? rows.map((r) => (
                <li key={r.key}>
                  <Editable
                    editing
                    as="span"
                    className="dp-ledger__years"
                    value={r.years}
                    label="Years"
                    placeholder="2015 to 2021"
                    maxLength={LIMITS.years}
                    onCommit={(years) => change(r.key, { years })}
                  />
                  <span className="dp-ledger__role">
                    <Editable
                      editing
                      as="span"
                      className="dp-ledger__title"
                      value={r.title}
                      label="Role"
                      placeholder="Your role"
                      maxLength={LIMITS.title}
                      onCommit={(title) => change(r.key, { title })}
                    />
                    <Editable
                      editing
                      as="span"
                      className="dp-ledger__company"
                      value={r.company}
                      label="Company"
                      placeholder="Company"
                      maxLength={LIMITS.company}
                      onCommit={(company) => change(r.key, { company })}
                    />
                  </span>
                  <span className="dp-row-tools">
                    <button
                      type="button"
                      className="dp-iconbtn"
                      aria-label={`Remove ${r.title || "this role"}`}
                      onClick={() => save(rows.filter((x) => x.key !== r.key))}
                    >
                      <X aria-hidden />
                    </button>
                  </span>
                </li>
              ))
            : view.career.map((r, i) => (
                <li key={i}>
                  <span className="dp-ledger__years">{r.years}</span>
                  <span className="dp-ledger__role">
                    <span className="dp-ledger__title">{r.title}</span>
                    <span className="dp-ledger__company">{r.company}</span>
                  </span>
                </li>
              ))}
        </ol>
      ) : (
        <div className="dp-prompt">
          <p>Owners want to know what you did before coaching. Add the roles that matter most.</p>
        </div>
      )}
      {editing ? (
        <div className="dp-tools">
          {rows.length < LIMITS.career ? (
            <button
              type="button"
              className="dp-addbtn"
              onClick={() => setRows([...rows, { title: "", company: "", years: "", key: nextKey() }])}
            >
              <Plus aria-hidden />
              Add a role
            </button>
          ) : null}
          {view.careerFromLinkedIn ? (
            <span className="dp-source">From your LinkedIn profile. Change or remove any line.</span>
          ) : view.extras.career !== undefined ? (
            <button type="button" className="dp-linkbtn" onClick={() => void reset()}>
              Start again from my LinkedIn
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Results({
  view,
  editing,
  actions,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
}) {
  const [rows, setRows] = useState<Keyed<ResultRow>[]>(() => keyed(view.extras.results ?? []));
  const live = view.extras.results ?? [];
  const vis = visibility(view, actions, "results");
  if (!editing && (!live.length || vis.hidden)) return null;

  function save(next: Keyed<ResultRow>[]) {
    setRows(next);
    void actions.extras({ results: strip(next).filter((r) => r.quote || r.outcome) });
  }

  function change(key: string, patch: Partial<ResultRow>) {
    save(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const blank = (): Keyed<ResultRow> => ({ quote: "", name: "", role: "", outcome: "", key: nextKey() });

  return (
    <section className={`dp-section${editing && vis.hidden ? " dp-section--off" : ""}`} aria-labelledby="dp-results-h">
      <SectionHead id="dp-results-h" editing={editing} filled={live.length > 0} vis={vis}>
        <span>Client</span> results
      </SectionHead>
      {editing ? (
        <>
          {rows.length ? (
            <div className="dp-results">
              {rows.map((r) => (
                <figure className="dp-result" key={r.key}>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Editable
                        editing
                        as="strong"
                        className="dp-result__outcome"
                        value={r.outcome}
                        label="The result"
                        placeholder="The result, like Profit up 22%"
                        maxLength={LIMITS.outcome}
                        onCommit={(outcome) => change(r.key, { outcome })}
                      />
                    </div>
                    <button
                      type="button"
                      className="dp-iconbtn"
                      aria-label="Remove this result"
                      onClick={() => save(rows.filter((x) => x.key !== r.key))}
                    >
                      <X aria-hidden />
                    </button>
                  </div>
                  <blockquote>
                    <Editable
                      editing
                      multiline
                      value={r.quote}
                      label="What your client said"
                      placeholder="What your client said, in their words"
                      maxLength={LIMITS.quote}
                      onCommit={(quote) => change(r.key, { quote })}
                    />
                  </blockquote>
                  <figcaption>
                    <Editable
                      editing
                      as="strong"
                      value={r.name}
                      label="Client name"
                      placeholder="Client name"
                      maxLength={LIMITS.name}
                      onCommit={(name) => change(r.key, { name })}
                    />
                    <Editable
                      editing
                      as="span"
                      value={r.role}
                      label="Their role and business"
                      placeholder="Their role and business, like MD, Hale Engineering"
                      maxLength={LIMITS.role}
                      onCommit={(role) => change(r.key, { role })}
                    />
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="dp-prompt">
              <p>
                Results win clients. Add what changed for a client and a few words from them. Only add what
                your client is happy to share.
              </p>
            </div>
          )}
          {rows.length < LIMITS.results ? (
            <div className="dp-tools">
              <button type="button" className="dp-addbtn" onClick={() => setRows([...rows, blank()])}>
                <Plus aria-hidden />
                Add a client result
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="dp-results">
          {live.map((r, i) => (
            <figure className="dp-result" key={i}>
              {r.outcome ? <strong className="dp-result__outcome">{r.outcome}</strong> : null}
              {r.quote ? <blockquote>&ldquo;{r.quote}&rdquo;</blockquote> : null}
              {r.name || r.role ? (
                <figcaption>
                  {r.name ? <strong>{r.name}</strong> : null}
                  {r.name && r.role ? ", " : null}
                  {r.role}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProfileBody({
  view,
  editing,
  actions,
  wheel,
}: {
  view: DirectoryCoachView;
  editing: boolean;
  actions: ProfileActions;
  wheel: InlineGraphic;
}) {
  const booking = bookingHrefFor(view);
  const scoreHref = `/score/${encodeURIComponent(view.slug)}`;
  const first = view.firstName;
  const lastName = view.name.slice(view.name.indexOf(first) + first.length).trim();
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el || editing) return;
    const io = new IntersectionObserver(([entry]) =>
      setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    io.observe(el);
    return () => io.disconnect();
  }, [editing]);

  const ext = (href: string) => (isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});
  const levelLabel = view.level ? LEVEL_LABEL[view.level.toLowerCase()] : null;
  const about = visibility(view, actions, "about");
  const serves = visibility(view, actions, "serves");
  const servesFilled = Boolean(view.extras.serves || view.extras.industries?.length);

  return (
    <>
      <aside className="dp-aside" aria-label={view.name}>
        <Photo view={view} editing={editing} actions={actions} />
        <div className="dp-id">
          {levelLabel ? (
            <span className="dp-level">
              <BadgeCheck aria-hidden />
              {levelLabel}
            </span>
          ) : null}
          <div className="dp-name-row">
            <h1 className="dp-name">
              {lastName ? (
                <>
                  <span>{first}</span>
                  <strong>{lastName}</strong>
                </>
              ) : (
                <strong>{view.name}</strong>
              )}
            </h1>
            <IntroVideo view={view} editing={editing} actions={actions} />
          </div>
          {editing ? (
            <div className="dp-meta" style={{ display: "grid", gap: "0.6rem" }}>
              <Editable
                editing
                as="span"
                value={view.business ?? ""}
                label="Business name"
                placeholder="Your business name"
                maxLength={120}
                onCommit={(v) => actions.profile({ coach_business_name: v })}
              />
              <Editable
                editing
                as="span"
                value={view.location ?? ""}
                label="Where you are based"
                placeholder="Where you are based, like Leeds"
                maxLength={80}
                onCommit={(v) => actions.profile({ location: v })}
              />
            </div>
          ) : view.business || view.location ? (
            <p className="dp-meta">
              {view.business ? (
                <span>
                  <Briefcase aria-hidden />
                  {view.business}
                </span>
              ) : null}
              {view.location ? (
                <span>
                  <MapPin aria-hidden />
                  {view.location}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="dp-actions" ref={actionsRef}>
            {booking ? (
              <>
                <a className="dp-btn dp-btn--light" href={booking} {...ext(booking)}>
                  <CalendarDays aria-hidden />
                  Book a call
                </a>
                <a className="dp-btn dp-btn--ghost" href={scoreHref}>
                  Get your BOSS Score
                </a>
              </>
            ) : (
              <a className="dp-btn dp-btn--light" href={scoreHref}>
                Get your free BOSS Score
                <ArrowRight aria-hidden />
              </a>
            )}
          </div>
          <Socials view={view} editing={editing} actions={actions} />
        </div>
      </aside>

      <main className="dp-main">
        <div className="dp-col">
          <Editable
            editing={editing}
            className={`dp-lead${(view.summary?.length ?? 0) > 150 ? " dp-lead--long" : ""}`}
            value={view.summary ?? ""}
            label="Your headline"
            placeholder="One line on who you help and what changes for them."
            maxLength={260}
            onCommit={(v) =>
              // About may be showing the old long summary; keep it as the bio.
              actions.profile(
                view.aboutFromSummary && view.bio
                  ? { directory_summary: v, directory_bio: view.bio }
                  : { directory_summary: v }
              )
            }
          />


          {(view.bio && !about.hidden) || editing ? (
            <section className={`dp-section${editing && about.hidden ? " dp-section--off" : ""}`} aria-labelledby="dp-about-h">
              <SectionHead id="dp-about-h" editing={editing} filled={Boolean(view.bio)} vis={about}>
                <span>About</span> {first}
              </SectionHead>
              {!editing && view.bio && view.bio.length > 900 ? (
                <Folded text={view.bio} first={first} />
              ) : (
                <Editable
                  editing={editing}
                  multiline
                  paragraphs
                  className="dp-prose"
                  value={view.bio ?? ""}
                  label="About you"
                  placeholder="Tell owners about you. What you did before coaching, who you help and why. Write the way you talk."
                  maxLength={4000}
                  onCommit={(v) => actions.profile({ directory_bio: v })}
                />
              )}
              {editing ? (
                <div className="dp-tools">
                  <button
                    type="button"
                    className="dp-addbtn"
                    disabled={actions.drafting}
                    onClick={() => void actions.draftBio()}
                  >
                    <Sparkles aria-hidden />
                    {actions.drafting ? "Writing a draft…" : view.bio ? "Redraft from my LinkedIn" : "Draft it from my LinkedIn"}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {(servesFilled && !serves.hidden) || editing ? (
            <section className={`dp-section${editing && serves.hidden ? " dp-section--off" : ""}`} aria-labelledby="dp-serves-h">
              <SectionHead id="dp-serves-h" editing={editing} filled={servesFilled} vis={serves}>
                <span>Who {first}</span> works with
              </SectionHead>
              <Editable
                editing={editing}
                multiline
                paragraphs
                className="dp-prose"
                value={view.extras.serves ?? ""}
                label="Who you work with"
                placeholder="The owners you help most. Their size, their sector, and what keeps them up at night."
                maxLength={LIMITS.serves}
                onCommit={(v) => void actions.extras({ serves: v })}
              />
              <Industries view={view} editing={editing} actions={actions} />
            </section>
          ) : null}

          <Career view={view} editing={editing} actions={actions} />
          <Results view={view} editing={editing} actions={actions} />

          <section className="dp-section" aria-labelledby="dp-how-h">
            <h2 className="dp-h2" id="dp-how-h">
              <span>How {first}</span> works with you
            </h2>
            <ol className="dp-steps">
              <li>
                <h3>Get your score</h3>
                <p>
                  Answer 50 questions about your business. It is free and takes about 10 minutes. You get a score
                  out of 100 across 10 areas.
                </p>
              </li>
              <li>
                <h3>Find the biggest lever</h3>
                <p>
                  {first} goes through your score with you and finds the one change that frees up the most
                  profit and time. That becomes your 90-day plan.
                </p>
              </li>
              <li>
                <h3>Make it happen</h3>
                <p>
                  You work through the plan with {first}, one step at a time, with someone in your corner who
                  keeps it moving.
                </p>
              </li>
            </ol>
          </section>
        </div>

        <section className="dp-score" aria-labelledby="dp-score-h">
          <div>
            <h2 id="dp-score-h">
              <span>Where is your business leaking profit?</span>
              Find out in 10 minutes.
            </h2>
            <p>
              The BOSS Score checks 10 areas of your business, from cash flow to your team, and scores each one.
              You see where you are strong and where to start.
            </p>
            <div className="dp-actions">
              <a className="dp-btn dp-btn--light" href={scoreHref}>
                Get your free BOSS Score
                <ArrowRight aria-hidden />
              </a>
              <span className="dp-score__fine">Free. 50 questions.</span>
            </div>
          </div>
          <div className="dp-wheel">
            <Graphic graphic={wheel} />
            <span className="dp-wheel__label">Example</span>
          </div>
        </section>

        <div className="dp-col dp-close">
          <h2>
            <span>Ready to talk?</span>
            {booking ? `Book a call with ${first}.` : `Start with your BOSS Score.`}
          </h2>
          <div className="dp-actions">
            {booking ? (
              <a className="dp-btn dp-btn--navy" href={booking} {...ext(booking)}>
                <CalendarDays aria-hidden />
                Book a call
              </a>
            ) : (
              <a className="dp-btn dp-btn--navy" href={scoreHref}>
                Get your free BOSS Score
                <ArrowRight aria-hidden />
              </a>
            )}
            {view.linkedinUrl ? (
              <a className="dp-btn dp-btn--outline" href={view.linkedinUrl} target="_blank" rel="noopener noreferrer">
                Message {first} on LinkedIn
                <ArrowUpRight aria-hidden />
              </a>
            ) : null}
          </div>
          <Link className="dp-back" href="/directory">
            <ArrowLeft aria-hidden />
            All coaches
          </Link>
        </div>
      </main>

      {!editing ? (
        <div className="dp-mbar" data-show={showBar} aria-hidden={!showBar}>
          {booking ? (
            <a className="dp-btn dp-btn--light" href={booking} tabIndex={showBar ? 0 : -1} {...ext(booking)}>
              Book a call
            </a>
          ) : null}
          <a className={`dp-btn ${booking ? "dp-btn--ghost" : "dp-btn--light"}`} href={scoreHref} tabIndex={showBar ? 0 : -1}>
            BOSS Score
          </a>
        </div>
      ) : null}
    </>
  );
}
