"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, LayoutList, CheckCircle2, Circle, FileText, Lightbulb, ListOrdered, Loader2, Mic, MicOff, NotebookPen, PanelRightClose, RefreshCw, Route, Sparkles, UserRound } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { Facts, FactsResult, PhasedResult, PitchResult } from "@/lib/salesCall/ai";
import { ANGLES, type AngleId, angleById, type PitchAngle } from "@/lib/salesCall/angles";
import type { Block, LivePart } from "@/lib/salesCall/blocks";
import { type ObjectionId, type ObjectionPage, pageById, pagesIn } from "@/lib/salesCall/objections";
import { FACTS, PHASED_ABOUT, PHASED_SUPPORT, PHASES, type Phase, type PhaseId, PITCH_KINDS, PITCH_PHASES, type PitchKind, READ_BACK, STEP_NAMES, STEPS_INTRO } from "@/lib/salesCall/script";
import { techniqueById, type TechniqueId } from "@/lib/salesCall/techniques";
import { supabaseClient } from "@/lib/supabaseClient";

import { CoachingNotes, collectNotes, ObjectionPages, SCRIPT_COLUMN, SECTION, Sheet, SheetBody, TechniqueModal } from "./ScriptSheet";
import { type SlotKey, type Slots, fillText } from "./slots";
import { useGaps } from "./useGaps";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { AvaHalo } from "@/components/ava/AvaHalo";
import { fieldClass } from "@/components/ui/Field";
import { badgeClass } from "@/components/ui/Badge";

/**
 * Get Clients → Script. Left: the phases of the call. Middle: what to
 * say. Right: the coach's notes, typed or heard, and the five facts. Facts
 * refresh on every pause in the notes. The pitch (nine steps or three
 * phases) starts as the standard one or one of Pam's angles, with fill-ins
 * from the call details; Personalise rewrites it around this owner.
 */


const PILLARS = [
  { name: "Vision", line: "Where are we going?", steps: [1, 2, 3] },
  { name: "Velocity", line: "How do we grow profit faster?", steps: [4, 5, 6] },
  { name: "Value", line: "How does it work without you?", steps: [7, 8, 9] },
];

/** Steps that are a list of pages in the rail rather than one script, and which pages they hold. */
const PAGED: Partial<Record<PhaseId, ObjectionPage["group"]>> = { objections: "objection", closes: "close", next: "next" };
const PHASE_OF: Record<ObjectionPage["group"], PhaseId> = { objection: "objections", close: "closes", next: "next" };

/** "How the close really works", on the Win Clients lesson it was made for. */
const CLOSE_VIDEO = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/academy-lessons/win-clients/win-clients-client-closing-find-the-real-objection/source.mp4`;

/** Steps that open on an overview: a video top right and the pages to pick from. */
const OVERVIEWS: Partial<Record<ObjectionPage["group"], { video: { title: string; src: string } }>> = {
  objection: { video: { title: "How the close really works", src: CLOSE_VIDEO } },
  close: { video: { title: "How the close really works", src: CLOSE_VIDEO } },
};

/** The open objection in the rail: light blue, navy text. */
const OBJECTION_OPEN = "bg-sky-100 font-semibold text-[#0c5290]";
const OBJECTION_IDLE = "text-slate-600 hover:bg-white/80 hover:text-slate-900";

const FACTS_DELAY = 2500;
/** A pitch paragraph is a line to say, so it matches the script's: 17px, bold. The editable one matches too. */
const READY_TEXT = "py-1 text-read font-semibold leading-[1.45] tracking-[-0.006em] text-slate-900";
/** Listening sends the microphone in chunks this long. */
const LISTEN_CHUNK_MS = 20_000;

type Prospect = { id: string; full_name: string; business_name: string | null };

type Draft = {
  prospectId: string | null;
  prospect: string;
  notes: string;
  facts: Facts;
  nextQuestion: string;
  readBack: string;
  /** The personalised pitches, once the coach presses Personalise. */
  pitch: PitchResult | null;
  pitchEdited: boolean;
  phased: PhasedResult | null;
  phasedEdited: boolean;
  /** The facts each was personalised from, to spot notes that came in since. */
  pitchFor: string;
  phasedFor: string;
  /** The ready-made pitch shown before personalising, and the one the notes suggest. */
  angle: AngleId;
  angleFit: AngleId | "";
  /** The pitch tab the coach has open. */
  pitchKind: PitchKind;
  /** Whether the personalised pitch or a ready-made one is showing. Switching keeps both. */
  pitchView: "personal" | "ready";
  /** Which pitch the notes suggest, and why. */
  pitchFit: PitchKind | "";
  pitchWhy: string;
  firstName: string;
  business: string;
  /** Call details the coach has typed over; the AI leaves these alone. */
  edited: string[];
};

const emptyFacts = (): Facts => Object.fromEntries(FACTS.map((f) => [f.key, ""])) as Facts;

const emptyDraft = (): Draft => ({
  prospectId: null,
  prospect: "",
  notes: "",
  facts: emptyFacts(),
  nextQuestion: "",
  readBack: "",
  pitch: null,
  pitchEdited: false,
  phased: null,
  phasedEdited: false,
  pitchFor: "",
  phasedFor: "",
  angle: "standard",
  angleFit: "",
  pitchKind: "steps",
  pitchView: "personal",
  pitchFit: "",
  pitchWhy: "",
  firstName: "",
  business: "",
  edited: [],
});

function storageKey(coachId: string) {
  return `sales-call:${coachId}`;
}

function readDraft(coachId: string): Draft {
  try {
    const raw = window.localStorage.getItem(storageKey(coachId));
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) } : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

function writeDraft(coachId: string, draft: Draft) {
  try {
    window.localStorage.setItem(storageKey(coachId), JSON.stringify(draft));
  } catch {
    // Private windows can refuse storage; the call still works, it just won't survive a reload.
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}


/** A step's script, cut where the read-back or the pitch drops in. */
function splitAtLive(blocks: Block[]): ({ kind: "script"; blocks: Block[] } | { kind: "live"; part: LivePart })[] {
  const out: ({ kind: "script"; blocks: Block[] } | { kind: "live"; part: LivePart })[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type === "live") out.push({ kind: "live", part: b.part });
    else if (last?.kind === "script") last.blocks.push(b);
    else out.push({ kind: "script", blocks: [b] });
  }
  return out;
}

/** A line to say inside the pitch: a small label, then bold like every other line in the script. */
function SayLine({ label, text }: { label: string; text: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 whitespace-pre-line ${READY_TEXT}`}>{text}</p>
    </div>
  );
}

/** The blue gradient the Scripts overview uses to mark what's active. */
const ACTIVE_GRADIENT = "bg-[linear-gradient(155deg,#0a6fa8_0%,#1aa3e0_100%)]";

type Readiness = "low" | "ok" | "best";

/** Personalise needs three facts to start and all five for its best. The button's colour says which. */
const READINESS: Record<Readiness, { line: string; button: string }> = {
  low: {
    line: "It needs their priority, what it's costing them and the result they want. Your notes fill these in as you go.",
    button: "bg-slate-200 text-slate-500",
  },
  ok: {
    line: "Ready to write. Their numbers and why it matters to them make it stronger.",
    button: "bg-amber-500 text-white hover:bg-amber-600",
  },
  best: {
    line: "All five facts are in. This will be the strongest version.",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
};

/** Who a ready-made pitch is for, in the version menu. */
function angleLine(a: PitchAngle): string {
  return a.id === "standard" ? "Works for any owner." : `For owners who say: "${a.line}"`;
}

function VersionOption({
  selected,
  icon,
  title,
  line,
  suggested = false,
  disabled = false,
  onPick,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  line: string;
  suggested?: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onPick}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
        selected ? "bg-sky-50" : "hover:bg-slate-50 disabled:hover:bg-transparent"
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${selected ? "text-sky-800" : "text-slate-900"}`}>{title}</span>
          {suggested ? <span className={badgeClass("green")}>Suggested</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-slate-600">{line}</span>
      </span>
      {selected ? <Check className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden /> : null}
    </button>
  );
}

function SayThis({ label, text }: { label: string; text: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#06223d] px-5 py-4 text-white shadow-[0_10px_30px_-18px_rgba(6,34,61,0.8)]">
      <p className="flex items-center gap-1.5 text-kicker font-semibold uppercase text-sky-200">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 whitespace-pre-line text-read font-semibold leading-[1.45] tracking-[-0.006em]">{text}</p>
    </div>
  );
}

/** Editable text that always shows all of itself: it grows to fit and never scrolls. */
function AutoText({
  value,
  onChange,
  ariaLabel,
  id,
  placeholder,
  className = "-mx-2 block w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-1 text-read font-semibold leading-[1.45] tracking-[-0.006em] text-slate-900 outline-none hover:border-slate-200 focus:border-sky-300 focus:bg-white",
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight leaves out the border, so add it back or the last line scrolls.
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    // The column narrows when the notes panel opens, which rewraps the text.
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={`resize-none overflow-hidden ${className}`}
    />
  );
}

export function SalesCallWorkspace() {
  const { impersonatingCoachId } = useImpersonation();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const scriptsHref = usePathname()?.startsWith("/admin") ? "/admin/script" : "/coach/script";
  // Other scripts link straight to a step, e.g. ?part=objections.
  const params = useSearchParams();
  const askedPhase = params.get("part");
  /** Earlier version pickers, kept to compare: ?v=1 a box and pills, ?v=2 one menu, ?v=3 tabs with a ready-made menu. */
  const picker = params.get("v") === "1" ? 1 : params.get("v") === "2" ? 2 : params.get("v") === "3" ? 3 : 4;
  const [phase, setPhase] = useState<PhaseId>(PHASES.find((p) => p.id === askedPhase)?.id ?? "discovery");
  const [objection, setObjection] = useState<ObjectionId>("think");
  const [overview, setOverview] = useState(() => askedPhase === "objections" || askedPhase === "closes");
  const [notesOpen, setNotesOpen] = useState(true);
  const [coachingOpen, setCoachingOpen] = useState(false);
  const [technique, setTechnique] = useState<TechniqueId | null>(null);
  const [price, setPrice] = useState("");
  const [coachFirstName, setCoachFirstName] = useState("");
  const gaps = useGaps();
  const [guarantee, setGuarantee] = useState("");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [factsBusy, setFactsBusy] = useState(false);
  const [pitchBusy, setPitchBusy] = useState<Record<PitchKind, boolean>>({ steps: false, phases: false });
  const [versionOpen, setVersionOpen] = useState(false);
  const versionMenu = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const lastFactsFor = useRef("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = useCallback(async () => {
    const h = await getCoachAuthHeaders(impersonatingCoachId);
    if (!h) throw new Error("Sign in again to use the sales call.");
    return h;
  }, [impersonatingCoachId]);

  // Who we are, the saved draft, the price and the prospect list.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const id = impersonatingCoachId || data.session?.user.id || null;
      if (cancelled || !id) return;
      setCoachId(id);
      const saved = readDraft(id);
      setDraft(saved);
      lastFactsFor.current = saved.notes.trim();
      try {
        const h = await headers();
        const [ctx, list] = await Promise.all([
          fetch("/api/coach/sales-call/context", { headers: h }).then((r) => r.json()),
          fetch("/api/coach/prospects", { headers: h }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setPrice(typeof ctx?.price === "string" ? ctx.price : "");
        setCoachFirstName(typeof ctx?.name === "string" ? (ctx.name.trim().split(/\s+/)[0] ?? "") : "");
        setGuarantee(typeof ctx?.guarantee === "string" ? ctx.guarantee : "");
        setProspects(Array.isArray(list?.prospects) ? (list.prospects as Prospect[]).slice(0, 500) : []);
      } catch {
        // The call still works without the price or the prospect list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headers, impersonatingCoachId]);

  const update = useCallback(
    (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
      setDraft((prev) => {
        const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
        if (coachId) writeDraft(coachId, next);
        return next;
      });
    },
    [coachId]
  );

  // Facts: on every pause in the notes.
  useEffect(() => {
    const notes = draft.notes.trim();
    if (!notes || notes === lastFactsFor.current) return;
    const timer = setTimeout(async () => {
      lastFactsFor.current = notes;
      setFactsBusy(true);
      try {
        const res = await fetch("/api/coach/sales-call/facts", {
          method: "POST",
          headers: { ...(await headers()), "Content-Type": "application/json" },
          body: JSON.stringify({ notes, prospect: draft.prospect }),
        });
        const body = (await res.json()) as FactsResult & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not read the notes.");
        setError(null);
        update((d) => {
          const keep = new Set(d.edited);
          const facts = Object.fromEntries(FACTS.map((f) => [f.key, keep.has(f.key) ? d.facts[f.key] : body.facts[f.key]])) as Facts;
          return {
            facts,
            firstName: keep.has("first_name") ? d.firstName : body.first_name || d.firstName,
            business: keep.has("business") ? d.business : body.business || d.business,
            nextQuestion: body.next_question,
            readBack: body.read_back,
            pitchFit: body.pitch_fit || d.pitchFit,
            angleFit: body.angle || d.angleFit,
            pitchWhy: body.pitch_fit ? body.pitch_why : d.pitchWhy,
          };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read the notes.");
      } finally {
        setFactsBusy(false);
      }
    }, FACTS_DELAY);
    return () => clearTimeout(timer);
  }, [draft.notes, draft.prospect, headers, update]);

  const writePitch = useCallback(
    async (kind: PitchKind, base?: AngleId) => {
      const notes = draft.notes.trim();
      if (!notes) return;
      const from = JSON.stringify(draft.facts);
      setPitchBusy((b) => ({ ...b, [kind]: true }));
      try {
        const res = await fetch("/api/coach/sales-call/pitch", {
          method: "POST",
          headers: { ...(await headers()), "Content-Type": "application/json" },
          body: JSON.stringify({ notes, prospect: draft.prospect, facts: draft.facts, kind, angle: base ?? draft.angle }),
        });
        const body = (await res.json()) as (PitchResult | PhasedResult) & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not write the pitch.");
        setError(null);
        update(
          kind === "phases"
            ? { phased: body as PhasedResult, phasedEdited: false, phasedFor: from, pitchView: "personal" }
            : { pitch: body as PitchResult, pitchEdited: false, pitchFor: from, pitchView: "personal" }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not write the pitch.");
      } finally {
        setPitchBusy((b) => ({ ...b, [kind]: false }));
      }
    },
    [draft.notes, draft.prospect, draft.facts, draft.angle, headers, update]
  );

  // Personalising is the coach's call, never automatic: nothing moves under them mid-pitch.
  const coreReady = Boolean(draft.facts.priority && draft.facts.pain && draft.facts.result);
  const kind = draft.pitchKind;
  const kindEdited = kind === "phases" ? draft.phasedEdited : draft.pitchEdited;
  const kindWritten = Boolean(kind === "phases" ? draft.phased : draft.pitch);
  const notesMoved = kindWritten && (kind === "phases" ? draft.phasedFor : draft.pitchFor) !== JSON.stringify(draft.facts);
  const angle = angleById(draft.angle);
  /** The personalised pitch is showing; otherwise the chosen ready-made one is. */
  const personal = kindWritten && draft.pitchView === "personal";
  const pitch = personal ? draft.pitch : null;
  const phased = personal ? draft.phased : null;
  // The tabs: Personalised shows the written pitch, or what it needs before it can be written.
  const [personalTab, setPersonalTab] = useState(false);
  const tab: "personal" | "ready" = kindWritten ? (draft.pitchView === "personal" ? "personal" : "ready") : personalTab ? "personal" : "ready";
  const waitingToPersonalise = picker >= 3 && tab === "personal" && !kindWritten && !pitchBusy[kind];
  const pickTab = (t: "personal" | "ready") => {
    setPersonalTab(t === "personal");
    setVersionOpen(false);
    if (kindWritten) update({ pitchView: t });
  };
  /** How much of the five facts Personalise has to work with: their priority, cost and result first, then the other two. */
  const readiness: Readiness = !draft.notes.trim() || !coreReady ? "low" : FACTS.every((f) => draft.facts[f.key]) ? "best" : "ok";

  // The version menu closes on a click outside it or Esc.
  useEffect(() => {
    if (!versionOpen) return;
    const away = (e: MouseEvent) => {
      if (!versionMenu.current?.contains(e.target as Node)) setVersionOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setVersionOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [versionOpen]);

  // Listening: the microphone in short chunks, each transcribed onto the end of the notes.
  const stopListening = useCallback(() => {
    if (chunkTimer.current) clearInterval(chunkTimer.current);
    chunkTimer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setListening(false);
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      if (blob.size < 2000) return;
      try {
        const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
          method: "POST",
          headers: { ...(await headers()), "Content-Type": "application/json" },
          body: JSON.stringify({ audio_base64: await blobToBase64(blob) }),
        });
        const body = (await res.json()) as { text?: string; error?: string };
        const said = body.text?.trim();
        if (said) update((d) => ({ notes: d.notes ? `${d.notes.trimEnd()}\n${said}` : said }));
        else if (!res.ok) setError(body.error ?? "Could not hear that.");
      } catch {
        setError("Could not hear that. Check your connection.");
      }
    },
    [headers, update]
  );

  const startListening = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const startChunk = () => {
        const rec = new MediaRecorder(media);
        const parts: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
        rec.onstop = () => void transcribe(new Blob(parts, { type: rec.mimeType || "audio/webm" }));
        rec.start();
        recorder.current = rec;
      };
      startChunk();
      chunkTimer.current = setInterval(() => {
        if (recorder.current?.state === "recording") recorder.current.stop();
        if (stream.current) startChunk();
      }, LISTEN_CHUNK_MS);
      setListening(true);
      setError(null);
    } catch {
      setError("Allow the microphone to listen to the call.");
    }
  }, [transcribe]);

  useEffect(() => stopListening, [stopListening]);

  const pickProspect = (value: string) => {
    const match = prospects.find((p) => p.full_name === value);
    update((d) => ({
      prospect: value,
      prospectId: match?.id ?? null,
      firstName: d.edited.includes("first_name") ? d.firstName : value.trim().split(/\s+/)[0] ?? "",
      business: d.edited.includes("business") || !match?.business_name ? d.business : match.business_name,
    }));
  };

  const newCall = () => {
    if (draft.notes && !window.confirm("Start a new call? This clears the notes and pitch on screen.")) return;
    stopListening();
    lastFactsFor.current = "";
    update(emptyDraft());
    gaps.clearAll();
    goPhase("discovery");
  };

  const factCount = FACTS.filter((f) => draft.facts[f.key]).length;

  const slots: Slots = {
    name: draft.firstName || draft.prospect.trim().split(/\s+/)[0] || "",
    business: draft.business,
    result: draft.facts.result,
    problem: draft.facts.priority,
    pain: draft.facts.pain,
    number: draft.facts.number,
    why: draft.facts.why,
    price,
    guarantee,
    me: coachFirstName,
  };
  const personalTitle = `Personalised${slots.name ? ` for ${slots.name}` : ""}`;
  const personalLine = `Built from your notes${kindEdited ? ", with your edits" : ""}. Click any ${kind === "phases" ? "phase" : "step"} to change it.`;
  // Editing a fill-in in the script updates the call details, without moving the page.
  const SLOT_DETAIL: Partial<Record<SlotKey, string>> = {
    name: "first_name",
    business: "business",
    result: "result",
    problem: "priority",
    pain: "pain",
    number: "number",
    why: "why",
  };
  const fill = (text: string) =>
    fillText(
      text,
      slots,
      (key, value) => {
        const detail = SLOT_DETAIL[key];
        if (detail) editDetail(detail, value);
      },
      setTechnique,
      gaps,
    );
  const openPage = (id: ObjectionId) => {
    const target = PHASE_OF[pageById(id)?.group ?? "objection"];
    if (phase !== target) goPhase(target);
    setObjection(id);
    setOverview(false);
  };
  const editDetail = (key: string, value: string) =>
    update((d) => ({
      edited: d.edited.includes(key) ? d.edited : [...d.edited, key],
      ...(key === "first_name" ? { firstName: value } : key === "business" ? { business: value } : { facts: { ...d.facts, [key]: value } }),
    }));
  const current = PHASES.find((p) => p.id === phase) ?? PHASES[0];
  // On a step with pages, the header names the page you're on, not the step.
  const pagedGroup = PAGED[phase];
  const showOverview = Boolean(pagedGroup && OVERVIEWS[pagedGroup] && overview);
  const shownPage = pagedGroup && !showOverview ? pageById(objection) : null;
  const coachingNotes = collectNotes(shownPage ? shownPage.blocks : current.blocks);

  // Notes matter while they talk; on objections the script needs the room.
  const goPhase = (id: PhaseId) => {
    setPhase(id);
    const group = PAGED[id];
    if (group) {
      setNotesOpen(false);
      setObjection((cur) => (pageById(cur)?.group === group ? cur : pagesIn(group)[0].id));
      if (id !== phase) setOverview(true);
    }
    if (id === "discovery" || id === "pitch") setNotesOpen(true);
  };

  const railBadge = (p: Phase) => {
    if (p.id === "discovery") return `${factCount}/5`;
    if (p.id === "pitch") return pitchBusy[kind] ? "writing" : kindWritten ? "personal" : null;
    return null;
  };

  const stepText = useMemo(() => new Map((draft.pitch?.steps ?? []).map((s) => [s.step, s.text])), [draft.pitch]);

  const editStep = (step: number, text: string) =>
    update((d) => ({
      pitchEdited: true,
      pitch: d.pitch ? { ...d.pitch, steps: d.pitch.steps.map((s) => (s.step === step ? { ...s, text } : s)) } : d.pitch,
    }));

  const phaseText = useMemo(() => new Map((draft.phased?.phases ?? []).map((p) => [p.phase, p])), [draft.phased]);

  const editPhase = (phase: number, text: string) =>
    update((d) => ({
      phasedEdited: true,
      phased: d.phased ? { ...d.phased, phases: d.phased.phases.map((p) => (p.phase === phase ? { ...p, text } : p)) } : d.phased,
    }));

  // What the coach's notes have written so far, dropped into the script where it's said.
  const livePart: Record<LivePart, ReactNode> = {
    readback: (
      draft.readBack ? (
        <SayThis label="Say this" text={draft.readBack} />
      ) : (
        // Something to read straight away: the template with the call details dropped in, like the ready-made pitch.
        <div className="space-y-2">
          <SayLine label="Say this" text={fill(READ_BACK)} />
          <p className="text-sm text-slate-500">
            Rewritten in their words once your notes have their priority, what it&apos;s costing them and the result they want.
          </p>
        </div>
      )
    ),
    pitch: (
      <div className="space-y-4">
        {/* Two ways to pitch, from the same facts. The coach picks one; each keeps its own draft. */}
        <p className="text-read leading-[1.55] text-slate-600">
          Pick one of these two to take them through. You only need one. On a follow-up call, use the other.
        </p>
        <div role="tablist" aria-label="Pitch" className="grid gap-3 sm:grid-cols-2">
          {PITCH_KINDS.map((k) => {
            const on = k.id === kind;
            const Icon = k.id === "phases" ? Route : ListOrdered;
            return (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => update({ pitchKind: k.id })}
                className={`relative flex gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition ${
                  on ? "border-sky-600 bg-sky-50" : "border-slate-200 bg-white opacity-60 hover:opacity-100 hover:border-slate-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-base font-semibold ${on ? "text-sky-800" : "text-slate-800"}`}>{k.title}</span>
                    {draft.pitchFit === k.id ? (
                      <span className={badgeClass("green")}>Suggested</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">{k.line}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">{k.when}</span>
                </span>
                {on ? <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-sky-600" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        {draft.pitchFit && draft.pitchWhy ? (
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Suggested: {PITCH_KINDS.find((k) => k.id === draft.pitchFit)?.title}.</span> {draft.pitchWhy}
          </p>
        ) : null}

        {picker === 1 ? (
          // Which version to read: personalised first, the ready-made ones as the fallback. Switching keeps both.
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Which version?</p>
            <div
              className={`mt-2 flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                personal ? "border-sky-600 bg-sky-50" : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                aria-pressed={personal}
                disabled={!kindWritten || pitchBusy[kind]}
                onClick={() => update({ pitchView: "personal" })}
                className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-default"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${personal ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700"}`}
                  aria-hidden
                >
                  {pitchBusy[kind] ? <Loader2 className="h-5 w-5 animate-spin" /> : <AvaHalo size={20} dark={personal} className="shrink-0" />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-base font-semibold ${personal ? "text-sky-800" : "text-slate-900"}`}>
                    Personalised{slots.name ? ` for ${slots.name}` : ""}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {pitchBusy[kind]
                      ? "Writing it around what they told you…"
                      : kindWritten
                        ? !personal
                          ? "Written. Click to use it again."
                          : notesMoved
                            ? "Your notes have more in them since, so you can update it."
                            : kindEdited
                              ? "Built from your notes, with your edits."
                              : `Built from your notes. Click any ${kind === "phases" ? "phase" : "step"} to change it.`
                        : !draft.notes.trim()
                          ? "Take notes in Discovery first, then write it here."
                          : coreReady
                            ? "Rewritten around everything they told you. The strongest version."
                            : "Works best once your notes have their priority, what it's costing them and the result they want."}
                  </span>
                </span>
              </button>
              {!kindWritten || (personal && notesMoved) ? (
                <button
                  type="button"
                  onClick={() => void writePitch(kind)}
                  disabled={pitchBusy[kind] || !draft.notes.trim()}
                  className={buttonClass("main", "normal", "shrink-0")}
                >
                  {kindWritten ? <RefreshCw className="h-4 w-4" aria-hidden /> : <AvaHalo size={18} dark className="shrink-0" />}
                  {kindWritten ? "Update with new notes" : "Personalise"}
                </button>
              ) : personal && !pitchBusy[kind] ? (
                <button
                  type="button"
                  onClick={() => void writePitch(kind)}
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Write again
                </button>
              ) : null}
            </div>

            <p className="mt-4 text-sm text-slate-500">Or read a ready-made one:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ANGLES.map((a) => {
                const on = !personal && a.id === angle.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    title={a.line}
                    onClick={() => update({ angle: a.id, pitchView: "ready" })}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      on ? "bg-sky-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-sky-300"
                    }`}
                  >
                    {a.title}
                    {draft.angleFit === a.id && a.id !== "standard" ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-300" : "bg-emerald-500"}`} aria-label="Suggested" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {!personal ? (
              <p className="mt-2 text-sm text-slate-500">
                {angle.id === "standard" ? "Works for any owner." : `Pam's angle for owners who say: "${angle.line}"`}
                {draft.angleFit && draft.angleFit !== "standard" && draft.angleFit !== angle.id
                  ? ` Their notes sound most like ${angleById(draft.angleFit).title}.`
                  : ""}
                {kindWritten ? "" : " Personalise builds on the one you pick."}
              </p>
            ) : null}
          </div>
        ) : picker === 2 ? (
          // Which version to read, in one menu: the personalised one first, then the ready-made ones, each explained. Switching keeps them all.
          <div ref={versionMenu} className="relative border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Which version?</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={versionOpen}
                onClick={() => setVersionOpen((o) => !o)}
                className={`flex min-w-0 flex-1 basis-72 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                  personal ? "border-sky-600 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${personal ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  aria-hidden
                >
                  {pitchBusy[kind] ? <Loader2 className="h-5 w-5 animate-spin" /> : personal ? <AvaHalo size={20} dark className="shrink-0" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-500">{personal ? "Written for this owner" : "Ready-made"}</span>
                  <span className={`block text-base font-semibold ${personal ? "text-sky-800" : "text-slate-900"}`}>
                    {personal ? personalTitle : angle.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {pitchBusy[kind]
                      ? "Writing it around what they told you…"
                      : personal
                        ? notesMoved
                          ? "Your notes have more in them since, so you can update it."
                          : personalLine
                        : `${angleLine(angle)}${
                            draft.angleFit && draft.angleFit !== "standard" && draft.angleFit !== angle.id
                              ? ` Their notes sound most like ${angleById(draft.angleFit).title}.`
                              : ""
                          } ${kindWritten ? "Your personalised one is still in this list." : "Personalise rewrites it around what they told you."}`}
                  </span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${versionOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {pitchBusy[kind] ? null : !kindWritten || (personal && notesMoved) ? (
                <button
                  type="button"
                  onClick={() => void writePitch(kind)}
                  disabled={!draft.notes.trim()}
                  title={draft.notes.trim() ? undefined : "Take notes in Discovery first"}
                  className={buttonClass("main", "normal", "shrink-0")}
                >
                  {kindWritten ? <RefreshCw className="h-4 w-4" aria-hidden /> : <AvaHalo size={18} dark className="shrink-0" />}
                  {kindWritten ? "Update with new notes" : "Personalise"}
                </button>
              ) : personal ? (
                <button
                  type="button"
                  onClick={() => void writePitch(kind)}
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Write again
                </button>
              ) : null}
            </div>

            {versionOpen ? (
              <div role="listbox" aria-label="Which version?" className="absolute inset-x-0 z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-20px_rgba(6,34,61,0.45)]">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">Written for this owner</p>
                <VersionOption
                  selected={personal}
                  icon={<AvaHalo size={18} className="shrink-0" />}
                  title={personalTitle}
                  line={
                    kindWritten
                      ? personalLine
                      : draft.notes.trim()
                        ? "Not written yet. Pick a ready-made one below to build on, then press Personalise."
                        : "Take notes in Discovery first, then press Personalise."
                  }
                  disabled={!kindWritten}
                  onPick={() => {
                    update({ pitchView: "personal" });
                    setVersionOpen(false);
                  }}
                />
                <p className="mt-2 border-t border-slate-100 px-3 pb-1 pt-3 text-xs font-medium text-slate-500">
                  Ready-made{" "}
                  <span className="font-normal">
                    {kind === "phases" ? "· Built with Pam's know-how, with their details dropped in" : "· In Pam's words, with their details dropped in"}
                  </span>
                </p>
                {ANGLES.map((a) => (
                  <VersionOption
                    key={a.id}
                    selected={!personal && a.id === angle.id}
                    icon={<FileText className="h-4 w-4" />}
                    title={a.title}
                    line={angleLine(a)}
                    suggested={draft.angleFit === a.id && a.id !== "standard"}
                    onPick={() => {
                      update({ angle: a.id, pitchView: "ready" });
                      setVersionOpen(false);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          // Two tabs: the pitch written for this owner, or a ready-made one. Each keeps its own, so switching loses nothing.
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Which version?</p>
            {/* One box: the tabs across the top, the chosen tab's panel straight under them. */}
            <div className={cardClass("plain", "mt-2")}>
            <div role="tablist" aria-label="Which version?" className="grid grid-cols-2 gap-1 rounded-t-[15px] border-b border-slate-200 bg-slate-100 p-1">
              {(["personal", "ready"] as const).map((t) => {
                const on = t === tab;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => pickTab(t)}
                    className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      on ? `${ACTIVE_GRADIENT} text-white shadow-sm` : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                    }`}
                  >
                    {t === "personal" ? (
                      pitchBusy[kind] ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <AvaHalo size={18} dark={on} className="shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{t === "personal" ? personalTitle : "Ready-made"}</span>
                  </button>
                );
              })}
            </div>

            {tab === "personal" ? (
              kindWritten || pitchBusy[kind] ? (
                <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                  <p className="min-w-0 flex-1 text-sm text-slate-600">
                    {pitchBusy[kind]
                      ? "Writing it around what they told you. It takes about 20 seconds."
                      : notesMoved
                        ? "Your notes have more in them since, so you can update it."
                        : personalLine}
                  </p>
                  {pitchBusy[kind] ? null : notesMoved ? (
                    <button
                      type="button"
                      onClick={() => void writePitch(kind, draft.angleFit || "standard")}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${READINESS[readiness].button}`}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      Update with new notes
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void writePitch(kind, draft.angleFit || "standard")}
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      Write again
                    </button>
                  )}
                </div>
              ) : (
                // Not written yet: what it needs, and a button whose colour says how ready the notes are.
                // What it says and the button on the left, the five facts as a list on the right.
                <div className="grid gap-x-8 gap-y-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Write it around {slots.name || "this owner"}</p>
                    <p className="mt-1 text-sm text-slate-600">{READINESS[readiness].line}</p>
                    <button
                      type="button"
                      onClick={() => void writePitch(kind, draft.angleFit || "standard")}
                      disabled={readiness === "low"}
                      className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed ${READINESS[readiness].button}`}
                    >
                      <AvaHalo size={18} dark={readiness !== "low"} className="shrink-0" />
                      Personalise
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {FACTS.map((f) => {
                      const has = Boolean(draft.facts[f.key]);
                      return (
                        <li key={f.key} className={`flex items-center gap-1.5 text-sm ${has ? "text-slate-800" : "text-slate-400"}`}>
                          {has ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
                          {f.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )
            ) : picker === 4 ? (
              // Every ready-made one in view, so nobody misses that there's a choice.
              <div className="px-4 py-4">
                <p className="text-sm text-slate-600">
                  Pick one. {kind === "phases" ? "Each is built with Pam's know-how" : "Each is in Pam's words"}, with their details dropped in.
                  {draft.angleFit && draft.angleFit !== "standard" ? ` Their notes sound most like ${angleById(draft.angleFit).title}.` : ""}
                </p>
                <div role="listbox" aria-label="Ready-made pitches" className="mt-2 grid gap-1 sm:grid-cols-2">
                  {ANGLES.map((a) => (
                    <VersionOption
                      key={a.id}
                      selected={a.id === angle.id}
                      icon={<FileText className="h-4 w-4" />}
                      title={a.title}
                      line={angleLine(a)}
                      suggested={draft.angleFit === a.id && a.id !== "standard"}
                      onPick={() => update({ angle: a.id, pitchView: "ready" })}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div ref={versionMenu} className="relative px-4 py-4">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={versionOpen}
                  onClick={() => setVersionOpen((o) => !o)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-slate-900">{angle.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {angleLine(angle)}
                      {draft.angleFit && draft.angleFit !== "standard" && draft.angleFit !== angle.id
                        ? ` Their notes sound most like ${angleById(draft.angleFit).title}.`
                        : ""}
                    </span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${versionOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {versionOpen ? (
                  <div role="listbox" aria-label="Ready-made pitches" className="absolute inset-x-4 z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-20px_rgba(6,34,61,0.45)]">
                    {ANGLES.map((a) => (
                      <VersionOption
                        key={a.id}
                        selected={a.id === angle.id}
                        icon={<FileText className="h-4 w-4" />}
                        title={a.title}
                        line={angleLine(a)}
                        suggested={draft.angleFit === a.id && a.id !== "standard"}
                        onPick={() => {
                          update({ angle: a.id, pitchView: "ready" });
                          setVersionOpen(false);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  {kind === "phases" ? "Built with Pam's know-how, with their details dropped in." : "In Pam's words, with their details dropped in."}
                </p>
              </div>
            )}
            </div>
          </div>
        )}

        {waitingToPersonalise ? null : kind === "phases" ? (
          <>
            <SayLine label="The bridge" text={phased ? phased.bridge : fill(angle.bridge)} />
            <SayLine label="About you (optional, if they want to know who they'd be working with)" text={phased?.about || fill(PHASED_ABOUT)} />
            {PITCH_PHASES.map((ph, i) => {
              const written = phased ? phaseText.get(i + 1) : null;
              const ready = angle.phases[i];
              return (
                <section key={ph.name} className="pt-4">
                  <h3 className={`flex flex-wrap items-baseline gap-x-3 ${SECTION}`}>
                    {ph.name}
                    <span className="text-base text-slate-500">{ph.when}</span>
                  </h3>
                  <div className="mt-3">
                    {written ? (
                      <AutoText ariaLabel={`Phase ${i + 1}`} value={written.text} onChange={(v) => editPhase(i + 1, v)} />
                    ) : (
                      <p className={`whitespace-pre-line ${READY_TEXT}`}>{fill(ready.text)}</p>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Check in:</span> {written?.check || ready.check}
                  </p>
                </section>
              );
            })}
            <SayLine label="Support" text={phased?.support || fill(PHASED_SUPPORT)} />
            <SayLine label="Recap" text={phased ? phased.recap : fill(angle.recap)} />
          </>
        ) : (
          <>
            {pitch?.thread ? (
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Their golden thread:</span> {pitch.thread}
              </p>
            ) : null}
            <SayLine label="Open with" text={fill(STEPS_INTRO)} />
            {/* Pillars as plain script sections, no boxes: a heading, then each step's label and line. */}
            {PILLARS.map((pillar) => (
              <section key={pillar.name} className="pt-4">
                <h3 className={`flex flex-wrap items-baseline gap-x-3 ${SECTION}`}>
                  {pillar.name}
                  <span className="text-base text-slate-500">{pillar.line}</span>
                </h3>
                <ol className="mt-3 space-y-5">
                  {pillar.steps.map((n) => (
                    <li key={n}>
                      <p className="text-xs font-medium text-slate-500">
                        Step {n} · {STEP_NAMES[n - 1]}
                      </p>
                      <div className="mt-1.5">
                        {pitch && stepText.get(n) ? (
                          <AutoText ariaLabel={`Step ${n}`} value={stepText.get(n) ?? ""} onChange={(v) => editStep(n, v)} />
                        ) : (
                          <p className={READY_TEXT}>{fill(angle.steps[n - 1] ?? "")}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <SayLine label="Bringing it together" text={pitch ? pitch.together : fill(angle.together)} />
          </>
        )}
      </div>
    ),
  };

  return (
    // Flush against the app sidebar, the way My Blueprint is: a tinted rail, the white script, a tinted notes panel.
    <div className="-mx-4 -mb-6 flex min-h-[calc(100dvh-57px)] flex-col md:-mx-[60px] lg:flex-row lg:items-stretch">
      {/* The call, phase by phase */}
      <nav
        aria-label="Call phases"
        className="min-w-0 shrink-0 border-b border-slate-200 bg-[#f3f6fa] px-3 py-3 lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:w-60 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-5"
      >
        <Link href={scriptsHref} className="mb-3 inline-flex items-center gap-1.5 px-3 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All scripts
        </Link>
        <p className="mb-2 hidden px-3 text-sm font-semibold text-slate-900 lg:block">Profit Roadmap call</p>
        <Link href={`${scriptsHref}/roadmap`} className="mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white/80">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
          </span>
          Overview
        </Link>
        <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {PHASES.map((p, i) => {
            const active = p.id === phase;
            const badge = railBadge(p);
            return (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => goPhase(p.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    active ? "bg-[#06223d] text-white" : "text-slate-700 hover:bg-white/80"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      active ? "bg-white/15 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-nowrap font-medium">{p.title}</span>
                  {badge ? (
                    <span className={`text-caption font-semibold ${active ? "text-sky-200" : "text-sky-700"}`}>{badge}</span>
                  ) : null}
                </button>
                {PAGED[p.id] && active ? (
                  <ul className="mt-1.5 hidden space-y-0.5 pb-2 pl-9 lg:block">
                    {OVERVIEWS[PAGED[p.id] ?? "objection"] ? (
                      <li>
                        <button
                          type="button"
                          aria-current={showOverview ? "page" : undefined}
                          onClick={() => setOverview(true)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                            showOverview ? OBJECTION_OPEN : OBJECTION_IDLE
                          }`}
                        >
                          <LayoutList aria-hidden className="h-4 w-5 shrink-0" />
                          <span>Overview</span>
                        </button>
                      </li>
                    ) : null}
                    {pagesIn(PAGED[p.id] ?? "objection").map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          aria-current={!showOverview && o.id === objection ? "page" : undefined}
                          onClick={() => {
                            setObjection(o.id);
                            setOverview(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                            !showOverview && o.id === objection ? OBJECTION_OPEN : OBJECTION_IDLE
                          }`}
                        >
                          <span aria-hidden className="w-5 shrink-0 text-center">{o.emoji}</span>
                          <span>{o.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col bg-white xl:flex-row">
      {/* What to say */}
      <section aria-labelledby="phase-title" className="min-w-0 flex-1 space-y-6 px-6 py-8 md:px-10 lg:px-14">
        {/* The page's heading, framed off from the script by a rule. */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 id="phase-title" className="text-title font-normal leading-tight text-slate-900">
              {shownPage ? (
                <>
                  <span aria-hidden className="mr-2">{shownPage.emoji}</span>
                  {shownPage.title}
                </>
              ) : (
                current.title
              )}
            </h2>
            <p className="mt-1 text-read leading-[1.45] text-slate-600">{shownPage ? shownPage.summary : current.goal}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {coachingNotes.length ? (
            <button
              type="button"
              onClick={() => setCoachingOpen(true)}
              className={buttonClass("second")}
            >
              <Lightbulb className="h-4 w-4" aria-hidden />
              Tips
            </button>
          ) : null}
          {!notesOpen ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className={buttonClass("second", "normal", "shrink-0")}
            >
              <NotebookPen className="h-4 w-4" aria-hidden />
              Call notes · {factCount}/5
            </button>
          ) : null}
          </div>
        </header>

        {pagedGroup && showOverview ? (
          // The video top right (on top on a phone), and every page to pick from.
          <div className="@container">
          <div className="grid gap-8 @[44rem]:grid-cols-[minmax(0,1fr)_20rem]">
            <figure className="@[44rem]:order-2">
              <video
                controls
                preload="metadata"
                src={OVERVIEWS[pagedGroup]?.video.src}
                className="aspect-video w-full rounded-xl bg-slate-900"
              />
              <figcaption className="mt-2 text-sm text-slate-600">{OVERVIEWS[pagedGroup]?.video.title}</figcaption>
            </figure>
            <ul className="space-y-2 @[44rem]:order-1">
              {pagesIn(pagedGroup).map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => openPage(o.id)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/40"
                  >
                    <span aria-hidden className="w-6 shrink-0 text-center text-lg leading-6">{o.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-slate-900">{o.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{o.summary}</span>
                    </span>
                    <ChevronRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          </div>
        ) : pagedGroup ? (
          <>
            <select
              aria-label="Page"
              value={objection}
              onChange={(e) => {
                setObjection(e.target.value as ObjectionId);
                setOverview(false);
              }}
              className={fieldClass("select", "normal", "lg:hidden")}
            >
              {pagesIn(pagedGroup).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.emoji} {o.title}
                </option>
              ))}
            </select>
            <ObjectionPages current={objection} onOpen={openPage} fill={fill} />
          </>
        ) : null}

        {splitAtLive(current.blocks).map((part, i) =>
          part.kind === "live" ? (
            // The heading above already spaces it; no extra gap on top. Same column as the script text.
            <div key={i} className={`!mt-0 ${SCRIPT_COLUMN}`}>{livePart[part.part]}</div>
          ) : (
            <Sheet key={i}>
              <SheetBody blocks={part.blocks} fill={fill} open={openPage} />
            </Sheet>
          ),
        )}

      </section>

      {/* Notes and the five facts */}
      {notesOpen ? (
      <aside
        aria-label="Call notes"
        className="shrink-0 divide-y divide-slate-200 border-t border-slate-200 bg-[#f3f6fa] xl:sticky xl:top-[57px] xl:h-[calc(100dvh-57px)] xl:w-[22rem] xl:self-start xl:overflow-y-auto xl:border-l xl:border-t-0"
      >
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              list="sales-call-prospects"
              value={draft.prospect}
              onChange={(e) => pickProspect(e.target.value)}
              placeholder="Who's the call with?"
              aria-label="Who's the call with"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            <datalist id="sales-call-prospects">
              {prospects.map((p) => (
                <option key={p.id} value={p.full_name}>
                  {p.business_name ?? ""}
                </option>
              ))}
            </datalist>
            <button type="button" onClick={newCall} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900">
              New call
            </button>
            <button type="button" onClick={() => setNotesOpen(false)} aria-label="Hide notes" title="Hide notes" className="shrink-0 text-slate-400 hover:text-slate-800">
              <PanelRightClose className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Type what they tell you, in their words. Or press Listen."
            aria-label="Call notes"
            rows={10}
            className={fieldClass("textarea", "normal", "mt-3 resize-y")}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (listening ? stopListening() : void startListening())}
              aria-pressed={listening}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                listening ? "bg-rose-600 text-white" : "bg-[#06223d] text-white hover:bg-[#0c3358]"
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
              {listening ? "Stop listening" : "Listen"}
            </button>
            <span className="text-xs text-slate-500">
              {factsBusy ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Reading your notes
                </span>
              ) : listening ? (
                "Adds what it hears every 20 seconds"
              ) : null}
            </span>
          </div>
          {listening ? (
            <p className="mt-2 text-xs text-slate-500">Let them know you&apos;re taking notes. It hears your microphone, so say their key points back to them.</p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </div>

        <div className="px-5 py-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-slate-900">Call details</h3>
            <span className="text-xs font-medium text-slate-500">{factCount} of 5 facts</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Filled from your notes. Change anything and the script updates.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { key: "first_name", label: "First name", value: draft.firstName },
              { key: "business", label: "Business", value: draft.business },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-medium text-slate-500">{field.label}</span>
                <input
                  id={`cd-${field.key}`}
                  value={field.value}
                  onChange={(e) => editDetail(field.key, e.target.value)}
                  placeholder="Not heard yet"
                  className={fieldClass("input", "small", "mt-0.5")}
                />
              </label>
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {FACTS.map((f) => {
              const value = draft.facts[f.key];
              return (
                <li key={f.key} className="flex gap-2.5">
                  {value ? (
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  )}
                  <label className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-500">{f.label}</span>
                    <AutoText
                      id={`cd-${f.key}`}
                      value={value}
                      onChange={(v) => editDetail(f.key, v)}
                      placeholder={f.key === "number" ? "e.g. £3.2m turnover, 4% profit" : "Not heard yet"}
                      className={fieldClass("textarea", "small", "mt-0.5")}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {draft.nextQuestion ? (
            <div className="mt-4 rounded-lg bg-white px-3.5 py-3 ring-1 ring-sky-200">
              <p className="text-kicker font-semibold uppercase text-[#0c5290]">Ask next</p>
              <p className="mt-1 text-sm text-slate-900">{draft.nextQuestion}</p>
            </div>
          ) : null}
        </div>
      </aside>
      ) : null}
      </div>
      <CoachingNotes
        open={coachingOpen}
        onClose={() => setCoachingOpen(false)}
        title={shownPage ? shownPage.title : current.title}
        notes={coachingNotes}
        fill={fill}
      />
      <TechniqueModal technique={technique ? techniqueById(technique) : null} onClose={() => setTechnique(null)} fill={fill} open={openPage} />
    </div>
  );
}
