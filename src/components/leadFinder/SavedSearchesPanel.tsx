"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { LEADROCKS_US_STATES } from "@/lib/leadFinder/leadrocksOptions";
import {
  buildDefaultSearches,
  clampPostcode,
  countryLabel,
  splitGeography,
  type AppliedDefaultSearch,
  type SearchMarket,
} from "@/lib/salesNavigator/defaultSearches";
import type { ProspectSearchStrategy } from "@/lib/salesNavigator/prospectSearch/types";
import { supabaseClient } from "@/lib/supabaseClient";

const MARKET_STORAGE_KEY = "lead-finder-search-market";

const fieldClass =
  "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900";

function loadStoredMarket(): SearchMarket | null {
  try {
    const v = window.localStorage.getItem(MARKET_STORAGE_KEY);
    if (v === "GB" || v === "US") return v;
  } catch {
    // ignore
  }
  return null;
}

function persistMarket(market: SearchMarket) {
  try {
    window.localStorage.setItem(MARKET_STORAGE_KEY, market);
  } catch {
    // ignore
  }
}

export function SavedSearchesPanel({
  onApply,
}: {
  onApply: (search: AppliedDefaultSearch) => void;
}): ReactNode {
  const [market, setMarket] = useState<SearchMarket>("GB");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [state, setState] = useState("");
  const [industryHint, setIndustryHint] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [strategies, setStrategies] = useState<ProspectSearchStrategy[] | null>(
    null
  );
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredMarket();
    if (stored) setMarket(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token || cancelled) return;
        const res = await fetch("/api/coach/campaign-setup", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          selectedIcp?: {
            industry?: string | null;
            geography?: string | null;
            label?: string | null;
          } | null;
          selectedAvatar?: {
            edited_payload?: {
              persona?: {
                headline?: string;
                demographics?: { occupation?: string; location?: string };
              };
            } | null;
            generated_payload?: {
              persona?: {
                headline?: string;
                demographics?: { occupation?: string; location?: string };
              };
            } | null;
          } | null;
        };
        const avatar =
          body.selectedAvatar?.edited_payload ??
          body.selectedAvatar?.generated_payload;
        const geo =
          body.selectedIcp?.geography?.trim() ||
          avatar?.persona?.demographics?.location?.trim() ||
          "";
        const parsed = splitGeography(geo);
        const industry =
          avatar?.persona?.demographics?.occupation?.trim() ||
          body.selectedIcp?.industry?.trim() ||
          body.selectedIcp?.label?.trim() ||
          "";
        if (cancelled) return;
        if (!loadStoredMarket() && parsed.market) setMarket(parsed.market);
        if (parsed.town) setTown(parsed.town);
        if (parsed.state) setState(parsed.state);
        if (industry) setIndustryHint(industry.slice(0, 120));
      } catch {
        // optional seed
      } finally {
        if (!cancelled) setSeeded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!seeded) return;
    try {
      const raw = window.sessionStorage.getItem("lead-finder-ideal-strategies-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        industry?: string;
        strategies?: ProspectSearchStrategy[];
      };
      if (
        parsed.industry === industryHint.trim() &&
        Array.isArray(parsed.strategies)
      ) {
        setStrategies(parsed.strategies);
      }
    } catch {
      // ignore bad cache
    }
  }, [seeded, industryHint]);

  const ctx = useMemo(
    () => ({ market, town, postcode, state, industryHint }),
    [market, town, postcode, state, industryHint]
  );

  const searches = useMemo(
    () => buildDefaultSearches(ctx, strategies),
    [ctx, strategies]
  );

  async function loadStrategies(): Promise<ProspectSearchStrategy[] | null> {
    if (strategies?.length) return strategies;
    setLoadingStrategies(true);
    setStrategyError(null);
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setStrategyError("Not signed in.");
        return null;
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
            industry: industryHint.trim() || null,
            location: countryLabel(market),
            useBrainAvatar: true,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        strategies?: ProspectSearchStrategy[];
        error?: string;
      };
      if (!res.ok) {
        setStrategies(null);
        setStrategyError(body.error ?? "Could not load ideal-client searches.");
        return null;
      }
      const next = body.strategies ?? [];
      setStrategies(next);
      try {
        window.sessionStorage.setItem(
          "lead-finder-ideal-strategies-v1",
          JSON.stringify({ industry: industryHint.trim(), strategies: next })
        );
      } catch {
        // ignore quota
      }
      return next;
    } catch {
      setStrategies(null);
      setStrategyError("Could not load ideal-client searches.");
      return null;
    } finally {
      setLoadingStrategies(false);
    }
  }

  const baseSearches = searches.filter((s) => s.id.startsWith("base-"));
  const idealSearches = searches.filter((s) => s.id.startsWith("ideal-"));

  function handleMarket(next: SearchMarket) {
    setMarket(next);
    persistMarket(next);
    setAppliedId(null);
  }

  function openSearch(search: AppliedDefaultSearch, tab?: Window | null) {
    onApply(search);
    setAppliedId(search.id);
    if (!search.url) return;
    if (tab && !tab.closed) {
      tab.location.href = search.url;
      return;
    }
    window.open(search.url, "_blank", "noopener,noreferrer");
  }

  function handleClick(search: AppliedDefaultSearch) {
    if (search.ready) {
      openSearch(search);
      return;
    }
    if (search.id !== "ideal-company" && search.id !== "ideal-keywords") return;
    if (loadingStrategies) return;

    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    void (async () => {
      const loaded = await loadStrategies();
      const next = buildDefaultSearches(ctx, loaded);
      const match = next.find((s) => s.id === search.id);
      if (match?.ready) {
        openSearch(match, tab);
        return;
      }
      tab?.close();
    })();
  }

  return (
    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            One-click searches
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Opens Sales Navigator with the filters already set. Import still
            uses the sidebar.
          </p>
        </div>
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
          {(["GB", "US"] as const).map((m) => {
            const on = market === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleMarket(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  on
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "GB" ? "UK" : "USA"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
            {market === "US" ? "City" : "Town"}
          </span>
          <input
            className={fieldClass}
            value={town}
            maxLength={80}
            onChange={(e) => setTown(e.target.value.slice(0, 80))}
            placeholder={market === "US" ? "Austin, Chicago…" : "Manchester, Bristol…"}
          />
        </label>
        {market === "GB" ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Postcode
            </span>
            <input
              className={fieldClass}
              value={postcode}
              maxLength={12}
              onChange={(e) => setPostcode(clampPostcode(e.target.value))}
              placeholder="AL1, M1, BS8…"
              autoCapitalize="characters"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              State
            </span>
            <select
              className={`${fieldClass} bg-transparent`}
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Pick a state…</option>
              {LEADROCKS_US_STATES.map((s) => (
                <option key={s.code} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <SearchRow
        title="Base search"
        searches={baseSearches}
        appliedId={appliedId}
        loading={false}
        onClick={handleClick}
      />

      <SearchRow
        title="Ideal client"
        searches={idealSearches}
        appliedId={appliedId}
        loading={loadingStrategies}
        onClick={handleClick}
        trailing={
          loadingStrategies ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Matching avatar…
            </span>
          ) : strategyError && !industryHint ? (
            <span className="text-[11px] text-slate-400">{strategyError}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Sparkles className="h-3 w-3" />
              From your avatar / ICP
            </span>
          )
        }
      />
    </div>
  );
}

function canClickSearch(
  search: AppliedDefaultSearch,
  loading: boolean
): boolean {
  if (search.ready) return true;
  if (loading) return false;
  return search.id === "ideal-company" || search.id === "ideal-keywords";
}

function SearchRow({
  title,
  searches,
  appliedId,
  loading,
  onClick,
  trailing,
}: {
  title: string;
  searches: AppliedDefaultSearch[];
  appliedId: string | null;
  loading: boolean;
  onClick: (search: AppliedDefaultSearch) => void;
  trailing?: ReactNode;
}): ReactNode {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          {title}
        </p>
        {trailing}
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((search) => {
          const applied = appliedId === search.id;
          const clickable = canClickSearch(search, loading);
          return (
            <button
              key={search.id}
              type="button"
              disabled={!clickable}
              title={
                search.ready
                  ? search.description
                  : search.id === "ideal-company" || search.id === "ideal-keywords"
                    ? "Builds from your avatar, then opens Sales Navigator."
                    : (search.missingHint ?? search.description)
              }
              onClick={() => onClick(search)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition ${
                !clickable
                  ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400"
                  : applied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{search.label}</span>
              {clickable ? (
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
