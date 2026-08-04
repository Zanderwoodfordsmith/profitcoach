"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  X,
} from "lucide-react";
import { ToolkitHubTabs } from "@/components/admin/ToolkitHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { isLeadFinderAllowedEmail } from "@/lib/leadFinderAccess";
import {
  LEAD_FINDER_PAGE_SIZE,
  LEAD_FINDER_PAGE_SIZE_OPTIONS,
} from "@/lib/leadFinder/constants";
import { formatLeadLocation, companyWebsiteHref } from "@/lib/leadFinder/display";
import {
  LEADROCKS_JOB_TITLE_PRESETS,
  LEADROCKS_REVENUE_RANGES,
  LEADROCKS_TEAM_SIZES,
  LEADROCKS_US_STATES,
} from "@/lib/leadFinder/leadrocksOptions";
import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import {
  buildSalesNavSearchUrl,
  type SalesNavDegree,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import type { LeadReveal, LeadTeaser } from "@/lib/leadFinder/types";
import { supabaseClient } from "@/lib/supabaseClient";

type SearchResult = {
  leads: LeadTeaser[];
  fromCache: number;
  fromApify: number;
  requested: number;
  totalMatched: number;
  page: number;
  pageSize: number;
  totalPages: number;
  cacheOnly: boolean;
  relaxedFilters?: string[];
  note?: string | null;
  dataExportedAt?: string | null;
};

type SearchPayload = {
  categories: string[];
  jobTitles: string[];
  jobTitleExcludes: string[];
  states: string[];
  locations: string[];
  industries: string[];
  companies: string[];
  companyExcludes: string[];
  teamSizes: string[];
  revenueRanges: string[];
  requireContacts: Array<"email" | "phone" | "linkedin">;
};

type FilterKeyword = {
  term: string;
  mode: "include" | "exclude";
};

const fieldClass =
  "w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900";

/**
 * Keyword chips (Sales Navigator-style): green include / red exclude.
 * Click chip or Ban to flip; X removes.
 */
function KeywordChipField({
  label,
  placeholder,
  values,
  onChange,
  suggestions = [],
}: {
  label: string;
  placeholder: string;
  values: FilterKeyword[];
  onChange: (next: FilterKeyword[]) => void;
  suggestions?: readonly string[];
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = useMemo(
    () => new Set(values.map((v) => v.term.toLowerCase())),
    [values]
  );

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !selected.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [draft, selected, suggestions]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addTerms(rawTerms: string[]) {
    const existing = new Set(values.map((v) => v.term.toLowerCase()));
    const added: FilterKeyword[] = [];
    for (const term of rawTerms.map((s) => s.trim()).filter(Boolean)) {
      if (existing.has(term.toLowerCase())) continue;
      existing.add(term.toLowerCase());
      added.push({ term, mode: "include" });
    }
    if (added.length === 0) return;
    onChange([...values, ...added]);
  }

  function commitDraft() {
    const terms = draft
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (terms.length === 0) return;
    addTerms(terms);
    setDraft("");
    setOpen(false);
  }

  function pickSuggestion(term: string) {
    addTerms([term]);
    setDraft("");
    setOpen(false);
  }

  function toggleMode(term: string) {
    onChange(
      values.map((v) =>
        v.term === term
          ? { ...v, mode: v.mode === "include" ? "exclude" : "include" }
          : v
      )
    );
  }

  function remove(term: string) {
    onChange(values.filter((v) => v.term !== term));
  }

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => {
            const excluded = v.mode === "exclude";
            return (
              <span
                key={v.term}
                className={`inline-flex max-w-full items-center gap-0.5 rounded-full border pl-2.5 pr-1 py-0.5 text-xs font-medium ${
                  excluded
                    ? "border-rose-300 bg-rose-100 text-rose-800"
                    : "border-emerald-300 bg-emerald-100 text-emerald-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleMode(v.term)}
                  title={
                    excluded
                      ? "Excluded — click to include"
                      : "Included — click to exclude"
                  }
                  className="inline-flex min-w-0 items-center gap-1 truncate"
                >
                  {excluded ? (
                    <Ban className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.25} />
                  ) : null}
                  <span className="min-w-0 truncate">{v.term}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${v.term}`}
                  className={`shrink-0 rounded-full p-1 ${
                    excluded
                      ? "text-rose-600 hover:bg-rose-200/70 hover:text-rose-900"
                      : "text-emerald-700 hover:bg-emerald-200/70 hover:text-emerald-950"
                  }`}
                  onClick={() => remove(v.term)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <input
        value={draft}
        aria-expanded={showSuggestions}
        aria-controls={listId}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (
              filteredSuggestions.length > 0 &&
              draft.trim() &&
              filteredSuggestions[0].toLowerCase() === draft.trim().toLowerCase()
            ) {
              pickSuggestion(filteredSuggestions[0]);
              return;
            }
            commitDraft();
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        placeholder={placeholder}
        className={fieldClass}
      />
      {showSuggestions && filteredSuggestions.length > 0 ? (
        <ul
          id={listId}
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto border border-slate-200 bg-white py-1 shadow-sm"
        >
          {filteredSuggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => pickSuggestion(s)}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PlusChipFilter({
  label,
  options,
  values,
  onChange,
  searchable = false,
  single = false,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  /** When true, picking an option replaces the selection (country-style). */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const available = useMemo(() => {
    const selected = new Set(values);
    const remaining = options.filter((o) => !selected.has(o.value));
    const q = query.trim().toLowerCase();
    if (!q) return remaining;
    return remaining.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query, values]);

  function add(value: string) {
    if (values.includes(value)) return;
    onChange(single ? [value] : [...values, value]);
    setQuery("");
    if (single) setOpen(false);
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`Add ${label}`}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center border transition ${
            open
              ? "border-slate-900 text-slate-900"
              : "border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700"
          }`}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => {
            const labelText =
              options.find((o) => o.value === value)?.label ?? value;
            return (
              <span
                key={value}
                className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-100 pl-2.5 pr-1 py-0.5 text-xs font-medium text-emerald-800"
              >
                <span className="min-w-0 truncate">{labelText}</span>
                <button
                  type="button"
                  aria-label={`Remove ${labelText}`}
                  className="shrink-0 rounded-full p-1 text-emerald-700 hover:bg-emerald-200/70 hover:text-emerald-950"
                  onClick={() => remove(value)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div
          id={listId}
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden border border-slate-200 bg-white shadow-sm"
        >
          {searchable ? (
            <div className="border-b border-slate-100 px-2 py-2">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          ) : null}
          <ul className="max-h-56 overflow-y-auto py-1">
            {available.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">
                {values.length === options.length
                  ? "All options added"
                  : "No matches"}
              </li>
            ) : (
              available.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => add(opt.value)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">{opt.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type CountryCode = "GB" | "US" | "OTHER";

const COUNTRY_OPTIONS: Array<{ value: CountryCode; label: string }> = [
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "OTHER", label: "🌍 Other" },
];

type ColumnKey =
  | "company"
  | "location"
  | "industry"
  | "size"
  | "revenue"
  | "contact";

const COLUMN_OPTIONS: Array<{ key: ColumnKey; label: string; defaultOn: boolean }> =
  [
    { key: "company", label: "Company", defaultOn: true },
    { key: "location", label: "Location", defaultOn: true },
    { key: "industry", label: "Industry", defaultOn: true },
    { key: "size", label: "Size", defaultOn: true },
    { key: "revenue", label: "Revenue", defaultOn: false },
    { key: "contact", label: "Contact", defaultOn: true },
  ];

const COLUMNS_STORAGE_KEY = "lead_finder_columns_v1";
const COACH_VIEW_STORAGE_KEY = "lead_finder_coach_view";

function defaultColumns(): Record<ColumnKey, boolean> {
  return Object.fromEntries(
    COLUMN_OPTIONS.map((c) => [c.key, c.defaultOn])
  ) as Record<ColumnKey, boolean>;
}

function loadColumns(): Record<ColumnKey, boolean> {
  const base = defaultColumns();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
    for (const opt of COLUMN_OPTIONS) {
      if (typeof parsed[opt.key] === "boolean") base[opt.key] = parsed[opt.key]!;
    }
    return base;
  } catch {
    return base;
  }
}

function CompanyCell({ lead }: { lead: LeadTeaser }) {
  const href = companyWebsiteHref(lead.companyWebsite);
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="min-w-0 text-slate-600">{lead.company ?? "—"}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          title={href}
          aria-label={`Open ${lead.company ?? "company"} website`}
          className="mt-0.5 shrink-0 text-slate-400 transition hover:text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function ContactAvailability({
  lead,
  full,
  coachView,
  revealing,
  onReveal,
  onHide,
}: {
  lead: LeadTeaser;
  full: LeadReveal | undefined;
  coachView: boolean;
  revealing: boolean;
  onReveal: () => void;
  onHide: () => void;
}) {
  if (full && !coachView) {
    return (
      <div className="space-y-1 text-left text-xs text-slate-600">
        {full.email ? <p className="break-all">{full.email}</p> : null}
        {full.email2 ? <p className="break-all">{full.email2}</p> : null}
        {full.phone ? <p>{full.phone}</p> : null}
        {full.phone2 ? <p>{full.phone2}</p> : null}
        {full.linkedinUrl ? (
          <a
            href={full.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-slate-700 underline-offset-2 hover:underline"
          >
            <Linkedin className="h-3 w-3" />
            LinkedIn
          </a>
        ) : null}
        {!full.email && !full.phone && !full.linkedinUrl ? (
          <p className="text-slate-400">No contact details</p>
        ) : null}
      </div>
    );
  }

  if (full && coachView) {
    return (
      <div className="space-y-1.5 text-left">
        <div className="space-y-0.5 text-xs text-slate-600">
          {full.email ? <p className="break-all">{full.email}</p> : null}
          {full.phone ? <p>{full.phone}</p> : null}
          {full.linkedinUrl ? (
            <a
              href={full.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <Linkedin className="h-3 w-3" />
              LinkedIn
            </a>
          ) : null}
        </div>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-700"
          onClick={onHide}
        >
          Hide
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-left">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          title={lead.hasEmail ? lead.emailHint ?? "Email available" : "No email"}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
            lead.hasEmail
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-50 text-slate-300"
          }`}
        >
          <Mail className="h-3 w-3" />
          {lead.hasEmail ? lead.emailHint ?? "Email" : "—"}
        </span>
        <span
          title={lead.hasPhone ? lead.phoneHint ?? "Phone available" : "No phone"}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
            lead.hasPhone
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-50 text-slate-300"
          }`}
        >
          <Phone className="h-3 w-3" />
          {lead.hasPhone ? lead.phoneHint ?? "Phone" : "—"}
        </span>
        <span
          title={lead.hasLinkedIn ? "LinkedIn available" : "No LinkedIn"}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
            lead.hasLinkedIn
              ? "bg-emerald-50 text-emerald-800"
              : "bg-slate-50 text-slate-300"
          }`}
        >
          <Linkedin className="h-3 w-3" />
        </span>
      </div>
      <button
        type="button"
        onClick={onReveal}
        disabled={revealing}
        className="text-xs font-medium text-slate-800 underline-offset-2 hover:underline disabled:opacity-50"
      >
        {revealing ? "…" : "Reveal"}
      </button>
    </div>
  );
}

const CONTACT_FILTER_OPTIONS: Array<{
  value: "email" | "phone" | "linkedin";
  label: string;
}> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "linkedin", label: "LinkedIn" },
];

const DEFAULT_JOB_TITLE_KEYWORDS: FilterKeyword[] = defaultJobTitleKeywords();
const DEFAULT_COMPANY_KEYWORDS: FilterKeyword[] = defaultCompanyKeywords();
const DEFAULT_TEAM_SIZES = ["11-50"];

type SourceTab = "database" | "sales_nav";

export function LeadFinderClient() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sourceTab, setSourceTab] = useState<SourceTab>("database");
  const [jobTitleKeywords, setJobTitleKeywords] = useState<FilterKeyword[]>(
    DEFAULT_JOB_TITLE_KEYWORDS
  );
  const [country, setCountry] = useState<CountryCode>("GB");
  const [states, setStates] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyKeywords, setCompanyKeywords] = useState<FilterKeyword[]>(
    DEFAULT_COMPANY_KEYWORDS
  );
  const [teamSizes, setTeamSizes] = useState<string[]>(DEFAULT_TEAM_SIZES);
  const [revenueRanges, setRevenueRanges] = useState<string[]>([]);
  const [requireContacts, setRequireContacts] = useState<
    Array<"email" | "phone" | "linkedin">
  >([]);
  const [salesNavLocation, setSalesNavLocation] = useState("United Kingdom");
  const [salesNavDegrees, setSalesNavDegrees] = useState<SalesNavDegree[]>([
    "2",
    "3",
  ]);
  const [salesNavPreset, setSalesNavPreset] = useState<
    "uk_base" | "warm_1st" | null
  >("uk_base");
  const [copiedSalesNav, setCopiedSalesNav] = useState(false);
  const [pageSize, setPageSize] = useState<number>(LEAD_FINDER_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [lastPayload, setLastPayload] = useState<SearchPayload | null>(null);
  const [revealed, setRevealed] = useState<Record<string, LeadReveal>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [coachView, setCoachView] = useState(false);
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(defaultColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const didInitialSearch = useRef(false);
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  useEffect(() => {
    setColumns(loadColumns());
    try {
      setCoachView(window.localStorage.getItem(COACH_VIEW_STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setAllowed(isLeadFinderAllowedEmail(user?.email));
    })();
  }, []);

  useEffect(() => {
    if (country !== "US") setStates([]);
  }, [country]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!columnsRef.current?.contains(e.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [columnsOpen]);

  function toggleColumn(key: ColumnKey) {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function toggleCoachView() {
    setCoachView((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem(COACH_VIEW_STORAGE_KEY, "1");
        else window.localStorage.removeItem(COACH_VIEW_STORAGE_KEY);
      } catch {
        // ignore
      }
      if (next) setRevealed({});
      return next;
    });
  }

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, []);

  function buildLocations(): string[] {
    const city = location.trim();
    if (city) return [city];
    if (country === "GB") return ["United Kingdom"];
    if (country === "US") return ["United States"];
    return [];
  }

  function buildPayload(): SearchPayload {
    return {
      // Empty categories → whole local lead table; country is location-only.
      categories: [],
      jobTitles: jobTitleKeywords
        .filter((k) => k.mode === "include")
        .map((k) => k.term),
      jobTitleExcludes: jobTitleKeywords
        .filter((k) => k.mode === "exclude")
        .map((k) => k.term),
      states: country === "US" ? states : [],
      locations: buildLocations(),
      industries: industry.trim() ? [industry.trim()] : [],
      companies: companyKeywords
        .filter((k) => k.mode === "include")
        .map((k) => k.term),
      companyExcludes: companyKeywords
        .filter((k) => k.mode === "exclude")
        .map((k) => k.term),
      teamSizes,
      revenueRanges,
      requireContacts,
    };
  }

  const runSearch = useCallback(
    async (
      payload: SearchPayload,
      page: number,
      mode: "search" | "page",
      size?: number
    ) => {
      const headers = await authHeaders();
      if (!headers) {
        setError("Not signed in.");
        return;
      }
      if (mode === "search") setLoading(true);
      else setPageLoading(true);
      setError(null);
      setRevealed({});
      try {
        const res = await fetch("/api/admin/lead-finder/search", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...payload,
            page,
            pageSize: size ?? pageSizeRef.current,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as SearchResult & {
          error?: string;
        };
        if (!res.ok) {
          setError(body.error ?? "Search failed.");
          if (mode === "search") setResult(null);
          return;
        }
        setLastPayload(payload);
        setResult(body);
        setHasSearched(true);
      } catch {
        setError("Search failed.");
        if (mode === "search") setResult(null);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    if (!allowed || didInitialSearch.current) return;
    didInitialSearch.current = true;
    void runSearch(
      {
        categories: [],
        jobTitles: DEFAULT_JOB_TITLE_KEYWORDS.filter((k) => k.mode === "include").map(
          (k) => k.term
        ),
        jobTitleExcludes: DEFAULT_JOB_TITLE_KEYWORDS.filter(
          (k) => k.mode === "exclude"
        ).map((k) => k.term),
        states: [],
        locations: ["United Kingdom"],
        industries: [],
        companies: DEFAULT_COMPANY_KEYWORDS.filter((k) => k.mode === "include").map(
          (k) => k.term
        ),
        companyExcludes: DEFAULT_COMPANY_KEYWORDS.filter(
          (k) => k.mode === "exclude"
        ).map((k) => k.term),
        teamSizes: DEFAULT_TEAM_SIZES,
        revenueRanges: [],
        requireContacts: [],
      },
      1,
      "search"
    );
  }, [allowed, runSearch]);

  const salesNavUrl = useMemo(
    () =>
      buildSalesNavSearchUrl({
        titleKeywords: jobTitleKeywords,
        companyKeywords: [
          ...companyKeywords,
          ...(industry.trim()
            ? [{ term: industry.trim(), mode: "include" as const }]
            : []),
        ],
        teamSizes,
        location: salesNavLocation,
        degrees: salesNavDegrees,
      }),
    [
      jobTitleKeywords,
      companyKeywords,
      industry,
      teamSizes,
      salesNavLocation,
      salesNavDegrees,
    ]
  );

  function toggleSalesNavDegree(degree: SalesNavDegree) {
    setSalesNavPreset(null);
    setSalesNavDegrees((prev) => {
      if (prev.includes(degree)) {
        const next = prev.filter((d) => d !== degree);
        return next.length > 0 ? next : prev;
      }
      return [...prev, degree].sort() as SalesNavDegree[];
    });
  }

  function applySalesNavPreset(preset: "uk_base" | "warm_1st") {
    setSalesNavPreset(preset);
    setJobTitleKeywords(DEFAULT_JOB_TITLE_KEYWORDS);
    setCompanyKeywords(DEFAULT_COMPANY_KEYWORDS);
    setTeamSizes(DEFAULT_TEAM_SIZES);
    setIndustry("");
    if (preset === "uk_base") {
      setSalesNavLocation("United Kingdom");
      setSalesNavDegrees(["2", "3"]);
    } else {
      setSalesNavLocation("");
      setSalesNavDegrees(["1"]);
    }
  }

  async function copySalesNavUrl() {
    try {
      await navigator.clipboard.writeText(salesNavUrl);
      setCopiedSalesNav(true);
      window.setTimeout(() => setCopiedSalesNav(false), 2000);
    } catch {
      setError("Could not copy link.");
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (sourceTab === "sales_nav") return;
    await runSearch(buildPayload(), 1, "search");
  }

  async function goToPage(page: number) {
    if (!lastPayload || !result) return;
    if (page < 1 || page > result.totalPages || page === result.page) return;
    await runSearch(lastPayload, page, "page");
  }

  async function handlePageSizeChange(nextSize: number) {
    if (nextSize === pageSize) return;
    setPageSize(nextSize);
    pageSizeRef.current = nextSize;
    const payload = lastPayload ?? buildPayload();
    await runSearch(payload, 1, hasSearched ? "page" : "search", nextSize);
  }

  async function handleReveal(id: string) {
    setRevealingId(id);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setRevealingId(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/lead-finder/reveal", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: [id] }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        leads?: LeadReveal[];
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Reveal failed.");
        return;
      }
      const lead = body.leads?.[0];
      if (lead) {
        setRevealed((prev) => ({ ...prev, [lead.id]: lead }));
      }
    } catch {
      setError("Reveal failed.");
    } finally {
      setRevealingId(null);
    }
  }

  const revealMany = useCallback(
    async (ids: string[]) => {
      const missing = ids.filter(Boolean);
      if (missing.length === 0) return;
      const headers = await authHeaders();
      if (!headers) return;
      try {
        const res = await fetch("/api/admin/lead-finder/reveal", {
          method: "POST",
          headers,
          body: JSON.stringify({ ids: missing }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          leads?: LeadReveal[];
        };
        if (!res.ok || !body.leads) return;
        setRevealed((prev) => {
          const next = { ...prev };
          for (const lead of body.leads!) next[lead.id] = lead;
          return next;
        });
      } catch {
        // Admin auto-reveal is best-effort.
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    if (coachView || !result?.leads.length) return;
    const missing = result.leads
      .map((l) => l.id)
      .filter((id) => !revealed[id]);
    if (missing.length === 0) return;
    void revealMany(missing);
    // Only when results or coachView change — not every revealed update.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [coachView, result, revealMany]);

  if (allowed === null) {
    return (
      <div className="px-4 py-10 text-sm text-slate-500 sm:px-6">Loading…</div>
    );
  }

  if (!allowed) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <p className="text-sm text-slate-600">
          Lead Finder is not enabled for this account.
        </p>
      </div>
    );
  }

  const rangeStart = result
    ? (result.page - 1) * result.pageSize + 1
    : 0;
  const rangeEnd = result
    ? (result.page - 1) * result.pageSize + result.leads.length
    : 0;

  const omitLocationCountry = country === "GB" || country === "US";
  const locationColumnLabel =
    country === "GB"
      ? "Location 🇬🇧"
      : country === "US"
        ? "Location 🇺🇸"
        : "Location";

  function displayLocation(lead: LeadTeaser): string {
    return formatLeadLocation(lead.location, lead.state, {
      omitCountry: omitLocationCountry,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <StickyPageHeader title="Lead Finder" tabs={<ToolkitHubTabs />} />

      <div className="border-b border-slate-200 px-5 pt-3 sm:px-6">
        <PageHeaderUnderlineTabs
          ariaLabel="Lead source"
          items={[
            {
              kind: "button",
              id: "database",
              label: "Database",
              active: sourceTab === "database",
              onClick: () => {
                setSourceTab("database");
                setError(null);
              },
            },
            {
              kind: "button",
              id: "sales_nav",
              label: "Sales Navigator",
              active: sourceTab === "sales_nav",
              onClick: () => {
                setSourceTab("sales_nav");
                setError(null);
              },
            },
          ]}
        />
      </div>

      <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col lg:flex-row">
        {/* Filters */}
        <aside className="w-full shrink-0 border-b border-slate-200 lg:w-[17.5rem] lg:border-b-0 lg:border-r lg:border-slate-200">
          <form
            onSubmit={(e) => void handleSearch(e)}
            className="sticky top-0 space-y-6 p-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
          >
            <KeywordChipField
              label="Company"
              placeholder="Type, then Enter"
              values={companyKeywords}
              onChange={(next) => {
                setSalesNavPreset(null);
                setCompanyKeywords(next);
              }}
            />

            <KeywordChipField
              label="Job title"
              placeholder="Owner, MD, or type your own"
              values={jobTitleKeywords}
              onChange={(next) => {
                setSalesNavPreset(null);
                setJobTitleKeywords(next);
              }}
              suggestions={LEADROCKS_JOB_TITLE_PRESETS}
            />

            {sourceTab === "database" ? (
              <>
                <PlusChipFilter
                  label="Country"
                  single
                  options={COUNTRY_OPTIONS}
                  values={[country]}
                  onChange={(next) => {
                    const picked = (next[0] as CountryCode | undefined) ?? "OTHER";
                    setCountry(picked);
                  }}
                />

                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    {country === "GB" ? "City / county" : "City"}
                  </span>
                  <input
                    className={fieldClass}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      country === "GB" ? "Manchester, London…" : "City or region"
                    }
                  />
                </label>

                {country === "US" ? (
                  <PlusChipFilter
                    label="US states"
                    searchable
                    options={LEADROCKS_US_STATES.map((s) => ({
                      value: s.code,
                      label: `${s.code} · ${s.label}`,
                    }))}
                    values={states}
                    onChange={setStates}
                  />
                ) : null}
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Location
                  </span>
                  <input
                    className={fieldClass}
                    value={salesNavLocation}
                    onChange={(e) => {
                      setSalesNavPreset(null);
                      setSalesNavLocation(e.target.value);
                    }}
                    placeholder="United Kingdom, New York…"
                  />
                </label>

                <div>
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Selection
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "1" as const, label: "1st" },
                        { id: "2" as const, label: "2nd" },
                        { id: "3" as const, label: "3rd+" },
                      ] as const
                    ).map((d) => {
                      const on = salesNavDegrees.includes(d.id);
                      if (on) {
                        return (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-0.5 rounded-full border border-emerald-300 bg-emerald-100 pl-2.5 pr-1 py-0.5 text-xs font-medium text-emerald-800"
                          >
                            <span>{d.label}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${d.label}`}
                              className="shrink-0 rounded-full p-1 text-emerald-700 hover:bg-emerald-200/70 hover:text-emerald-950"
                              onClick={() => toggleSalesNavDegree(d.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      }
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleSalesNavDegree(d.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                        >
                          <Plus className="h-3 w-3" strokeWidth={2.25} />
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <PlusChipFilter
              label="Team size"
              options={LEADROCKS_TEAM_SIZES.map((t) => ({
                value: t,
                label: t,
              }))}
              values={teamSizes}
              onChange={(next) => {
                setSalesNavPreset(null);
                setTeamSizes(next);
              }}
            />

            {sourceTab === "database" ? (
              <>
                <PlusChipFilter
                  label="Revenue"
                  options={LEADROCKS_REVENUE_RANGES.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  values={revenueRanges}
                  onChange={setRevenueRanges}
                />

                <PlusChipFilter
                  label="Must have"
                  options={CONTACT_FILTER_OPTIONS}
                  values={requireContacts}
                  onChange={(next) =>
                    setRequireContacts(
                      next.filter(
                        (v): v is "email" | "phone" | "linkedin" =>
                          v === "email" || v === "phone" || v === "linkedin"
                      )
                    )
                  }
                />
              </>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Industry
              </span>
              <input
                className={fieldClass}
                value={industry}
                onChange={(e) => {
                  setSalesNavPreset(null);
                  setIndustry(e.target.value);
                }}
                placeholder="Construction, Dental…"
              />
            </label>

            {sourceTab === "database" ? (
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <a
                  href={salesNavUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Sales Navigator
                </a>
                <button
                  type="button"
                  onClick={() => void copySalesNavUrl()}
                  className="flex w-full items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {copiedSalesNav ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedSalesNav ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
          </form>
        </aside>

        {/* Results */}
        <section className="min-w-0 flex-1">
          {sourceTab === "sales_nav" ? (
            <div className="flex flex-1 flex-col px-5 py-8 sm:px-6">
              <div className="mx-auto w-full max-w-lg space-y-6">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                    Sales Navigator
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Set your filters on the left, then open the search in Sales
                    Navigator — or copy the link to paste into Connect AI.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Recommended
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applySalesNavPreset("uk_base")}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        salesNavPreset === "uk_base"
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      UK base search
                    </button>
                    <button
                      type="button"
                      onClick={() => applySalesNavPreset("warm_1st")}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        salesNavPreset === "warm_1st"
                          ? "border-sky-300 bg-sky-50 text-sky-800"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      People I already know
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={salesNavUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Sales Navigator
                  </a>
                  <button
                    type="button"
                    onClick={() => void copySalesNavUrl()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {copiedSalesNav ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedSalesNav ? "Copied" : "Copy link"}
                  </button>
                </div>

                {error ? (
                  <p className="text-sm text-rose-700" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Leads
              {hasSearched && result ? (
                <span className="ml-2 font-normal text-slate-400">
                  {result.totalMatched.toLocaleString()}
                </span>
              ) : loading ? (
                <span className="ml-2 font-normal text-slate-300">…</span>
              ) : null}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {hasSearched && result ? (
                <p className="text-xs text-slate-400">
                  {result.leads.length > 0
                    ? `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${result.totalMatched.toLocaleString()}`
                    : `${result.totalMatched.toLocaleString()} matches`}
                </p>
              ) : null}
              <div ref={columnsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setColumnsOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
                    columnsOpen
                      ? "border-slate-900 text-slate-900"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                  aria-expanded={columnsOpen}
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </button>
                {columnsOpen ? (
                  <div className="absolute right-0 z-40 mt-1 w-44 border border-slate-200 bg-white py-1 shadow-sm">
                    {COLUMN_OPTIONS.map((opt) => (
                      <label
                        key={opt.key}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={columns[opt.key]}
                          onChange={() => toggleColumn(opt.key)}
                          className="rounded border-slate-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="sr-only">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    void handlePageSizeChange(Number(e.target.value))
                  }
                  disabled={loading || pageLoading}
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 disabled:opacity-50"
                >
                  {LEAD_FINDER_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <p className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-sm text-rose-700 sm:px-6" role="alert">
              {error}
            </p>
          ) : null}

          <div className="px-0 sm:px-0">
            {!hasSearched && !loading ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-slate-500">
                  Set filters and search to see matching leads.
                </p>
              </div>
            ) : null}

            {loading || pageLoading ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm">
                  {pageLoading ? "Loading…" : "Searching…"}
                </p>
              </div>
            ) : null}

            {!loading && !pageLoading && result && result.leads.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                No leads matched.
              </div>
            ) : null}

            {!loading && !pageLoading && result && result.leads.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                        <th className="px-5 py-3 font-medium sm:px-6">Name</th>
                        {columns.company ? (
                          <th className="px-3 py-3 font-medium">Company</th>
                        ) : null}
                        {columns.location ? (
                          <th className="px-3 py-3 font-medium">
                            {locationColumnLabel}
                          </th>
                        ) : null}
                        {columns.industry ? (
                          <th className="px-3 py-3 font-medium">Industry</th>
                        ) : null}
                        {columns.size ? (
                          <th className="whitespace-nowrap px-3 py-3 font-medium">
                            Size
                          </th>
                        ) : null}
                        {columns.revenue ? (
                          <th className="px-3 py-3 font-medium">Revenue</th>
                        ) : null}
                        {columns.contact ? (
                          <th className="px-5 py-3 font-medium sm:px-6">
                            Contact
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {result.leads.map((lead) => {
                        const full = revealed[lead.id];
                        return (
                          <tr
                            key={lead.id}
                            className="border-b border-slate-100 align-top transition hover:bg-slate-50/80"
                          >
                            <td className="px-5 py-3.5 sm:px-6">
                              <p className="font-medium text-slate-900">
                                {lead.fullName ?? "Unknown"}
                              </p>
                              {lead.jobTitle ? (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {lead.jobTitle}
                                </p>
                              ) : null}
                            </td>
                            {columns.company ? (
                              <td className="px-3 py-3.5">
                                <CompanyCell lead={lead} />
                              </td>
                            ) : null}
                            {columns.location ? (
                              <td className="px-3 py-3.5 text-slate-500">
                                {displayLocation(lead)}
                              </td>
                            ) : null}
                            {columns.industry ? (
                              <td className="px-3 py-3.5 text-slate-500">
                                {lead.industry ?? "—"}
                              </td>
                            ) : null}
                            {columns.size ? (
                              <td className="whitespace-nowrap px-3 py-3.5 text-slate-500">
                                {lead.teamSize ?? "—"}
                              </td>
                            ) : null}
                            {columns.revenue ? (
                              <td className="px-3 py-3.5 text-slate-500">
                                {lead.revenueRange ?? "—"}
                              </td>
                            ) : null}
                            {columns.contact ? (
                              <td className="px-5 py-3.5 sm:px-6">
                                <ContactAvailability
                                  lead={lead}
                                  full={full}
                                  coachView={coachView}
                                  revealing={revealingId === lead.id}
                                  onReveal={() => void handleReveal(lead.id)}
                                  onHide={() =>
                                    setRevealed((prev) => {
                                      const next = { ...prev };
                                      delete next[lead.id];
                                      return next;
                                    })
                                  }
                                />
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {result.leads.map((lead) => {
                    const full = revealed[lead.id];
                    return (
                      <li key={lead.id} className="px-5 py-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {lead.fullName ?? "Unknown"}
                          </p>
                          {lead.jobTitle ? (
                            <p className="mt-0.5 text-sm text-slate-600">
                              {lead.jobTitle}
                            </p>
                          ) : null}
                          {columns.company ? (
                            <div className="mt-0.5 text-sm">
                              <CompanyCell lead={lead} />
                            </div>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-400">
                            {[
                              columns.location ? displayLocation(lead) : null,
                              columns.industry ? lead.industry : null,
                              columns.size ? lead.teamSize : null,
                              columns.revenue ? lead.revenueRange : null,
                            ]
                              .filter((v) => v && v !== "—")
                              .join(" · ")}
                          </p>
                          {columns.contact ? (
                            <div className="mt-3">
                              <ContactAvailability
                                lead={lead}
                                full={full}
                                coachView={coachView}
                                revealing={revealingId === lead.id}
                                onReveal={() => void handleReveal(lead.id)}
                                onHide={() =>
                                  setRevealed((prev) => {
                                    const next = { ...prev };
                                    delete next[lead.id];
                                    return next;
                                  })
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {result.totalPages > 1 || result.totalMatched > pageSize ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
                    <p className="text-xs text-slate-400">
                      {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}{" "}
                      of {result.totalMatched.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={result.page <= 1 || pageLoading}
                        onClick={() => void goToPage(result.page - 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </button>
                      <span className="px-2 text-xs text-slate-400">
                        {result.page} / {Math.max(result.totalPages, 1)}
                      </span>
                      <button
                        type="button"
                        disabled={
                          result.page >= result.totalPages || pageLoading
                        }
                        onClick={() => void goToPage(result.page + 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
            </>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={toggleCoachView}
        title={
          coachView
            ? "Admin view — contacts shown open"
            : "Coach view — see availability + reveal"
        }
        aria-label={
          coachView
            ? "Switch to admin view (contacts open)"
            : "Switch to coach view (masked contacts)"
        }
        aria-pressed={coachView}
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition ${
          coachView
            ? "border-sky-300/90 bg-sky-50/95 text-sky-800 hover:bg-sky-100"
            : "border-slate-200/80 bg-white/90 text-slate-500 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        {coachView ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden />
        )}
        {coachView ? "Coach view" : "Admin view"}
      </button>
    </div>
  );
}
