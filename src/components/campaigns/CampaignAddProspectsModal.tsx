"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Check, Search, X } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PROSPECT_STATUS_OPTIONS } from "@/lib/prospectStatus";
import type { ProspectRow } from "@/lib/prospectRow";
import { resolveProspectSourceLabel } from "@/lib/prospectSourceKind";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";

import {
  audienceItemSourceLabel,
  displayListPersonName,
  splitPersonName,
  type AudienceListSummary,
} from "@/lib/leadLists/audienceListShared";
import type { CampaignAddProspectsMode } from "@/lib/campaigns/addProspectsMode";
import type { ParsedProspectCsvRow } from "@/lib/prospects/parseProspectsCsv";
import { CsvUploadDropzone } from "@/components/prospects/CsvUploadDropzone";
import { PoolFilterMenu } from "@/components/campaigns/PoolFilterMenu";
import { isMagnetPlaybookId } from "@/lib/leadMagnets/catalog";
import {
  poolRowMatchesCityFilter,
  poolRowMatchesContactFilter,
  poolRowMatchesDateAddedFilter,
  poolRowMatchesHeadcountFilter,
  poolRowMatchesIndustryFilter,
  poolRowMatchesLinkedInFilter,
  poolRowMatchesPostcodeFilter,
  poolRowMatchesTagFilter,
  poolRowPassesExcludedTags,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolLinkedInFilter,
  type PoolPerson,
} from "@/lib/pool/poolPeople";
import {
  DEFAULT_PROSPECT_TAGS,
  mergeProspectTagCatalog,
  sortProspectTagCatalog,
} from "@/lib/prospects/tagAppearance";

export type { CampaignAddProspectsMode };

type AudienceMode = CampaignAddProspectsMode;

type SearchHit = {
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  linkedin_provider_id?: string | null;
};

type Props = {
  open: boolean;
  campaignId: string;
  /** Primary campaign channel — gates which prospects are eligible. */
  campaignChannel?: string;
  initialMode?: CampaignAddProspectsMode;
  /** Pool and prospects only — the other ways live on the shared import screen. */
  poolOnly?: boolean;
  onBack?: () => void;
  existingContactIds: string[];
  existingLinkedInUrls: string[];
  onClose: () => void;
  onAdded: () => void | Promise<void>;
};

const TAB_ITEMS: Array<{ id: AudienceMode; label: string }> = [
  { id: "named", label: "Pool" },
  { id: "list", label: "Prospects" },
  { id: "search", label: "Search" },
  { id: "urls", label: "Paste URLs" },
  { id: "csv", label: "Upload CSV" },
];

type ListMenu = "filter" | "sort" | null;
type ListSortField = "name" | "business" | "status" | "created_at";
type ListSortOrder = "asc" | "desc";

const fieldClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500";

const ADD_COUNT_PRESETS = [100, 250, 500, 1000] as const;
const MAX_CAMPAIGN_ADD = 2500;

type AddCountPreset = (typeof ADD_COUNT_PRESETS)[number] | "custom";

function resolveAddCount(preset: AddCountPreset, customValue: string): number {
  if (preset !== "custom") return preset;
  const parsed = Math.floor(Number(customValue));
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.min(MAX_CAMPAIGN_ADD, parsed);
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function AddCountPicker({
  preset,
  customValue,
  manual,
  addingCount,
  eligibleCount,
  onPreset,
  onCustomValue,
}: {
  preset: AddCountPreset;
  customValue: string;
  manual: boolean;
  addingCount: number;
  eligibleCount: number;
  onPreset: (preset: AddCountPreset) => void;
  onCustomValue: (value: string) => void;
}) {
  const summary = manual
    ? `${addingCount.toLocaleString()} selected`
    : eligibleCount === 0
      ? "No one to add"
      : addingCount === 0
        ? "Enter a number"
        : addingCount < eligibleCount
          ? `First ${addingCount.toLocaleString()} of ${eligibleCount.toLocaleString()}`
          : `All ${eligibleCount.toLocaleString()}`;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-600">Add</span>
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-0.5">
        {ADD_COUNT_PRESETS.map((value) => {
          const selected = !manual && preset === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onPreset(value)}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold ${
                selected
                  ? "bg-[#0c5290] text-white shadow-sm"
                  : "bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {value.toLocaleString()}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={!manual && preset === "custom"}
          onClick={() => onPreset("custom")}
          className={`inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-semibold ${
            !manual && preset === "custom"
              ? "bg-[#0c5290] text-white shadow-sm"
              : "bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          Custom
        </button>
      </div>
      {!manual && preset === "custom" ? (
        <input
          type="text"
          inputMode="numeric"
          value={customValue}
          onChange={(e) =>
            onCustomValue(e.target.value.replace(/[^\d]/g, "").slice(0, 4))
          }
          placeholder="How many"
          aria-label="Custom number of people"
          className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        />
      ) : null}
      <span className="text-xs text-slate-500">{summary}</span>
    </div>
  );
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "").toLowerCase();
}

export function CampaignAddProspectsModal({
  open,
  campaignId,
  campaignChannel = "linkedin",
  initialMode = "named",
  poolOnly = false,
  onBack,
  existingContactIds,
  existingLinkedInUrls,
  onClose,
  onAdded,
}: Props) {
  const { impersonatingCoachId } = useImpersonation();

  async function authHeaders() {
    return getCoachAuthHeaders(impersonatingCoachId);
  }
  const [mode, setMode] = useState<AudienceMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [addProgress, setAddProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const addingLabel =
    addProgress == null
      ? "Adding…"
      : addProgress.done > 0 && addProgress.done < addProgress.total
        ? `Adding ${addProgress.done.toLocaleString()} of ${addProgress.total.toLocaleString()}…`
        : `Adding ${addProgress.total.toLocaleString()}…`;

  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const listLoadedRef = useRef(false);
  const [listQuery, setListQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [listMenu, setListMenu] = useState<ListMenu>(null);
  const [sortField, setSortField] = useState<ListSortField>("name");
  const [sortOrder, setSortOrder] = useState<ListSortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const poolFilterRef = useRef<HTMLDivElement | null>(null);

  const [addCountPreset, setAddCountPreset] = useState<AddCountPreset>(250);
  const [customAddCount, setCustomAddCount] = useState("");
  const [selectionMode, setSelectionMode] = useState<"count" | "manual">("count");

  const [searchUrl, setSearchUrl] = useState("");
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedProspectCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [namedLists, setNamedLists] = useState<AudienceListSummary[]>([]);
  const [poolListId, setPoolListId] = useState<string>("");
  const [namedListId, setNamedListId] = useState<string>("");
  const [namedItems, setNamedItems] = useState<PoolPerson[]>([]);
  const [namedLoading, setNamedLoading] = useState(false);
  const [namedItemIds, setNamedItemIds] = useState<string[]>([]);
  const [namedQuery, setNamedQuery] = useState("");
  const namedListsLoadedRef = useRef(false);
  const poolCampaignsLoadedRef = useRef(false);
  const [poolCampaigns, setPoolCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [poolMenuOpen, setPoolMenuOpen] = useState(false);
  const [poolSourceFilter, setPoolSourceFilter] = useState("all");
  const [poolCampaignFilter, setPoolCampaignFilter] = useState<
    "all" | "in_campaign" | "not_in_campaign"
  >("all");
  const [poolCampaignIdFilter, setPoolCampaignIdFilter] = useState("");
  const [poolHeadcountFilter, setPoolHeadcountFilter] = useState<string[]>([]);
  const [poolCityFilter, setPoolCityFilter] = useState("");
  const [poolPostcodeFilter, setPoolPostcodeFilter] = useState("");
  const [poolIndustryFilter, setPoolIndustryFilter] = useState("");
  const [poolContactFilter, setPoolContactFilter] =
    useState<PoolContactFilter>("all");
  const [poolLinkedinFilter, setPoolLinkedinFilter] =
    useState<PoolLinkedInFilter>("all");
  const [poolDateAddedFilter, setPoolDateAddedFilter] =
    useState<PoolDateAddedFilter>("all");
  const [poolTagFilter, setPoolTagFilter] = useState("all");
  const [poolExcludeTags, setPoolExcludeTags] = useState<string[]>([]);

  const visibleNamedItems = useMemo(() => {
    const term = namedQuery.trim().toLowerCase();
    return namedItems.filter((row) => {
      if (poolSourceFilter !== "all" && row.source !== poolSourceFilter) {
        return false;
      }
      if (poolCampaignIdFilter) {
        if (!(row.campaign_ids ?? []).includes(poolCampaignIdFilter)) return false;
      } else if (poolCampaignFilter === "in_campaign" && !row.in_campaign) {
        return false;
      } else if (poolCampaignFilter === "not_in_campaign" && row.in_campaign) {
        return false;
      }
      if (!poolRowMatchesContactFilter(row, poolContactFilter)) return false;
      if (!poolRowMatchesLinkedInFilter(row, poolLinkedinFilter)) return false;
      if (!poolRowMatchesDateAddedFilter(row, poolDateAddedFilter)) return false;
      if (!poolRowMatchesHeadcountFilter(row, poolHeadcountFilter)) return false;
      if (!poolRowMatchesCityFilter(row, poolCityFilter)) return false;
      if (!poolRowMatchesPostcodeFilter(row, poolPostcodeFilter)) return false;
      if (!poolRowMatchesIndustryFilter(row, poolIndustryFilter)) return false;
      if (!poolRowMatchesTagFilter(row, poolTagFilter)) return false;
      if (!poolRowPassesExcludedTags(row, poolExcludeTags)) return false;
      if (!term) return true;
      const hay = [
        row.full_name,
        row.first_name,
        row.last_name,
        row.job_title,
        row.company,
        row.linkedin_url,
        row.email,
        row.phone,
        row.city,
        row.industry,
        ...(row.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [
    namedItems,
    namedQuery,
    poolCampaignFilter,
    poolCampaignIdFilter,
    poolCityFilter,
    poolContactFilter,
    poolDateAddedFilter,
    poolExcludeTags,
    poolHeadcountFilter,
    poolIndustryFilter,
    poolLinkedinFilter,
    poolPostcodeFilter,
    poolSourceFilter,
    poolTagFilter,
  ]);

  const existingContactSet = useMemo(
    () => new Set(existingContactIds),
    [existingContactIds]
  );
  const existingUrlSet = useMemo(
    () =>
      new Set(
        existingLinkedInUrls
          .map((url) => normalizeUrl(url))
          .filter((url): url is string => Boolean(url))
      ),
    [existingLinkedInUrls]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
    setMode(initialMode);
    setSelectedIds([]);
    setListQuery("");
    setStatusFilter("all");
    setSourceFilter("all");
    setSelectedTags([]);
    setExcludeTags([]);
    setListMenu(null);
    setSortField("name");
    setSortOrder("asc");
    listLoadedRef.current = false;
    setSearchHits([]);
    setSearchCursor(null);
    setImportText("");
    setCsvRows([]);
    setCsvFileName(null);
    setNamedLists([]);
    setPoolListId("");
    setNamedListId("");
    setNamedItems([]);
    setNamedItemIds([]);
    setNamedQuery("");
    namedListsLoadedRef.current = false;
    poolCampaignsLoadedRef.current = false;
    setPoolCampaigns([]);
    setPoolMenuOpen(false);
    setPoolSourceFilter("all");
    setPoolCampaignFilter("all");
    setPoolCampaignIdFilter("");
    setPoolHeadcountFilter([]);
    setPoolCityFilter("");
    setPoolPostcodeFilter("");
    setPoolIndustryFilter("");
    setPoolContactFilter("all");
    setPoolLinkedinFilter("all");
    setPoolDateAddedFilter("all");
    setPoolTagFilter("all");
    setPoolExcludeTags([]);
    setAddCountPreset(250);
    setCustomAddCount("");
    setSelectionMode("count");
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || mode !== "list" || listLoadedRef.current) return;
    let cancelled = false;
    listLoadedRef.current = true;
    async function loadProspects() {
      setListLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("Sign in required.");
        const res = await fetch("/api/coach/linkedin-outreach/prospect-pool", {
          headers,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Unable to load prospects.");
        if (!cancelled) {
          setProspects(Array.isArray(body.prospects) ? body.prospects : []);
        }
      } catch (err) {
        if (!cancelled) {
          listLoadedRef.current = false;
          setError(
            err instanceof Error ? err.message : "Unable to load prospects."
          );
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }
    void loadProspects();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "named") return;
    let cancelled = false;

    async function loadPeople(listId: string | null) {
      setNamedLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("Sign in required.");
        const qs = listId ? `?listId=${encodeURIComponent(listId)}` : "";
        const res = await fetch(`/api/coach/pool${qs}`, { headers });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Unable to load pool.");
        if (cancelled) return;
        const resolvedListId =
          typeof body.list?.id === "string"
            ? (body.list.id as string)
            : typeof body.listId === "string"
              ? (body.listId as string)
              : listId || "";
        const people = Array.isArray(body.people)
          ? (body.people as PoolPerson[])
          : [];
        if (!listId) {
          setPoolListId(resolvedListId);
          setNamedListId(resolvedListId);
        } else {
          setNamedListId(listId);
        }
        setNamedItems(people);
        setNamedItemIds([]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load pool.");
        }
      } finally {
        if (!cancelled) setNamedLoading(false);
      }
    }

    async function bootstrap() {
      if (!namedListsLoadedRef.current) {
        try {
          const headers = await authHeaders();
          if (!headers) throw new Error("Sign in required.");
          const res = await fetch("/api/coach/lead-lists", { headers });
          const body = (await res.json().catch(() => ({}))) as {
            leadLists?: AudienceListSummary[];
            error?: string;
          };
          if (!res.ok) throw new Error(body.error || "Unable to load lists.");
          if (cancelled) return;
          const lists = (body.leadLists ?? [])
            .filter((list) => list.kind === "audience" && list.from_pool_import)
            .sort((a, b) => {
              const aAt = Date.parse(a.created_at || a.updated_at || "") || 0;
              const bAt = Date.parse(b.created_at || b.updated_at || "") || 0;
              return aAt - bAt;
            })
            .slice(-12);
          setNamedLists(lists);
          namedListsLoadedRef.current = true;
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Unable to load lists."
            );
          }
        }
      }
      if (!poolCampaignsLoadedRef.current && !cancelled) {
        try {
          const headers = await authHeaders();
          if (!headers) throw new Error("Sign in required.");
          const res = await fetch("/api/coach/linkedin-outreach/campaigns", {
            headers,
          });
          const body = (await res.json().catch(() => ({}))) as {
            campaigns?: Array<{
              id?: string;
              name?: string;
              status?: string;
              source_playbook_id?: string | null;
            }>;
          };
          if (!res.ok || cancelled) return;
          const campaigns = (body.campaigns ?? [])
            .filter(
              (row) =>
                typeof row.id === "string" &&
                row.status !== "archived" &&
                !isMagnetPlaybookId(row.source_playbook_id)
            )
            .map((row) => ({
              id: row.id as string,
              name:
                typeof row.name === "string" && row.name.trim()
                  ? row.name.trim()
                  : "Untitled",
            }));
          setPoolCampaigns(campaigns);
          poolCampaignsLoadedRef.current = true;
        } catch {
          // Campaign names are optional. In / not in a campaign still works.
        }
      }
      if (cancelled) return;
      await loadPeople(null);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  async function selectPoolList(listId: string | null) {
    const selectingPool = listId == null;
    if (selectingPool) {
      if (poolListId && namedListId === poolListId) return;
    } else if (namedListId === listId) {
      return;
    }
    setNamedQuery("");
    setNamedItemIds([]);
    setSelectionMode("count");
    setNamedLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const qs = listId ? `?listId=${encodeURIComponent(listId)}` : "";
      const res = await fetch(`/api/coach/pool${qs}`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Unable to load pool.");
      const resolvedListId =
        typeof body.list?.id === "string"
          ? (body.list.id as string)
          : typeof body.listId === "string"
            ? (body.listId as string)
            : listId || poolListId;
      const people = Array.isArray(body.people)
        ? (body.people as PoolPerson[])
        : [];
      if (selectingPool) {
        setPoolListId(resolvedListId);
        setNamedListId(resolvedListId);
      } else {
        setNamedListId(listId);
      }
      setNamedItems(people);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pool.");
    } finally {
      setNamedLoading(false);
    }
  }

  useEffect(() => {
    if (!listMenu && !poolMenuOpen) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (filterMenuRef.current?.contains(target)) return;
      if (sortMenuRef.current?.contains(target)) return;
      if (poolFilterRef.current?.contains(target)) return;
      setListMenu(null);
      setPoolMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [listMenu, poolMenuOpen]);

  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of prospects) {
      for (const tag of row.tags ?? []) {
        const key = tag.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.set(key, tag);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [prospects]);

  const sourceOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of prospects) {
      const label = resolveProspectSourceLabel(row);
      const key = (row.prospect_source?.trim() || label).toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    const term = listQuery.trim().toLowerCase();
    const tagKeys = selectedTags.map((tag) => tag.toLowerCase());
    const excluded = new Set(excludeTags.map((tag) => tag.toLowerCase()));
    return prospects.filter((row) => {
      if (term) {
        const hay = [row.full_name, row.business_name, row.job_title, row.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (statusFilter !== "all" && row.status.value !== statusFilter) {
        return false;
      }
      if (sourceFilter !== "all") {
        const key = (
          row.prospect_source?.trim() || resolveProspectSourceLabel(row)
        ).toLowerCase();
        if (key !== sourceFilter) return false;
      }
      const have = new Set((row.tags ?? []).map((tag) => tag.toLowerCase()));
      if (tagKeys.length && !tagKeys.some((tag) => have.has(tag))) return false;
      if (excluded.size && [...excluded].some((tag) => have.has(tag))) {
        return false;
      }
      return true;
    });
  }, [prospects, listQuery, statusFilter, sourceFilter, selectedTags, excludeTags]);

  const sortedProspects = useMemo(() => {
    const rows = [...filteredProspects];
    const dir = sortOrder === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      if (sortField === "created_at") {
        const av = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bv = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (av - bv) * dir;
      }
      const aText =
        sortField === "business"
          ? a.business_name
          : sortField === "status"
            ? a.status.label
            : a.full_name;
      const bText =
        sortField === "business"
          ? b.business_name
          : sortField === "status"
            ? b.status.label
            : b.full_name;
      return (
        (aText || "").localeCompare(bText || "", undefined, {
          sensitivity: "base",
        }) * dir
      );
    });
    return rows;
  }, [filteredProspects, sortField, sortOrder]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (selectedTags.length ? 1 : 0) +
    (excludeTags.length ? 1 : 0);
  const hasActiveSort = sortField !== "name" || sortOrder !== "asc";

  function prospectState(
    row: ProspectRow
  ): "ok" | "in_campaign" | "no_linkedin" | "no_email" | "no_phone" {
    if (existingContactSet.has(row.id)) return "in_campaign";
    const url = normalizeUrl(row.linkedin_url ?? null);
    if (url && existingUrlSet.has(url)) return "in_campaign";
    if (campaignChannel === "email") {
      const email = row.email?.trim();
      if (!email) return "no_email";
      return "ok";
    }
    if (campaignChannel === "whatsapp") {
      const phone = row.phone?.trim();
      if (!phone) return "no_phone";
      return "ok";
    }
    if (!url) return "no_linkedin";
    return "ok";
  }

  const eligibleAllIds = useMemo(
    () =>
      filteredProspects
        .filter((row) => prospectState(row) === "ok")
        .map((row) => row.id),
    // prospectState closes over campaignChannel + enrollment sets
    [filteredProspects, existingContactSet, existingUrlSet, campaignChannel]
  );
  const orderedEligibleProspectIds = useMemo(
    () =>
      sortedProspects
        .filter((row) => prospectState(row) === "ok")
        .map((row) => row.id),
    [sortedProspects, existingContactSet, existingUrlSet, campaignChannel]
  );
  const eligibleIds = useMemo(
    () => eligibleAllIds.slice(0, MAX_CAMPAIGN_ADD),
    [eligibleAllIds]
  );

  const eligibleSet = useMemo(() => new Set(eligibleAllIds), [eligibleAllIds]);
  const allVisibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.includes(id));

  function toggleId(id: string) {
    if (!eligibleSet.has(id)) return;
    setSelectionMode("manual");
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAllVisible() {
    setSelectionMode("manual");
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !eligibleSet.has(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...eligibleIds])]);
  }

  function poolAlreadyHere(row: PoolPerson): boolean {
    if (row.contact_id && existingContactSet.has(row.contact_id)) return true;
    if (campaignId && (row.campaign_ids ?? []).includes(campaignId)) return true;
    const url = normalizeUrl(row.linkedin_url);
    return Boolean(url && existingUrlSet.has(url));
  }

  function poolCanJoin(row: PoolPerson): boolean {
    if (row.blacklisted || poolAlreadyHere(row)) return false;
    if (campaignChannel === "email") return Boolean(row.email?.trim());
    if (campaignChannel === "whatsapp") return Boolean(row.phone?.trim());
    return Boolean(normalizeUrl(row.linkedin_url));
  }

  const poolSourceOptions = useMemo(() => {
    const values = [...new Set(namedItems.map((row) => row.source).filter(Boolean))];
    return values.sort();
  }, [namedItems]);

  const poolTagOptions = useMemo(
    () =>
      sortProspectTagCatalog(
        mergeProspectTagCatalog(
          DEFAULT_PROSPECT_TAGS,
          ...namedItems.map((row) => row.tags ?? [])
        ),
        []
      ),
    [namedItems]
  );

  const poolFilterCount =
    (poolSourceFilter !== "all" ? 1 : 0) +
    (poolCampaignIdFilter || poolCampaignFilter !== "all" ? 1 : 0) +
    (poolContactFilter !== "all" ? 1 : 0) +
    (poolLinkedinFilter !== "all" ? 1 : 0) +
    (poolDateAddedFilter !== "all" ? 1 : 0) +
    (poolHeadcountFilter.length > 0 ? 1 : 0) +
    (poolCityFilter.trim() ? 1 : 0) +
    (poolPostcodeFilter.trim() ? 1 : 0) +
    (poolIndustryFilter.trim() ? 1 : 0) +
    (poolTagFilter !== "all" ? 1 : 0) +
    (poolExcludeTags.length > 0 ? 1 : 0);

  const eligibleNamedIds = useMemo(
    () => visibleNamedItems.filter((row) => poolCanJoin(row)).map((row) => row.id),
    // poolCanJoin closes over channel and enrollment sets
    [visibleNamedItems, existingContactSet, existingUrlSet, campaignChannel, campaignId]
  );

  const addCount = resolveAddCount(addCountPreset, customAddCount);

  const namedIdsToAdd = useMemo(() => {
    if (selectionMode === "count") {
      return eligibleNamedIds.slice(0, addCount);
    }
    const allowed = new Set(eligibleNamedIds);
    return namedItemIds.filter((id) => allowed.has(id)).slice(0, MAX_CAMPAIGN_ADD);
  }, [addCount, eligibleNamedIds, namedItemIds, selectionMode]);

  const prospectIdsToAdd = useMemo(() => {
    if (selectionMode === "count") {
      return orderedEligibleProspectIds.slice(0, addCount);
    }
    return selectedIds
      .filter((id) => eligibleSet.has(id))
      .slice(0, MAX_CAMPAIGN_ADD);
  }, [addCount, eligibleSet, orderedEligibleProspectIds, selectedIds, selectionMode]);

  useEffect(() => {
    if (!open || selectionMode !== "count") return;
    const ids =
      mode === "named"
        ? eligibleNamedIds.slice(0, addCount)
        : mode === "list"
          ? orderedEligibleProspectIds.slice(0, addCount)
          : null;
    if (!ids) return;
    if (mode === "named") {
      setNamedItemIds((prev) => (sameIds(prev, ids) ? prev : ids));
    } else {
      setSelectedIds((prev) => (sameIds(prev, ids) ? prev : ids));
    }
  }, [
    addCount,
    eligibleNamedIds,
    mode,
    open,
    orderedEligibleProspectIds,
    selectionMode,
  ]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
    setExcludeTags((prev) =>
      prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
    );
  }

  async function addFromContacts() {
    const ids = prospectIdsToAdd;
    if (!campaignId || !ids.length) return;
    setBusy(true);
    setAddProgress({ done: 0, total: ids.length });
    setError(null);
    setNotice(
      `Adding ${ids.length.toLocaleString()} ${ids.length === 1 ? "person" : "people"}…`
    );
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < ids.length; i += 250) {
        const chunk = ids.slice(i, i + 250);
        const res = await fetch(
          `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              action: "add_from_contacts",
              contact_ids: chunk,
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Import failed.");
        added += Number(body.added ?? 0);
        skipped += Number(body.skipped ?? 0);
        const done = Math.min(i + chunk.length, ids.length);
        setAddProgress({ done, total: ids.length });
        if (done < ids.length) {
          setNotice(
            `Adding ${done.toLocaleString()} of ${ids.length.toLocaleString()}…`
          );
        }
      }
      if (added === 0) {
        setNotice(
          skipped
            ? campaignChannel === "email"
              ? "None of those people could be added — they may already be in this campaign, or have no email."
              : "None of those people could be added — they may already be in this campaign, or have no LinkedIn profile."
            : "No prospects were added."
        );
        return;
      }
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setAddProgress(null);
      setBusy(false);
    }
  }

  async function importLeadsFromPayload(leadsPayload: Array<Record<string, unknown>>) {
    if (!campaignId || !leadsPayload.length) return;
    setBusy(true);
    setAddProgress({ done: 0, total: leadsPayload.length });
    setError(null);
    setNotice(
      `Adding ${leadsPayload.length.toLocaleString()} ${leadsPayload.length === 1 ? "person" : "people"}…`
    );
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/linkedin-outreach/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "add_leads", leads: leadsPayload }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Import failed.");
      const added = Number(body.added ?? 0);
      if (added === 0) {
        setNotice("No new people were added. They may already be in this campaign.");
        return;
      }
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setAddProgress(null);
      setBusy(false);
    }
  }

  async function addFromNamedList() {
    const ids = namedIdsToAdd.slice(0, MAX_CAMPAIGN_ADD);
    if (!campaignId || !namedListId || !ids.length) return;
    setBusy(true);
    setAddProgress({ done: 0, total: ids.length });
    setError(null);
    setNotice(
      `Adding ${ids.length.toLocaleString()} ${ids.length === 1 ? "person" : "people"}…`
    );
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      let added = 0;
      let skipped = 0;
      let blocked = 0;
      for (let i = 0; i < ids.length; i += 250) {
        const chunk = ids.slice(i, i + 250);
        const res = await fetch(
          `/api/coach/lead-lists/${encodeURIComponent(namedListId)}/add-to-campaign`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              campaign_id: campaignId,
              item_ids: chunk,
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not add list.");
        added += Number(body.added ?? 0);
        skipped += Number(body.skipped ?? 0);
        blocked += Number(body.blacklisted ?? 0);
        const done = Math.min(i + chunk.length, ids.length);
        setAddProgress({ done, total: ids.length });
        if (done < ids.length) {
          setNotice(
            `Adding ${done.toLocaleString()} of ${ids.length.toLocaleString()}…`
          );
        }
      }
      if (added === 0) {
        setNotice(
          blocked
            ? "Those people are on your blacklist."
            : skipped
              ? "They are already in this campaign."
              : "No people were added."
        );
        return;
      }
      await onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add list.");
    } finally {
      setAddProgress(null);
      setBusy(false);
    }
  }

  const csvEligibleCount = useMemo(
    () =>
      csvRows.filter((row) =>
        campaignChannel === "email"
          ? Boolean(row.email)
          : campaignChannel === "whatsapp"
            ? Boolean(row.phone)
            : Boolean(row.linkedinUrl)
      ).length,
    [csvRows, campaignChannel]
  );

  async function addFromCsv() {
    if (!csvRows.length) return;
    const leadsPayload = csvRows.map((row) => {
      const { first_name, last_name } = splitPersonName(row.fullName);
      return {
        linkedin_url: row.linkedinUrl,
        first_name,
        last_name,
        company: row.businessName,
        title: row.jobTitle,
        email: row.email,
        phone: row.phone,
      };
    });
    await importLeadsFromPayload(leadsPayload);
  }

  async function importLeads() {
    const lines = importText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const leadsPayload = lines.map((line) => {
      const parts = line.split(/,|\t/).map((p) => p.trim());
      return {
        linkedin_url: parts[0] || line,
        first_name: parts[1] || null,
        last_name: parts[2] || null,
        company: parts[3] || null,
        title: parts[4] || null,
      };
    });
    setImportText("");
    await importLeadsFromPayload(leadsPayload);
  }

  async function runLinkedInSearch(nextCursor?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/search", {
        method: "POST",
        headers,
        body: JSON.stringify(
          nextCursor
            ? { cursor: nextCursor }
            : searchUrl.trim()
              ? { url: searchUrl.trim() }
              : { keywords: searchKeywords.trim() }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Search failed.");
    const hits = Array.isArray(body.items) ? body.items : [];
      setSearchHits(hits);
      setSearchCursor(body.cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 px-4 pb-20 pt-4 md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-prospects-title"
        className={`relative flex w-full flex-col rounded-2xl bg-white shadow-xl ${
          mode === "list" || mode === "named"
            ? "max-h-[min(44rem,calc(100dvh-7.5rem))] max-w-2xl md:max-h-[min(44rem,92vh)]"
            : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="min-w-0">
            {poolOnly && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← All ways
              </button>
            ) : null}
            <h2
              id="add-prospects-title"
              className="text-sm font-semibold text-slate-900"
            >
              {poolOnly ? "Already in the system" : "Add prospects"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {poolOnly ? (
          <div className="mt-4 grid grid-cols-2 gap-2 px-5">
            {(
              [
                { id: "named" as const, label: "Pool", hint: "Imported people" },
                {
                  id: "list" as const,
                  label: "Prospects",
                  hint: "Your prospects list",
                },
              ] as const
            ).map((item) => {
              const selected = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`rounded-xl border px-3 py-2 text-left ${
                    selected
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      selected ? "text-[#0c5290]" : "text-slate-900"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
        <div className="mt-4 flex gap-4 border-b border-slate-200 px-5 text-xs font-medium">
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`pb-2 ${
                mode === item.id
                  ? "border-b-2 border-[#0c5290] text-[#0c5290]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          {error ? (
            <p className="mb-3 text-sm text-rose-600">{error}</p>
          ) : null}
          {notice ? (
            <p className="mb-3 text-sm text-slate-600">{notice}</p>
          ) : null}

          {mode === "named" ? (
            <>
              {namedLists.length > 0 ? (
                <div className="-mx-5 mb-3 flex gap-1 overflow-x-auto border-b border-slate-200 px-5">
                  <button
                    type="button"
                    onClick={() => void selectPoolList(null)}
                    className={`shrink-0 rounded-tl-md rounded-tr-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      !namedListId ||
                      (poolListId && namedListId === poolListId)
                        ? "border-b-[3px] border-sky-600 bg-sky-100/90 text-sky-800"
                        : "border-b-[3px] border-transparent bg-slate-200/90 text-slate-600 hover:bg-slate-300/70 hover:text-slate-800"
                    }`}
                  >
                    Pool
                  </button>
                  {namedLists.map((list) => {
                    const selected = namedListId === list.id;
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => void selectPoolList(list.id)}
                        className={`inline-flex max-w-[12rem] shrink-0 items-center gap-1.5 rounded-tl-md rounded-tr-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "border-b-[3px] border-sky-600 bg-sky-100/90 text-sky-800"
                            : "border-b-[3px] border-transparent bg-slate-200/90 text-slate-600 hover:bg-slate-300/70 hover:text-slate-800"
                        }`}
                      >
                        <span className="min-w-0 truncate">{list.name}</span>
                        {list.item_count > 0 ? (
                          <span className="shrink-0 text-xs font-normal text-slate-500">
                            {list.item_count.toLocaleString()}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!poolListId &&
              !namedLoading &&
              namedLists.length === 0 &&
              namedItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  Your pool is empty. Go back and pull people in the same way
                  you add them to the pool.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <label className="relative min-w-0 flex-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={namedQuery}
                        onChange={(e) => setNamedQuery(e.target.value)}
                        placeholder={
                          poolListId && namedListId === poolListId
                            ? "Search the pool…"
                            : "Search this list…"
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                      />
                    </label>
                    <div ref={poolFilterRef} className="relative shrink-0">
                      <TableToolbarButton
                        label="Filter"
                        aria-haspopup="true"
                        aria-expanded={poolMenuOpen}
                        active={poolMenuOpen}
                        badge={poolFilterCount > 0 ? poolFilterCount : null}
                        onClick={() => setPoolMenuOpen((open) => !open)}
                        icon={
                          <FilterSlidersIcon className="h-5 w-5 text-slate-500" />
                        }
                      />
                      {poolMenuOpen ? (
                        <PoolFilterMenu
                          align="end"
                          sourceFilter={poolSourceFilter}
                          sourceOptions={poolSourceOptions}
                          onSourceFilter={setPoolSourceFilter}
                          campaignFilter={poolCampaignFilter}
                          campaignIdFilter={poolCampaignIdFilter}
                          campaigns={poolCampaigns}
                          onCampaignFilter={(value) => {
                            setPoolCampaignIdFilter("");
                            setPoolCampaignFilter(value);
                          }}
                          onCampaignIdFilter={(value) => {
                            setPoolCampaignIdFilter(value);
                            if (value) setPoolCampaignFilter("all");
                          }}
                          headcountFilter={poolHeadcountFilter}
                          onHeadcountFilter={setPoolHeadcountFilter}
                          cityFilter={poolCityFilter}
                          onCityFilter={setPoolCityFilter}
                          postcodeFilter={poolPostcodeFilter}
                          onPostcodeFilter={setPoolPostcodeFilter}
                          industryFilter={poolIndustryFilter}
                          onIndustryFilter={setPoolIndustryFilter}
                          contactFilter={poolContactFilter}
                          onContactFilter={setPoolContactFilter}
                          linkedinFilter={poolLinkedinFilter}
                          onLinkedinFilter={setPoolLinkedinFilter}
                          dateAddedFilter={poolDateAddedFilter}
                          onDateAddedFilter={setPoolDateAddedFilter}
                          tagFilter={poolTagFilter}
                          tagOptions={poolTagOptions}
                          onTagFilter={setPoolTagFilter}
                          excludeTags={poolExcludeTags}
                          onExcludeTags={setPoolExcludeTags}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className={cardClass("plain", "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden")}>
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const cap = eligibleNamedIds.slice(0, MAX_CAMPAIGN_ADD);
                          return (
                            cap.length > 0 &&
                            cap.every((id) => namedItemIds.includes(id))
                          );
                        })()}
                        disabled={!eligibleNamedIds.length}
                        onChange={() => {
                          const cap = eligibleNamedIds.slice(0, MAX_CAMPAIGN_ADD);
                          const all =
                            cap.length > 0 &&
                            cap.every((id) => namedItemIds.includes(id));
                          setSelectionMode("manual");
                          setNamedItemIds(all ? [] : cap);
                        }}
                        aria-label="Select everyone who can be added"
                        className="rounded border-slate-300 text-[#0c5290]"
                      />
                      <span className="text-xs font-medium text-slate-600">
                        {namedIdsToAdd.length
                          ? `${namedIdsToAdd.length.toLocaleString()} selected`
                          : `${visibleNamedItems.length.toLocaleString()} people`}
                        {eligibleNamedIds.length > MAX_CAMPAIGN_ADD
                          ? ` · first ${MAX_CAMPAIGN_ADD.toLocaleString()}`
                          : ""}
                      </span>
                    </div>
                    <ul className="max-h-[min(18rem,36vh)] overflow-y-auto">
                      {namedLoading ? (
                        <li className="px-3 py-10 text-center text-sm text-slate-600">
                          Loading…
                        </li>
                      ) : visibleNamedItems.length === 0 ? (
                        <li className="px-3 py-10 text-center text-sm text-slate-600">
                          {namedItems.length === 0
                            ? "Nobody in this list yet."
                            : "No one matches these filters."}
                        </li>
                      ) : (
                        visibleNamedItems.map((row) => {
                          const name = displayListPersonName(row);
                          const inCampaign = poolAlreadyHere(row);
                          const canJoin = poolCanJoin(row);
                          return (
                            <li key={row.id}>
                              <label
                                className={`flex items-center gap-3 px-3 py-2.5 ${
                                  canJoin
                                    ? "cursor-pointer hover:bg-slate-50"
                                    : "cursor-default opacity-60"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={namedItemIds.includes(row.id)}
                                  disabled={busy || !canJoin}
                                  onChange={() => {
                                    setSelectionMode("manual");
                                    setNamedItemIds((prev) =>
                                      prev.includes(row.id)
                                        ? prev.filter((id) => id !== row.id)
                                        : [...prev, row.id]
                                    );
                                  }}
                                  className="rounded border-slate-300 text-[#0c5290]"
                                />
                                <ProspectTableAvatar name={name} />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-slate-900">
                                    {name}
                                  </div>
                                  <div className="truncate text-xs text-slate-600">
                                    {[row.job_title, row.company]
                                      .filter(Boolean)
                                      .join(" · ") || "—"}
                                  </div>
                                </div>
                                <span className="text-caption font-medium text-slate-600">
                                  {inCampaign
                                    ? "Already added"
                                    : row.blacklisted
                                      ? "Blacklisted"
                                      : !canJoin
                                        ? campaignChannel === "email"
                                          ? "No email"
                                          : campaignChannel === "whatsapp"
                                            ? "No phone"
                                            : "No LinkedIn"
                                        : audienceItemSourceLabel(row.source)}
                                </span>
                              </label>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                </>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <AddCountPicker
                  preset={addCountPreset}
                  customValue={customAddCount}
                  manual={selectionMode === "manual"}
                  addingCount={namedIdsToAdd.length}
                  eligibleCount={eligibleNamedIds.length}
                  onPreset={(value) => {
                    setAddCountPreset(value);
                    setSelectionMode("count");
                  }}
                  onCustomValue={(value) => {
                    setCustomAddCount(value);
                    setSelectionMode("count");
                  }}
                />
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={buttonClass("quiet", "small")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !namedListId || namedIdsToAdd.length === 0}
                  onClick={() => void addFromNamedList()}
                  className={buttonClass("main", "small")}
                >
                  {busy ? (
                    addingLabel
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Add {namedIdsToAdd.length.toLocaleString()} to campaign
                    </>
                  )}
                </button>
                </div>
              </div>
            </>
          ) : mode === "list" ? (
            <>
              <div className="flex items-center gap-1.5">
                <label className="relative w-56 shrink-0">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    placeholder="Search prospects…"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  />
                </label>
                <div className="flex shrink-0 items-center">
                  <div ref={filterMenuRef} className="relative">
                    <TableToolbarButton
                      label="Filter"
                      aria-haspopup="true"
                      aria-expanded={listMenu === "filter"}
                      active={listMenu === "filter"}
                      badge={activeFilterCount > 0 ? activeFilterCount : null}
                      onClick={() =>
                        setListMenu((menu) =>
                          menu === "filter" ? null : "filter"
                        )
                      }
                      icon={
                        <FilterSlidersIcon className="h-5 w-5 text-slate-500" />
                      }
                    />
                    {listMenu === "filter" ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-[90] mt-1 w-[min(92vw,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                      >
                        <div className="space-y-3">
                          <div>
                            <label
                              htmlFor="campaign-add-status-filter"
                              className="mb-1 block text-xs font-medium text-slate-600"
                            >
                              Status
                            </label>
                            <select
                              id="campaign-add-status-filter"
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className={fieldClass}
                            >
                              <option value="all">All</option>
                              {PROSPECT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-slate-600">
                              Tags
                            </p>
                            {tagOptions.length ? (
                              <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
                                {tagOptions.map((tag) => {
                                  const on = selectedTags.includes(tag);
                                  return (
                                    <label
                                      key={tag}
                                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => toggleTag(tag)}
                                        className="rounded border-slate-300 text-[#0c5290]"
                                      />
                                      <span className="truncate">{tag}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No tags on your prospects yet.
                              </p>
                            )}
                          </div>
                          {tagOptions.length ? (
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-600">
                                Exclude tags
                              </p>
                              <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
                                {tagOptions.map((tag) => {
                                  const on = excludeTags.some(
                                    (item) =>
                                      item.toLowerCase() === tag.toLowerCase()
                                  );
                                  return (
                                    <label
                                      key={tag}
                                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => {
                                          setExcludeTags((prev) =>
                                            on
                                              ? prev.filter(
                                                  (item) =>
                                                    item.toLowerCase() !==
                                                    tag.toLowerCase()
                                                )
                                              : [...prev, tag]
                                          );
                                          if (!on) {
                                            setSelectedTags((prev) =>
                                              prev.filter(
                                                (item) =>
                                                  item.toLowerCase() !==
                                                  tag.toLowerCase()
                                              )
                                            );
                                          }
                                        }}
                                        className="rounded border-slate-300 text-rose-600"
                                      />
                                      <span
                                        className={`truncate ${
                                          on ? "text-rose-700" : ""
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {sourceOptions.length > 1 ? (
                            <div>
                              <label
                                htmlFor="campaign-add-source-filter"
                                className="mb-1 block text-xs font-medium text-slate-600"
                              >
                                Source
                              </label>
                              <select
                                id="campaign-add-source-filter"
                                value={sourceFilter}
                                onChange={(e) =>
                                  setSourceFilter(e.target.value)
                                }
                                className={fieldClass}
                              >
                                <option value="all">All</option>
                                {sourceOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                          {activeFilterCount ? (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusFilter("all");
                                setSourceFilter("all");
                                setSelectedTags([]);
                                setExcludeTags([]);
                              }}
                              className="text-xs font-medium text-slate-500 hover:text-slate-800"
                            >
                              Clear filters
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div ref={sortMenuRef} className="relative">
                    <TableToolbarButton
                      label="Sort"
                      aria-haspopup="true"
                      aria-expanded={listMenu === "sort"}
                      active={listMenu === "sort"}
                      badge={hasActiveSort ? 1 : null}
                      title={hasActiveSort ? "Sort (active)" : "Sort"}
                      onClick={() =>
                        setListMenu((menu) =>
                          menu === "sort" ? null : "sort"
                        )
                      }
                      icon={
                        <ArrowUpDown
                          className="h-5 w-5 text-slate-500"
                          aria-hidden
                        />
                      }
                    />
                    {listMenu === "sort" ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-[90] mt-1 w-[min(92vw,18rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                      >
                        <div className="space-y-3">
                          <div>
                            <label
                              htmlFor="campaign-add-sort-field"
                              className="mb-1 block text-xs font-medium text-slate-600"
                            >
                              Sort by
                            </label>
                            <select
                              id="campaign-add-sort-field"
                              value={sortField}
                              onChange={(e) =>
                                setSortField(e.target.value as ListSortField)
                              }
                              className={fieldClass}
                            >
                              <option value="name">Name</option>
                              <option value="business">Company</option>
                              <option value="status">Status</option>
                              <option value="created_at">Date created</option>
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor="campaign-add-sort-order"
                              className="mb-1 block text-xs font-medium text-slate-600"
                            >
                              Order
                            </label>
                            <select
                              id="campaign-add-sort-order"
                              value={sortOrder}
                              onChange={(e) =>
                                setSortOrder(e.target.value as ListSortOrder)
                              }
                              className={fieldClass}
                            >
                              {sortField === "created_at" ? (
                                <>
                                  <option value="asc">Oldest first</option>
                                  <option value="desc">Newest first</option>
                                </>
                              ) : (
                                <>
                                  <option value="asc">A → Z</option>
                                  <option value="desc">Z → A</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {campaignChannel === "email"
                  ? "Only people with an email can join this campaign."
                  : campaignChannel === "whatsapp"
                    ? "Only people with a phone number can join this campaign."
                    : "Only people with a LinkedIn profile can join this campaign."}
              </p>

              <div className={cardClass("plain", "mt-3 min-h-0 flex-1 overflow-hidden")}>
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={!eligibleIds.length}
                    onChange={toggleAllVisible}
                    aria-label="Select all matching prospects"
                    className="rounded border-slate-300 text-[#0c5290]"
                  />
                  <span className="text-xs font-medium text-slate-600">
                    {eligibleAllIds.length.toLocaleString()} of{" "}
                    {filteredProspects.length.toLocaleString()} can be added
                    {eligibleAllIds.length > MAX_CAMPAIGN_ADD
                      ? ` · first ${MAX_CAMPAIGN_ADD.toLocaleString()}`
                      : ""}
                  </span>
                </div>
                <ul className="max-h-[min(18rem,36vh)] overflow-y-auto">
                  {listLoading ? (
                    <li className="px-3 py-10 text-center text-sm text-slate-500">
                      Loading your list…
                    </li>
                  ) : filteredProspects.length === 0 ? (
                    <li className="px-3 py-10 text-center text-sm text-slate-500">
                      {prospects.length === 0
                        ? "No prospects in your list yet."
                        : "No prospects match these filters."}
                    </li>
                  ) : (
                    sortedProspects.map((row) => {
                      const state = prospectState(row);
                      const disabled = state !== "ok";
                      const checked = selectedIds.includes(row.id);
                      return (
                        <li key={row.id}>
                          <label
                            className={`flex items-center gap-3 px-3 py-2.5 ${
                              disabled
                                ? "cursor-default opacity-60"
                                : "cursor-pointer hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled || busy}
                              onChange={() => toggleId(row.id)}
                              className="rounded border-slate-300 text-[#0c5290]"
                            />
                            <ProspectTableAvatar name={row.full_name} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {row.full_name || "Unnamed"}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {[row.job_title, row.business_name]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="text-caption font-medium text-slate-500">
                                {row.status.label}
                              </span>
                              {state === "in_campaign" ? (
                                <span className="text-caption text-slate-400">
                                  Already added
                                </span>
                              ) : state === "no_linkedin" ? (
                                <span className="text-caption text-amber-700">
                                  No LinkedIn
                                </span>
                              ) : state === "no_email" ? (
                                <span className="text-caption text-amber-700">
                                  No email
                                </span>
                              ) : state === "no_phone" ? (
                                <span className="text-caption text-amber-700">
                                  No phone
                                </span>
                              ) : row.tags?.length ? (
                                <span className="max-w-[9rem] truncate text-caption text-slate-400">
                                  {row.tags.join(", ")}
                                </span>
                              ) : null}
                            </div>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <AddCountPicker
                  preset={addCountPreset}
                  customValue={customAddCount}
                  manual={selectionMode === "manual"}
                  addingCount={prospectIdsToAdd.length}
                  eligibleCount={orderedEligibleProspectIds.length}
                  onPreset={(value) => {
                    setAddCountPreset(value);
                    setSelectionMode("count");
                  }}
                  onCustomValue={(value) => {
                    setCustomAddCount(value);
                    setSelectionMode("count");
                  }}
                />
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={buttonClass("quiet", "small")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || prospectIdsToAdd.length === 0}
                  onClick={() => void addFromContacts()}
                  className={buttonClass("main", "small")}
                >
                  {busy ? (
                    addingLabel
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Add {prospectIdsToAdd.length.toLocaleString()} to campaign
                    </>
                  )}
                </button>
                </div>
              </div>
            </>
          ) : mode === "search" ? (
            <div className="space-y-3">
              <input
                value={searchUrl}
                onChange={(e) => setSearchUrl(e.target.value)}
                placeholder="Sales Nav or LinkedIn search URL"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                placeholder="Or keywords…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || (!searchUrl.trim() && !searchKeywords.trim())}
                  onClick={() => void runLinkedInSearch(null)}
                  className={buttonClass("main", "small")}
                >
                  Search
                </button>
                {searchCursor ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runLinkedInSearch(searchCursor)}
                    className={buttonClass("second", "small")}
                  >
                    Next page
                  </button>
                ) : null}
                {searchHits.length ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void importLeadsFromPayload(
                        searchHits
                          .filter((h) => h.linkedin_url)
                          .map((h) => ({
                            linkedin_url: h.linkedin_url,
                            first_name: h.first_name,
                            last_name: h.last_name,
                            company: h.company,
                            title: h.title,
                            linkedin_provider_id: h.linkedin_provider_id,
                          }))
                      )
                    }
                    className={buttonClass("second", "small")}
                  >
                    Add {searchHits.filter((h) => h.linkedin_url).length}
                  </button>
                ) : null}
              </div>
              {searchHits.length ? (
                <ul className={cardClass("plain", "max-h-48 divide-y divide-slate-100 overflow-y-auto")}>
                  {searchHits.map((h, i) => (
                    <li key={`${h.linkedin_url}-${i}`} className="px-3 py-2">
                      <div className="truncate text-sm font-medium">
                        {[h.first_name, h.last_name].filter(Boolean).join(" ") ||
                          h.linkedin_url ||
                          "Unknown"}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {[h.title, h.company].filter(Boolean).join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : mode === "csv" ? (
            <div className="space-y-3">
              <CsvUploadDropzone
                disabled={busy}
                maxRows={2500}
                requirementNote={
                  campaignChannel === "email"
                    ? "This campaign sends email, so rows without an email address will be skipped."
                    : campaignChannel === "whatsapp"
                      ? "This campaign sends WhatsApp, so rows without a phone number will be skipped."
                      : "This campaign sends on LinkedIn, so rows without a LinkedIn URL will be skipped."
                }
                onRows={(rows, fileName) => {
                  setError(null);
                  setNotice(null);
                  setCsvRows(rows);
                  setCsvFileName(fileName);
                }}
              />
              {csvRows.length ? (
                <div className={cardClass("plain", "px-3.5 py-3")}>
                  <p className="text-sm font-medium text-slate-900">
                    {csvFileName}: {csvRows.length}{" "}
                    {csvRows.length === 1 ? "person" : "people"} found
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {csvEligibleCount} can join this campaign
                    {csvEligibleCount < csvRows.length
                      ? ` · ${csvRows.length - csvEligibleCount} will be skipped (missing ${
                          campaignChannel === "email"
                            ? "an email"
                            : campaignChannel === "whatsapp"
                              ? "a phone number"
                              : "a LinkedIn URL"
                        })`
                      : ""}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={buttonClass("quiet", "small")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || csvEligibleCount === 0}
                  onClick={() => void addFromCsv()}
                  className={buttonClass("main", "small")}
                >
                  {busy ? (
                    addingLabel
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Add {csvEligibleCount || ""}
                      {csvEligibleCount ? " to campaign" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder="One LinkedIn URL per line"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={busy || !importText.trim()}
                onClick={() => void importLeads()}
                className={buttonClass("main", "small")}
              >
                Add to staging
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
