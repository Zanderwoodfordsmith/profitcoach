"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { buttonClass } from "@/components/ui/Button";
import type { SalesNavSuggestResponse } from "@/lib/salesNavigator/prospectSearch/suggestFromBlueprint";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: SalesNavSuggestResponse };

/** Sales Nav searches built from the coach's Blueprint, one click to use. */
export function SalesNavBlueprintSuggest({
  selectedUrl,
  onUse,
}: {
  selectedUrl: string;
  onUse: (url: string) => void;
}) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function suggest() {
    setState({ status: "loading" });
    const headers = await getCoachAuthHeaders();
    if (!headers) {
      setState({ status: "error", message: "Not signed in." });
      return;
    }
    try {
      const res = await fetch("/api/coach/sales-nav-import/suggest", {
        method: "POST",
        headers,
      });
      const body = (await res.json().catch(() => null)) as
        | (SalesNavSuggestResponse & { error?: string })
        | null;
      if (!res.ok || !body?.searches) {
        setState({
          status: "error",
          message: body?.error || "Could not suggest a search. Try again.",
        });
        return;
      }
      setState({ status: "ready", data: body });
    } catch {
      setState({ status: "error", message: "Could not suggest a search. Try again." });
    }
  }

  if (state.status !== "ready") {
    const loading = state.status === "loading";
    return (
      <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0c5290] text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Build my search from my Blueprint
            </p>
            <p className="mt-0.5 text-sm leading-snug text-slate-600">
              {loading
                ? "Reading your Blueprint and picking the words owners use in their company names. This takes about a minute."
                : "We pick the company names and sizes to search, the way the Classroom teaches."}
            </p>
            {state.status === "error" ? (
              <p className="mt-1.5 text-sm text-rose-700">{state.message}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void suggest()}
          className={buttonClass("main", "small", "mt-3 w-full")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {loading ? "Building your search…" : "Suggest a search"}
        </button>
      </div>
    );
  }

  const { data } = state;
  return (
    <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#0c5290]">
        <Sparkles className="h-4 w-4" aria-hidden />
        From your Blueprint
      </div>
      <p className="mt-1 text-sm leading-snug text-slate-600">
        Owners and founders in {data.region}, companies of{" "}
        {data.teamSizes.join(" and ")} staff. Start with the first one.
      </p>
      <ul className="mt-3 space-y-2">
        {data.searches.map((search, index) => {
          const chosen = selectedUrl.trim() === search.url;
          return (
            <li
              key={search.id}
              className={`rounded-xl border bg-white p-3 transition-colors ${
                chosen ? "border-[#0c5290] ring-1 ring-[#0c5290]" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-[#0c5290]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{search.label}</p>
                  <p className="mt-0.5 text-sm leading-snug text-slate-600">
                    {search.rationale}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {search.terms.length > 0 ? (
                      search.terms.map((term) => (
                        <span
                          key={term}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {term}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                        {search.keywords}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUse(search.url)}
                      className={buttonClass(chosen ? "main" : "second", "small")}
                    >
                      {chosen ? <Check className="h-4 w-4" aria-hidden /> : null}
                      {chosen ? "Using this search" : "Use this search"}
                    </button>
                    <a
                      href={search.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#0c5290] hover:underline"
                    >
                      Check it in Sales Navigator
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
