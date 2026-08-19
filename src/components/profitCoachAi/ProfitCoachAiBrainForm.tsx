"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Compass,
  Heart,
  Megaphone,
  Quote,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import type { CoachAiContext } from "@/lib/profitCoachAi/types";

type BrainSectionId =
  | "superpowers"
  | "hobbies"
  | "client_results"
  | "ideal_client"
  | "industry_vocabulary"
  | "pain_language"
  | "messaging_hooks"
  | "proof_framing";

type BrainSection = {
  id: BrainSectionId;
  label: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
};

type BrainGroup = {
  label: string;
  items: BrainSection[];
};

const BRAIN_GROUPS: BrainGroup[] = [
  {
    label: "You",
    items: [
      {
        id: "superpowers",
        label: "Superpowers",
        title: "Superpowers",
        description:
          "What you’re uniquely strong at. The AI uses this for voice, proof, and how you show up.",
        icon: Sparkles,
      },
      {
        id: "hobbies",
        label: "Hobbies & recent",
        title: "Hobbies & recent",
        description:
          "Human details you’re happy to weave into content — trips, sports, what you’re reading.",
        icon: Heart,
      },
    ],
  },
  {
    label: "Proof",
    items: [
      {
        id: "client_results",
        label: "Client results",
        title: "Client results",
        description:
          "Named outcomes the AI can cite. Never invent numbers here — only wins you can stand behind.",
        icon: Award,
      },
    ],
  },
  {
    label: "Campaign & ICP",
    items: [
      {
        id: "ideal_client",
        label: "Ideal client",
        title: "Ideal client",
        description:
          "Who you target — market, titles, company size, revenue. Confirmed from First Campaign; edit any time.",
        icon: Users,
      },
      {
        id: "industry_vocabulary",
        label: "Industry vocabulary",
        title: "Industry vocabulary",
        description:
          "The trade words this ICP actually uses. Feeds messaging so copy doesn’t sound generic.",
        icon: BookOpen,
      },
      {
        id: "pain_language",
        label: "Pain language",
        title: "Pain language",
        description:
          "Their pains and frustrations, in their own words — not coach-speak.",
        icon: Target,
      },
      {
        id: "messaging_hooks",
        label: "Messaging hooks",
        title: "Messaging hooks",
        description:
          "Openers and angles proven to land with this ICP.",
          icon: Megaphone,
      },
      {
        id: "proof_framing",
        label: "Proof framing",
        title: "Proof framing",
        description:
          "How your proof and results should be framed for them.",
        icon: Quote,
      },
    ],
  },
];

const ALL_SECTIONS = BRAIN_GROUPS.flatMap((g) => g.items);

function sectionById(id: BrainSectionId): BrainSection {
  return ALL_SECTIONS.find((s) => s.id === id) ?? ALL_SECTIONS[0]!;
}

function isFilledText(value: string): boolean {
  return value.trim().length >= 3;
}

const textareaClass =
  "w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20";

export function buildInitialBrainForm(
  initialContext: CoachAiContext,
  draftFromChat: string | null | undefined
) {
  const base = initialContext.superpowers ?? "";
  const d = draftFromChat?.trim();
  const superpowers =
    d && d.length > 0
      ? base.trim()
        ? `${base.trim()}\n\n${d}`
        : d
      : base;
  return {
    superpowers,
    hobbies: initialContext.hobbies_and_recent ?? "",
    clientResults: (initialContext.client_results ?? []).map((r) => ({
      title: r.title ?? "",
      story: r.story ?? "",
    })),
    idealClient: initialContext.ideal_client ?? "",
    industryVocabulary: initialContext.industry_vocabulary ?? "",
    painLanguage: initialContext.pain_language ?? "",
    messagingHooks: initialContext.messaging_hooks ?? "",
    proofFraming: initialContext.proof_framing ?? "",
  };
}

type Props = {
  compassHref: string;
  initialContext: CoachAiContext;
  draftFromChat?: string | null;
  saving: boolean;
  saveError: string | null;
  onSave: (next: CoachAiContext) => void;
  /** When set, shows a Cancel control next to Save (e.g. modal). */
  onCancel?: () => void;
  /** Page tab: sidebar + editor. Modal: compact category chips. */
  variant?: "modal" | "page";
};

export function ProfitCoachAiBrainForm({
  compassHref,
  initialContext,
  draftFromChat,
  saving,
  saveError,
  onSave,
  onCancel,
  variant = "modal",
}: Props) {
  const uid = useId();
  const isPage = variant === "page";
  const init = buildInitialBrainForm(initialContext, draftFromChat);
  const [activeId, setActiveId] = useState<BrainSectionId>("superpowers");
  const [superpowers, setSuperpowers] = useState(init.superpowers);
  const [hobbies, setHobbies] = useState(init.hobbies);
  const [clientResults, setClientResults] = useState(init.clientResults);
  const [idealClient, setIdealClient] = useState(init.idealClient);
  const [industryVocabulary, setIndustryVocabulary] = useState(
    init.industryVocabulary
  );
  const [painLanguage, setPainLanguage] = useState(init.painLanguage);
  const [messagingHooks, setMessagingHooks] = useState(init.messagingHooks);
  const [proofFraming, setProofFraming] = useState(init.proofFraming);

  const filled = useMemo(
    (): Record<BrainSectionId, boolean> => ({
      superpowers: isFilledText(superpowers),
      hobbies: isFilledText(hobbies),
      client_results: clientResults.some(
        (r) => isFilledText(r.title) || isFilledText(r.story)
      ),
      ideal_client: isFilledText(idealClient),
      industry_vocabulary: isFilledText(industryVocabulary),
      pain_language: isFilledText(painLanguage),
      messaging_hooks: isFilledText(messagingHooks),
      proof_framing: isFilledText(proofFraming),
    }),
    [
      superpowers,
      hobbies,
      clientResults,
      idealClient,
      industryVocabulary,
      painLanguage,
      messagingHooks,
      proofFraming,
    ]
  );

  const active = sectionById(activeId);
  const ActiveIcon = active.icon;
  const editorClass = isPage
    ? `${textareaClass} min-h-[12rem] flex-1`
    : textareaClass;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      superpowers: superpowers.trim() || undefined,
      hobbies_and_recent: hobbies.trim() || undefined,
      client_results: clientResults.filter(
        (r) => r.title.trim() || r.story.trim()
      ),
      ideal_client: idealClient.trim() || undefined,
      industry_vocabulary: industryVocabulary.trim() || undefined,
      pain_language: painLanguage.trim() || undefined,
      messaging_hooks: messagingHooks.trim() || undefined,
      proof_framing: proofFraming.trim() || undefined,
    });
  }

  function renderEditor() {
    switch (activeId) {
      case "superpowers":
        return (
          <>
            <label htmlFor={`${uid}-superpowers`} className="sr-only">
              Superpowers
            </label>
            <textarea
              id={`${uid}-superpowers`}
              rows={isPage ? 16 : 6}
              value={superpowers}
              onChange={(e) => setSuperpowers(e.target.value)}
              className={editorClass}
              placeholder="What you’re uniquely strong at…"
            />
          </>
        );
      case "hobbies":
        return (
          <>
            <label htmlFor={`${uid}-hobbies`} className="sr-only">
              Hobbies and recent
            </label>
            <textarea
              id={`${uid}-hobbies`}
              rows={isPage ? 16 : 5}
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              className={editorClass}
              placeholder="Human details you’re happy to weave into content…"
            />
          </>
        );
      case "client_results":
        return (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {clientResults.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
                No client results yet. Add a win the AI can cite.
              </p>
            ) : null}
            {clientResults.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Title
                </label>
                <input
                  type="text"
                  value={r.title}
                  onChange={(e) => {
                    const next = [...clientResults];
                    next[i] = { ...next[i]!, title: e.target.value };
                    setClientResults(next);
                  }}
                  placeholder="e.g. Doubled close rate in 90 days"
                  className={`${inputClass} mb-3`}
                />
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Outcome / story
                </label>
                <textarea
                  value={r.story}
                  onChange={(e) => {
                    const next = [...clientResults];
                    next[i] = { ...next[i]!, story: e.target.value };
                    setClientResults(next);
                  }}
                  placeholder="What changed, for whom, and how you got there…"
                  rows={isPage ? 6 : 3}
                  className={textareaClass}
                />
                <button
                  type="button"
                  onClick={() =>
                    setClientResults(clientResults.filter((_, j) => j !== i))
                  }
                  className="mt-2 text-xs font-medium text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setClientResults([...clientResults, { title: "", story: "" }])
              }
              className="rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              + Add client result
            </button>
          </div>
        );
      case "ideal_client":
        return (
          <>
            <label htmlFor={`${uid}-ideal-client`} className="sr-only">
              Ideal client
            </label>
            <textarea
              id={`${uid}-ideal-client`}
              rows={isPage ? 16 : 5}
              value={idealClient}
              onChange={(e) => setIdealClient(e.target.value)}
              className={editorClass}
              placeholder="Who you target — market, titles, size, revenue…"
            />
          </>
        );
      case "industry_vocabulary":
        return (
          <>
            <label htmlFor={`${uid}-industry-vocab`} className="sr-only">
              Industry vocabulary
            </label>
            <textarea
              id={`${uid}-industry-vocab`}
              rows={isPage ? 16 : 5}
              value={industryVocabulary}
              onChange={(e) => setIndustryVocabulary(e.target.value)}
              className={editorClass}
              placeholder="The trade words this ICP actually uses…"
            />
          </>
        );
      case "pain_language":
        return (
          <>
            <label htmlFor={`${uid}-pain-language`} className="sr-only">
              Pain language
            </label>
            <textarea
              id={`${uid}-pain-language`}
              rows={isPage ? 16 : 5}
              value={painLanguage}
              onChange={(e) => setPainLanguage(e.target.value)}
              className={editorClass}
              placeholder="Their pains and frustrations, in their own words…"
            />
          </>
        );
      case "messaging_hooks":
        return (
          <>
            <label htmlFor={`${uid}-messaging-hooks`} className="sr-only">
              Messaging hooks
            </label>
            <textarea
              id={`${uid}-messaging-hooks`}
              rows={isPage ? 16 : 5}
              value={messagingHooks}
              onChange={(e) => setMessagingHooks(e.target.value)}
              className={editorClass}
              placeholder="Openers and angles proven to land with this ICP…"
            />
          </>
        );
      case "proof_framing":
        return (
          <>
            <label htmlFor={`${uid}-proof-framing`} className="sr-only">
              Proof framing
            </label>
            <textarea
              id={`${uid}-proof-framing`}
              rows={isPage ? 16 : 5}
              value={proofFraming}
              onChange={(e) => setProofFraming(e.target.value)}
              className={editorClass}
              placeholder="How your proof / results should be framed for them…"
            />
          </>
        );
    }
  }

  const nav = (
    <nav aria-label="Brain categories" className="flex min-h-0 flex-col">
      {BRAIN_GROUPS.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;
              const hasContent = filled[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-sky-50 font-semibold text-sky-900"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-sky-700" : "text-slate-400"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        hasContent ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                      title={hasContent ? "Has content" : "Empty"}
                      aria-hidden
                    />
                    <span className="sr-only">
                      {hasContent ? ", has content" : ", empty"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const editorHeader = (
    <div className="mb-4 shrink-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <ActiveIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            {active.title}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
            {active.description}
          </p>
        </div>
      </div>
    </div>
  );

  const footer = (
    <div
      className={
        isPage
          ? "flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white/95 px-5 py-3.5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          : "sticky bottom-0 flex flex-col gap-2 border-t border-slate-100 bg-white pt-3"
      }
    >
      {saveError ? (
        <p className="text-sm text-rose-600" role="alert">
          {saveError}
        </p>
      ) : isPage ? (
        <p className="text-xs text-slate-400">
          Saves every category, not just this one.
        </p>
      ) : null}
      <div className={isPage ? "flex gap-2 sm:justify-end" : "flex gap-2"}>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={
              isPage
                ? "rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                : "flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className={
            isPage
              ? "rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              : "flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  if (!isPage) {
    return (
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-3">
        <p className="text-sm text-slate-600">
          The AI uses this for proof, voice, and specifics.{" "}
          <Link
            href={compassHref}
            className="font-medium text-sky-700 underline hover:text-sky-800"
          >
            Open Compass
          </Link>{" "}
          to update signature scores (shown read-only in the AI prompt).
        </p>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {ALL_SECTIONS.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? "bg-sky-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {editorHeader}
        {renderEditor()}
        {footer}
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col md:flex-row"
    >
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200/90 bg-white/80 md:w-56 md:border-b-0 md:border-r lg:w-60">
        <div className="hidden min-h-0 flex-1 overflow-y-auto px-2.5 py-4 md:flex md:flex-col">
          {nav}
        </div>
        <div className="overflow-x-auto px-3 py-2 md:hidden">
          <div className="flex gap-1">
            {ALL_SECTIONS.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? "bg-sky-700 text-white"
                      : filled[item.id]
                        ? "bg-white text-slate-700 ring-1 ring-slate-200"
                        : "bg-white text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hidden border-t border-slate-100 px-3 py-3 md:block">
          <Link
            href={compassHref}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-sky-800"
          >
            <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Compass scores (read-only here)
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white/60">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {editorHeader}
          <div className="flex min-h-0 flex-1 flex-col">{renderEditor()}</div>
        </div>
        {footer}
      </div>
    </form>
  );
}
