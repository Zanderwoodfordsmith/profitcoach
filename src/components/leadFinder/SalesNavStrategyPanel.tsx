"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { supabaseClient } from "@/lib/supabaseClient";
import type {
  ProspectSearchStrategiesResult,
  ProspectSearchStrategy,
} from "@/lib/salesNavigator/prospectSearch/types";

const fieldClass =
  "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900";

function kindLabel(kind: ProspectSearchStrategy["kind"]): string {
  switch (kind) {
    case "company_name":
      return "Company name";
    case "category_name":
      return "Category names";
    case "keywords":
      return "Keywords";
    case "beyond_linkedin":
      return "Beyond LinkedIn";
  }
}

function patternLabel(pattern: ProspectSearchStrategiesResult["namingPattern"]): string {
  switch (pattern) {
    case "name_rich":
      return "Name-rich industry";
    case "category_rich":
      return "Category-rich industry";
    case "name_poor":
      return "Name-poor industry";
    case "mixed":
      return "Mixed naming";
  }
}

function brainSourceLabel(source: string | null | undefined): string | null {
  if (source === "avatar") return "Using your First Campaign avatar";
  if (source === "icp") return "Using your selected ICP";
  if (source === "brain") return "Using your AI brain ideal client";
  return null;
}

export function SalesNavStrategyPanel({
  defaultIndustry,
  location,
  onApply,
}: {
  defaultIndustry: string;
  location: string;
  onApply: (strategy: ProspectSearchStrategy) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [industry, setIndustry] = useState(defaultIndustry);
  const [notes, setNotes] = useState("");
  const [sampleProfileNotes, setSampleProfileNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (ProspectSearchStrategiesResult & { usedBrainSource?: string | null }) | null
  >(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [brainHint, setBrainHint] = useState<string | null>(null);

  useEffect(() => {
    if (!result && !open) setIndustry(defaultIndustry);
  }, [defaultIndustry, result, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setSeeding(true);
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/coach/campaign-setup", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          selectedIcp?: { industry?: string | null; label?: string | null } | null;
          selectedAvatar?: {
            edited_payload?: {
              persona?: {
                headline?: string;
                demographics?: { occupation?: string };
              };
            } | null;
            generated_payload?: {
              persona?: {
                headline?: string;
                demographics?: { occupation?: string };
              };
            } | null;
          } | null;
        };
        const avatar =
          body.selectedAvatar?.edited_payload ??
          body.selectedAvatar?.generated_payload;
        const fromAvatar =
          avatar?.persona?.demographics?.occupation?.trim() ||
          avatar?.persona?.headline?.trim() ||
          "";
        const fromIcp =
          body.selectedIcp?.industry?.trim() ||
          body.selectedIcp?.label?.trim() ||
          "";
        const hint = fromAvatar || fromIcp || null;
        if (cancelled) return;
        setBrainHint(hint);
        if (hint) {
          setIndustry((prev) =>
            prev.trim() || defaultIndustry.trim() ? prev || defaultIndustry : hint
          );
        }
      } catch {
        // optional seed
      } finally {
        if (!cancelled) setSeeding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only seed when the modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open edge
  }, [open]);

  async function generate() {
    setLoading(true);
    setError(null);
    setAppliedId(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not signed in.");
        return;
      }
      const res = await fetch(
        "/api/admin/lead-finder/prospect-search-strategies",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            industry: industry.trim() || null,
            location: location.trim() || "United Kingdom",
            notes: notes.trim() || null,
            sampleProfileNotes: sampleProfileNotes.trim() || null,
            useBrainAvatar: true,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as
        | (ProspectSearchStrategiesResult & { usedBrainSource?: string | null })
        | { error?: string };
      if (!res.ok) {
        setError(
          "error" in body && body.error
            ? body.error
            : "Could not generate strategies."
        );
        setResult(null);
        return;
      }
      setResult(body as ProspectSearchStrategiesResult & {
        usedBrainSource?: string | null;
      });
    } catch {
      setError("Could not generate strategies.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleApply(strategy: ProspectSearchStrategy) {
    onApply(strategy);
    setAppliedId(strategy.id);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        title="Suggest Sales Navigator searches from your avatar"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Suggest
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={loading}
        title="Suggest prospect searches"
        subtitle="Optional — uses your First Campaign avatar / AI brain when set. Main flow is still Import."
        maxWidthClassName="max-w-lg"
        overlayClassName="z-[60]"
      >
        <div className="max-h-[min(70vh,36rem)] space-y-4 overflow-y-auto px-5 py-4">
          {brainHint ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Avatar hint: <span className="font-medium text-slate-800">{brainHint}</span>
            </p>
          ) : seeding ? (
            <p className="text-xs text-slate-400">Looking up your avatar…</p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Ideal avatar / industry
            </span>
            <input
              className={fieldClass}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Leave blank to use AI brain avatar, or type a niche…"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Notes (optional)
            </span>
            <input
              className={fieldClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Already exhausted engineering-in-name…"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Words from 3 good profiles (optional)
            </span>
            <textarea
              className={`${fieldClass} min-h-[4rem] resize-y`}
              value={sampleProfileNotes}
              onChange={(e) => setSampleProfileNotes(e.target.value)}
              placeholder='e.g. "cloud services", specialties: wine & spirits…'
            />
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate strategies
              </>
            )}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {result ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  {patternLabel(result.namingPattern)}
                </p>
                {brainSourceLabel(result.usedBrainSource) ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {brainSourceLabel(result.usedBrainSource)}
                  </p>
                ) : null}
                {result.namingPatternRationale ? (
                  <p className="mt-1 text-xs text-slate-600">
                    {result.namingPatternRationale}
                  </p>
                ) : null}
                {result.coachFacingSummary ? (
                  <p className="mt-2 text-sm text-slate-800">
                    {result.coachFacingSummary}
                  </p>
                ) : null}
              </div>

              <ul className="space-y-2">
                {result.strategies.map((strategy) => {
                  const applied = appliedId === strategy.id;
                  const canApply = strategy.kind !== "beyond_linkedin";
                  return (
                    <li
                      key={strategy.id}
                      className="rounded-md border border-slate-200 bg-slate-50/40 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                            #{strategy.priority} · {kindLabel(strategy.kind)}
                          </p>
                          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
                            {strategy.label}
                          </h3>
                        </div>
                        {canApply ? (
                          <button
                            type="button"
                            onClick={() => handleApply(strategy)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                              applied
                                ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {applied ? (
                              <>
                                <Check className="h-3 w-3" />
                                Applied
                              </>
                            ) : (
                              "Apply filters"
                            )}
                          </button>
                        ) : null}
                      </div>
                      {strategy.rationale ? (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">
                          {strategy.rationale}
                        </p>
                      ) : null}
                      {strategy.filters.companyIncludes.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">
                            Company includes:{" "}
                          </span>
                          {strategy.filters.companyIncludes.join(", ")}
                        </p>
                      ) : null}
                      {strategy.filters.keywordsBoolean ? (
                        <p className="mt-2 font-mono text-xs text-slate-800">
                          {strategy.filters.keywordsBoolean}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
