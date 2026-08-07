"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CoachAiContext } from "@/lib/profitCoachAi/types";

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        )}
        {title}
      </button>
      {open ? (
        <div className="border-t border-slate-200 px-4 pb-4 pt-1">{children}</div>
      ) : null}
    </div>
  );
}

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
  /** Page tab: larger intro + max width handled by parent */
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
  const init = buildInitialBrainForm(initialContext, draftFromChat);
  const [superpowers, setSuperpowers] = useState(init.superpowers);
  const [hobbies, setHobbies] = useState(init.hobbies);
  const [clientResults, setClientResults] = useState(init.clientResults);
  const [idealClient, setIdealClient] = useState(init.idealClient);
  const [industryVocabulary, setIndustryVocabulary] = useState(init.industryVocabulary);
  const [painLanguage, setPainLanguage] = useState(init.painLanguage);
  const [messagingHooks, setMessagingHooks] = useState(init.messagingHooks);
  const [proofFraming, setProofFraming] = useState(init.proofFraming);

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

  const intro =
    variant === "page" ? (
      <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Knowledge the AI uses every time</p>
        <p className="mt-1 leading-relaxed">
          Superpowers, human details, and client wins feed the coach so replies stay
          specific to you. Signature scores come from{" "}
          <Link
            href={compassHref}
            className="font-medium text-sky-700 underline hover:text-sky-800"
          >
            Compass
          </Link>{" "}
          (read-only in the model).
        </p>
      </div>
    ) : (
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
    );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-col gap-3"
    >
      {intro}

      <Section title="Superpowers" defaultOpen>
        <label htmlFor={`${uid}-superpowers`} className="sr-only">
          Superpowers
        </label>
        <textarea
          id={`${uid}-superpowers`}
          rows={variant === "page" ? 5 : 4}
          value={superpowers}
          onChange={(e) => setSuperpowers(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          placeholder="What you’re uniquely strong at…"
        />
      </Section>

      <Section title="Hobbies & recent">
        <label htmlFor={`${uid}-hobbies`} className="sr-only">
          Hobbies and recent
        </label>
        <textarea
          id={`${uid}-hobbies`}
          rows={3}
          value={hobbies}
          onChange={(e) => setHobbies(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
          placeholder="Human details you’re happy to weave into content…"
        />
      </Section>

      <Section title="Client results">
        <div className="flex flex-col gap-3">
          {clientResults.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <input
                type="text"
                value={r.title}
                onChange={(e) => {
                  const next = [...clientResults];
                  next[i] = { ...next[i]!, title: e.target.value };
                  setClientResults(next);
                }}
                placeholder="Title"
                className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-medium"
              />
              <textarea
                value={r.story}
                onChange={(e) => {
                  const next = [...clientResults];
                  next[i] = { ...next[i]!, story: e.target.value };
                  setClientResults(next);
                }}
                placeholder="Outcome / story"
                rows={3}
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
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
            className="rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            + Add client result
          </button>
        </div>
      </Section>

      <Section title="Campaign & ICP (from First Campaign Setup)">
        <p className="mb-3 text-xs text-slate-500">
          Confirmed from your First Campaign wizard. Feeds message generation
          and future AI content — edit here any time.
        </p>
        <div className="flex flex-col gap-3">
          <label htmlFor={`${uid}-ideal-client`} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Ideal client
            </span>
            <textarea
              id={`${uid}-ideal-client`}
              rows={2}
              value={idealClient}
              onChange={(e) => setIdealClient(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              placeholder="Who you target — market, titles, size, revenue…"
            />
          </label>
          <label htmlFor={`${uid}-industry-vocab`} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Industry vocabulary
            </span>
            <textarea
              id={`${uid}-industry-vocab`}
              rows={2}
              value={industryVocabulary}
              onChange={(e) => setIndustryVocabulary(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              placeholder="The trade words this ICP actually uses…"
            />
          </label>
          <label htmlFor={`${uid}-pain-language`} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Pain language
            </span>
            <textarea
              id={`${uid}-pain-language`}
              rows={2}
              value={painLanguage}
              onChange={(e) => setPainLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              placeholder="Their pains and frustrations, in their own words…"
            />
          </label>
          <label htmlFor={`${uid}-messaging-hooks`} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Messaging hooks
            </span>
            <textarea
              id={`${uid}-messaging-hooks`}
              rows={2}
              value={messagingHooks}
              onChange={(e) => setMessagingHooks(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              placeholder="Openers and angles proven to land with this ICP…"
            />
          </label>
          <label htmlFor={`${uid}-proof-framing`} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Proof framing
            </span>
            <textarea
              id={`${uid}-proof-framing`}
              rows={2}
              value={proofFraming}
              onChange={(e) => setProofFraming(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              placeholder="How your proof / results should be framed for them…"
            />
          </label>
        </div>
      </Section>

      {saveError ? (
        <p className="text-sm text-rose-600" role="alert">
          {saveError}
        </p>
      ) : null}

      <div
        className={
          variant === "page"
            ? "sticky bottom-0 flex flex-col gap-2 border-t border-slate-100 bg-white/95 pt-4 backdrop-blur-sm sm:flex-row sm:justify-end"
            : "sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white pt-3"
        }
      >
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={
              variant === "page"
                ? "order-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:order-1 sm:px-6"
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
            variant === "page"
              ? "order-1 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:order-2"
              : "flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
