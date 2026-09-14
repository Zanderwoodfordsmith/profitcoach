"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  ListMinus,
  ListPlus,
  Loader2,
  Plus,
  Tags,
  Trash2,
  UserSearch,
} from "lucide-react";
import { ImportPoolModal } from "@/components/campaigns/ImportPoolModal";
import { GoogleMapsImportWaitPanel } from "@/components/campaigns/GoogleMapsImportWaitPanel";
import { CampaignOnOffToggle } from "@/components/campaigns/CampaignOnOffToggle";
import { googleMapsImportProgressPercent } from "@/lib/googleMaps/cost";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";
import { DataTableColumnsMenu } from "@/components/table/DataTableColumnsMenu";
import { TabOverflowMenu } from "@/components/table/TabOverflowMenu";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import {
  ProspectsPipelineToolbar,
  type ProspectsToolbarMenu,
} from "@/components/prospects/ProspectsPipelineToolbar";
import { ProspectsTableViewBar } from "@/components/prospects/ProspectsTableViewBar";
import { ProspectLeadSubtitle } from "@/components/prospects/ProspectLeadSubtitle";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { ProspectTagChip } from "@/components/prospects/ProspectTagChip";
import { ProspectTagsPopover } from "@/components/prospects/ProspectTagsPopover";
import {
  DEFAULT_PROSPECT_TAGS,
  mergeProspectTagCatalog,
  sortProspectTagCatalog,
} from "@/lib/prospects/tagAppearance";
import { normalizeProspectTag, normalizeProspectTags } from "@/lib/prospects/tags";
import { usePoolTableViews } from "@/hooks/usePoolTableViews";
import {
  moveKeyInOrder,
  partitionOrderedColumns,
} from "@/hooks/usePersistedColumnSettings";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { formatPhoneDisplay, phoneToTelHref } from "@/lib/formatPhoneDisplay";
import { formatShortDate } from "@/lib/formatShortDate";
import { normalizePoolWebsite } from "@/lib/pool/identity";
import {
  estimateGoogleMapsFindPersonCostUsd,
  GOOGLE_MAPS_FIND_PERSON_MAX,
} from "@/lib/googleMaps/cost";
import type { AudienceListSummary } from "@/lib/leadLists/audienceLists";
import {
  SALES_NAV_IMPORT_WATCH_EVENT,
  listWatchedSalesNavImports,
  unwatchSalesNavImport,
  type WatchedSalesNavImport,
} from "@/lib/salesNavigator/importJobWatch";
import {
  comparePoolPeople,
  DEFAULT_POOL_COLUMN_ORDER,
  DEFAULT_POOL_COLUMN_VISIBILITY,
  groupPoolRows,
  POOL_COLUMN_LAYOUT_VERSION,
  POOL_CONTACT_FILTER_OPTIONS,
  POOL_DATE_ADDED_FILTER_OPTIONS,
  POOL_GROUP_FIELDS,
  POOL_TABLE_COLUMN_OPTIONS,
  poolDisplayName,
  poolLeadCompany,
  poolRowFitsCampaignChannel,
  poolRowMatchesContactFilter,
  poolRowMatchesDateAddedFilter,
  poolRowMatchesTagFilter,
  poolSourceLabel,
  poolWebsiteHref,
  type PoolColumnKey,
  type PoolColumnVisibility,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolGroupField,
  type PoolGroupOrder,
  type PoolGroupSection,
  type PoolPerson,
  type PersistedPoolGrouping,
  type PoolTagFilter,
} from "@/lib/pool/poolPeople";
import {
  normalizePoolTableViewSettings,
  type PoolTableViewSettings,
} from "@/lib/pool/poolTableViews";
import { paginationItems } from "@/lib/communityPagination";
import { isMagnetPlaybookId } from "@/lib/leadMagnets/catalog";
import type { CsvExportScope } from "@/components/table/TableCsvExportButton";

type CampaignOption = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  source_playbook_id?: string | null;
};

type CampaignMenuState =
  | null
  | { kind: "bulk" }
  | { kind: "row"; id: string };

type Props = {
  campaigns: CampaignOption[];
  onToggleCampaign?: (campaign: CampaignOption) => void;
  toggleBusy?: boolean;
  linkedInConnected?: boolean;
  emailConnected?: boolean;
};

const DROPDOWN =
  "absolute left-0 z-[90] mt-1 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg";

const CAMPAIGN_PICKER_WIDTH = 288;

function poolPersonHref(contactId: string, isAdmin: boolean): string {
  const base = isAdmin
    ? `/admin/prospects/${encodeURIComponent(contactId)}`
    : `/coach/prospects/${encodeURIComponent(contactId)}`;
  return `${base}?from=pool`;
}

function PoolCampaignPickerList({
  people,
  campaigns,
  toggleBusy,
  actionBusy,
  linkedInConnected,
  emailConnected,
  onToggleCampaign,
  onPick,
}: {
  people: PoolPerson[];
  campaigns: CampaignOption[];
  toggleBusy: boolean;
  actionBusy: boolean;
  linkedInConnected: boolean;
  emailConnected: boolean;
  onToggleCampaign?: (campaign: CampaignOption) => void;
  onPick: (campaignId: string) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-slate-600">
        Create a campaign first, then add people from the pool.
      </p>
    );
  }

  return (
    <>
      {campaigns.map((campaign) => {
        const fitCount = people.filter((row) =>
          poolRowFitsCampaignChannel(row, campaign.channel)
        ).length;
        const isRunning = campaign.status === "running";
        const isEmail = campaign.channel === "email";
        const canToggle =
          campaign.status !== "completed" &&
          (isRunning || (isEmail ? emailConnected : linkedInConnected));
        return (
          <div
            key={campaign.id}
            className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-slate-50"
          >
            <CampaignOnOffToggle
              size="sm"
              on={isRunning}
              busy={toggleBusy}
              disabled={!canToggle && !isRunning}
              onChange={() => onToggleCampaign?.(campaign)}
            />
            <button
              type="button"
              disabled={fitCount === 0 || actionBusy}
              title={
                fitCount === 0
                  ? isEmail
                    ? "None of the selection have an email"
                    : "None of the selection have a LinkedIn profile"
                  : undefined
              }
              className="min-w-0 flex-1 truncate rounded-md px-1 py-1.5 text-left text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onPick(campaign.id)}
            >
              {campaign.name}
            </button>
          </div>
        );
      })}
    </>
  );
}

const POOL_PAGE_SIZE_STORAGE_KEY = "pool-table-page-size-v1";
const POOL_PAGE_SIZE_OPTIONS = [20, 50, 100, 250, 500] as const;
type PoolPageSize = (typeof POOL_PAGE_SIZE_OPTIONS)[number];
const DEFAULT_POOL_PAGE_SIZE: PoolPageSize = 50;
const TABLE_SECTION_PADDING = "px-5 sm:px-6";
const TABLE_CHECKBOX_COL_WIDTH = 28;
const TABLE_NAME_COL_WIDTH = 280;
const TABLE_CONTACT_COL_WIDTH = 184;

function getPoolColumnWidth(key: PoolColumnKey): number {
  switch (key) {
    case "title":
      return 140;
    case "company":
      return 160;
    case "email":
      return 180;
    case "phone":
      return 140;
    case "website":
      return 140;
    case "source":
      return 128;
    case "campaign":
      return 112;
    case "created_at":
      return 112;
    case "linkedin":
      return 72;
    case "address":
      return 180;
    case "tags":
      return 168;
    default:
      return 140;
  }
}

function readStoredPoolPageSize(): PoolPageSize {
  if (typeof window === "undefined") return DEFAULT_POOL_PAGE_SIZE;
  try {
    const raw = window.localStorage.getItem(POOL_PAGE_SIZE_STORAGE_KEY);
    const n = Number(raw);
    if ((POOL_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
      return n as PoolPageSize;
    }
  } catch {
    // ignore
  }
  return DEFAULT_POOL_PAGE_SIZE;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell.replace(/"/g, '""');
          return /[",\n]/.test(value) ? `"${value}"` : value;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CampaignPoolHub({
  campaigns,
  onToggleCampaign,
  toggleBusy = false,
  linkedInConnected = false,
  emailConnected = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const [people, setPeople] = useState<PoolPerson[]>([]);
  const [poolListId, setPoolListId] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<"pool" | string>("pool");
  const [importLists, setImportLists] = useState<AudienceListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState<
    "all" | "in_campaign" | "not_in_campaign"
  >("all");
  const [contactFilter, setContactFilter] = useState<PoolContactFilter>("all");
  const [dateAddedFilter, setDateAddedFilter] =
    useState<PoolDateAddedFilter>("all");
  const [tagFilter, setTagFilter] = useState<PoolTagFilter>("all");
  const [sortField, setSortField] = useState<PoolTableViewSettings["sortField"]>("name");
  const [sortOrder, setSortOrder] = useState<PoolTableViewSettings["sortOrder"]>("asc");
  const [grouping, setGrouping] = useState<PersistedPoolGrouping>({
    field: null,
    order: "asc",
    manualOrder: {},
  });
  const [columnVisibility, setColumnVisibility] = useState<PoolColumnVisibility>(
    DEFAULT_POOL_COLUMN_VISIBILITY
  );
  const [columnOrder, setColumnOrder] = useState<PoolColumnKey[]>([
    ...DEFAULT_POOL_COLUMN_ORDER,
  ]);
  const [menu, setMenu] = useState<ProspectsToolbarMenu>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [renamingImportListId, setRenamingImportListId] = useState<string | null>(
    null
  );
  const [renameImportValue, setRenameImportValue] = useState("");
  const renameImportInputRef = useRef<HTMLInputElement | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newTabListName, setNewTabListName] = useState("");
  const addListInputRef = useRef<HTMLInputElement | null>(null);
  const [watchedImports, setWatchedImports] = useState<WatchedSalesNavImport[]>(
    []
  );
  const [importLiveById, setImportLiveById] = useState<
    Record<
      string,
      {
        progressCount: number;
        targetCount: number;
        phase: "scraping" | "finalizing";
        name: string | null;
        peopleFound: number;
        kind: "sales_nav" | "google_maps";
      }
    >
  >({});
  const [savingImportListId, setSavingImportListId] = useState<string | null>(
    null
  );
  const [importClockMs, setImportClockMs] = useState(() => Date.now());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [campaignMenu, setCampaignMenu] = useState<CampaignMenuState>(null);
  const [tagsMenuOpen, setTagsMenuOpen] = useState(false);
  const [tagsRowId, setTagsRowId] = useState<string | null>(null);
  const [tagsBusy, setTagsBusy] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState<"add" | "remove" | null>(
    null
  );
  const [newListName, setNewListName] = useState("");
  const [extraTagCatalog, setExtraTagCatalog] = useState<string[]>([]);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [findPersonJobId, setFindPersonJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PoolPageSize>(DEFAULT_POOL_PAGE_SIZE);
  const [draggingColumnKey, setDraggingColumnKey] = useState<PoolColumnKey | null>(
    null
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const rowCampaignBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [rowCampaignMenuPos, setRowCampaignMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const activeViewIdRef = useRef(activeViewId);
  activeViewIdRef.current = activeViewId;
  const loadGenRef = useRef(0);
  const peopleCacheRef = useRef<Map<string, PoolPerson[]>>(new Map());

  const listId =
    activeViewId === "pool" ? poolListId : activeViewId;

  const getAuthHeaders = useCallback(async () => getCoachAuthHeaders(), []);

  const applyViewSettings = useCallback((settings: PoolTableViewSettings) => {
    const next = normalizePoolTableViewSettings(settings);
    setSourceFilter(next.sourceFilter);
    setCampaignFilter(next.campaignFilter);
    setContactFilter(next.contactFilter);
    setDateAddedFilter(next.dateAddedFilter);
    setTagFilter(next.tagFilter);
    setSortField(next.sortField);
    setSortOrder(next.sortOrder);
    setGrouping(next.grouping);
    setColumnVisibility(next.columnVisibility);
    setColumnOrder(next.columnOrder);
  }, []);

  const currentViewSettings = useMemo(
    (): PoolTableViewSettings =>
      normalizePoolTableViewSettings({
        sourceFilter,
        campaignFilter,
        contactFilter,
        dateAddedFilter,
        tagFilter,
        sortField,
        sortOrder,
        grouping,
        columnVisibility,
        columnOrder,
        columnLayoutVersion: POOL_COLUMN_LAYOUT_VERSION,
      }),
    [
      campaignFilter,
      columnOrder,
      columnVisibility,
      contactFilter,
      dateAddedFilter,
      grouping,
      sortField,
      sortOrder,
      sourceFilter,
      tagFilter,
    ]
  );

  const tableViews = usePoolTableViews({
    currentSettings: currentViewSettings,
    onApplySettings: applyViewSettings,
    getAuthHeaders,
    ready: true,
  });

  const loadImportLists = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/lead-lists", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        leadLists?: AudienceListSummary[];
      };
      if (!res.ok) return;
      const lists = (body.leadLists ?? [])
        .filter((list) => list.kind === "audience" && list.from_pool_import)
        .sort((a, b) => {
          const aAt = Date.parse(a.created_at || a.updated_at || "") || 0;
          const bAt = Date.parse(b.created_at || b.updated_at || "") || 0;
          return aAt - bAt;
        });
      setImportLists(lists.slice(-12));
    } catch {
      // keep current tabs
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (renamingImportListId) renameImportInputRef.current?.focus();
  }, [renamingImportListId]);

  useEffect(() => {
    if (addingList) addListInputRef.current?.focus();
  }, [addingList]);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const gen = ++loadGenRef.current;
    const view = activeViewIdRef.current;
    const cacheKey = view;
    const listQs =
      view !== "pool" ? `listId=${encodeURIComponent(view)}` : "";
    setError(null);

    const cached = peopleCacheRef.current.get(cacheKey);
    if (cached && cached.length > 0) {
      setPeople(cached);
      setLoading(false);
      setLoadingMore(false);
      setSelectedIds([]);
      setPage(1);
    } else {
      setLoading(true);
      setLoadingMore(false);
      if (!opts?.soft) setPeople([]);
      setSelectedIds([]);
      setPage(1);
    }

    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");

      const previewQs = [listQs, "limit=15"].filter(Boolean).join("&");
      const previewRes = await fetch(`/api/coach/pool?${previewQs}`, {
        headers,
      });
      const previewBody = (await previewRes.json().catch(() => ({}))) as {
        error?: string;
        people?: PoolPerson[];
        list?: { id: string };
        poolListId?: string;
        hasMore?: boolean;
      };
      if (gen !== loadGenRef.current) return;
      if (!previewRes.ok) {
        throw new Error(previewBody.error || "Unable to load pool.");
      }
      const previewPeople = previewBody.people ?? [];
      if (!cached?.length) {
        setPeople(previewPeople);
      }
      const poolId = previewBody.poolListId ?? previewBody.list?.id ?? null;
      if (poolId) setPoolListId(poolId);
      setLoading(false);

      if (previewBody.hasMore === false) {
        peopleCacheRef.current.set(cacheKey, previewPeople);
        setLoadingMore(false);
        return;
      }

      setLoadingMore(true);
      const fullQs = listQs ? `?${listQs}` : "";
      const fullRes = await fetch(`/api/coach/pool${fullQs}`, { headers });
      const fullBody = (await fullRes.json().catch(() => ({}))) as {
        error?: string;
        people?: PoolPerson[];
        list?: { id: string };
        poolListId?: string;
      };
      if (gen !== loadGenRef.current) return;
      if (!fullRes.ok) {
        throw new Error(fullBody.error || "Unable to load pool.");
      }
      const fullPeople = fullBody.people ?? [];
      peopleCacheRef.current.set(cacheKey, fullPeople);
      setPeople(fullPeople);
      const fullPoolId = fullBody.poolListId ?? fullBody.list?.id ?? null;
      if (fullPoolId) setPoolListId(fullPoolId);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load pool.");
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [getAuthHeaders]);

  const reloadPeople = useCallback(async () => {
    peopleCacheRef.current.clear();
    await load();
  }, [load]);

  useEffect(() => {
    void load();
    void loadImportLists();
  }, [load, loadImportLists, activeViewId]);

  // Ephemeral status toasts — don't leave a banner between tabs and the table.
  useEffect(() => {
    if (!notice) return;
    if (notice.includes("…")) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function refreshWatched() {
      setWatchedImports(listWatchedSalesNavImports());
    }
    refreshWatched();
    let previous = listWatchedSalesNavImports().map((job) => job.id);
    function onWatchChange() {
      const jobs = listWatchedSalesNavImports();
      const next = jobs.map((job) => job.id);
      const finished = previous.some((id) => !next.includes(id));
      previous = next;
      setWatchedImports(jobs);
      if (finished) {
        void reloadPeople();
        void loadImportLists();
      }
    }
    window.addEventListener(SALES_NAV_IMPORT_WATCH_EVENT, onWatchChange);
    return () =>
      window.removeEventListener(SALES_NAV_IMPORT_WATCH_EVENT, onWatchChange);
  }, [reloadPeople, loadImportLists]);

  useEffect(() => {
    const mapsWatching = watchedImports.some((j) => j.kind === "google_maps");
    if (!mapsWatching) return;
    const handle = window.setInterval(() => setImportClockMs(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [watchedImports]);

  useEffect(() => {
    if (watchedImports.length === 0) {
      setImportLiveById({});
      return;
    }
    let cancelled = false;

    async function pollImports() {
      const headers = await getAuthHeaders();
      if (!headers || cancelled) return;

      for (const job of listWatchedSalesNavImports()) {
        if (cancelled) return;
        try {
          const path =
            job.kind === "google_maps"
              ? `/api/coach/google-maps-import/${encodeURIComponent(job.id)}`
              : `/api/coach/sales-nav-import/${encodeURIComponent(job.id)}`;
          const res = await fetch(path, { headers });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            status?: string;
            progressCount?: number;
            scrapedCount?: number;
            targetCount?: number;
            phase?: "scraping" | "finalizing" | null;
            added?: number;
            peopleFound?: number;
            saveListId?: string | null;
            run?: {
              name?: string | null;
              progressCount?: number;
              targetCount?: number | null;
              phase?: "scraping" | "finalizing" | null;
            };
          };
          if (!res.ok) continue;

          const targetCount = Math.max(
            0,
            body.targetCount ??
              body.run?.targetCount ??
              job.targetCount ??
              0
          );
          const progressCount = Math.max(
            0,
            body.progressCount ??
              body.run?.progressCount ??
              body.scrapedCount ??
              0
          );
          const name = body.run?.name?.trim() || job.name;
          const peopleFound = Math.max(0, Number(body.peopleFound ?? 0));
          const kind =
            job.kind === "google_maps" ? "google_maps" : "sales_nav";

          if (body.status === "succeeded") {
            unwatchSalesNavImport(job.id);
            const added = Math.max(0, body.added ?? progressCount);
            const saveListId = body.saveListId ?? job.saveListId ?? null;
            if (saveListId) setSavingImportListId(saveListId);
            setNotice(
              kind === "google_maps"
                ? `Added ${added.toLocaleString()} ${
                    added === 1 ? "business" : "businesses"
                  } to the pool${
                    peopleFound
                      ? ` · ${peopleFound.toLocaleString()} ${
                          peopleFound === 1 ? "person" : "people"
                        } found`
                      : ""
                  }.`
                : `Added ${added.toLocaleString()} ${
                    added === 1 ? "person" : "people"
                  } to the pool.`
            );
            await loadImportLists();
            await reloadPeople();
            setSavingImportListId(null);
            continue;
          }
          if (body.status === "failed") {
            unwatchSalesNavImport(job.id);
            setError(body.error?.trim() || "Import failed.");
            continue;
          }

          setImportLiveById((prev) => ({
            ...prev,
            [job.id]: {
              progressCount,
              targetCount,
              phase:
                body.phase === "finalizing" ||
                body.run?.phase === "finalizing"
                  ? "finalizing"
                  : "scraping",
              name,
              peopleFound,
              kind,
            },
          }));
        } catch {
          // keep watching
        }
      }
    }

    void pollImports();
    const handle = window.setInterval(() => void pollImports(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [watchedImports, getAuthHeaders, reloadPeople, loadImportLists]);

  useEffect(() => {
    if (!menu && !campaignMenu && !listMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if ((e.target as Element | null)?.closest?.("[data-pool-campaign-menu]")) {
        return;
      }
      if ((e.target as Element | null)?.closest?.("[data-pool-list-menu]")) {
        return;
      }
      setMenu(null);
      setCampaignMenu(null);
      setListMenuOpen(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [campaignMenu, listMenuOpen, menu]);

  const sourceOptions = useMemo(() => {
    const values = [...new Set(people.map((row) => row.source).filter(Boolean))];
    return values.sort();
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.filter((row) => {
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (campaignFilter === "in_campaign" && !row.in_campaign) return false;
      if (campaignFilter === "not_in_campaign" && row.in_campaign) return false;
      if (!poolRowMatchesContactFilter(row, contactFilter)) return false;
      if (!poolRowMatchesDateAddedFilter(row, dateAddedFilter)) return false;
      if (!poolRowMatchesTagFilter(row, tagFilter)) return false;
      if (!q) return true;
      const hay = [
        row.full_name,
        row.company,
        row.job_title,
        row.email,
        row.phone,
        row.website,
        row.address,
        ...(row.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return rows
      .slice()
      .sort((a, b) => comparePoolPeople(a, b, sortField, sortOrder));
  }, [
    campaignFilter,
    contactFilter,
    dateAddedFilter,
    people,
    query,
    sortField,
    sortOrder,
    sourceFilter,
    tagFilter,
  ]);

  const groupField: PoolGroupField | null = grouping.field;
  const groupSections = useMemo(() => {
    if (!groupField) return null;
    return groupPoolRows(
      filtered,
      groupField,
      grouping.order,
      grouping.manualOrder[groupField] ?? []
    );
  }, [filtered, groupField, grouping.manualOrder, grouping.order]);

  const displayPeople = useMemo(
    () =>
      groupSections
        ? groupSections.flatMap((section) => section.people)
        : filtered,
    [filtered, groupSections]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(displayPeople.length / pageSize)
  );

  const pagedPeople = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayPeople.slice(start, start + pageSize);
  }, [displayPeople, page, pageSize]);

  const groupHeaderByFirstRowId = useMemo(() => {
    const map = new Map<string, PoolGroupSection>();
    if (!groupSections?.length) return map;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    let seen = 0;
    for (const section of groupSections) {
      const sectionStart = seen;
      const sectionEnd = seen + section.people.length;
      seen = sectionEnd;
      if (sectionEnd <= start || sectionStart >= end) continue;
      const firstIndex = Math.max(0, start - sectionStart);
      const first = section.people[firstIndex];
      if (first) map.set(first.id, section);
    }
    return map;
  }, [groupSections, page, pageSize]);

  const pageNumbers = useMemo(
    () => paginationItems(page, totalPages),
    [page, totalPages]
  );

  const paginationRangeLabel =
    displayPeople.length === 0
      ? "0 people"
      : `${(page - 1) * pageSize + 1}-${Math.min(
          page * pageSize,
          displayPeople.length
        )} of ${displayPeople.length}`;

  const pageIds = useMemo(
    () => pagedPeople.map((row) => row.id),
    [pagedPeople]
  );

  const { shown: shownColumnOptions, hidden: hiddenColumnOptions } = useMemo(
    () =>
      partitionOrderedColumns(
        columnOrder,
        columnVisibility,
        POOL_TABLE_COLUMN_OPTIONS
      ),
    [columnOrder, columnVisibility]
  );

  const tableMinWidth =
    TABLE_CHECKBOX_COL_WIDTH +
    TABLE_NAME_COL_WIDTH +
    TABLE_CONTACT_COL_WIDTH +
    shownColumnOptions.reduce((sum, column) => sum + getPoolColumnWidth(column.key), 0);

  const setColumnVisible = useCallback(
    (key: PoolColumnKey, visible: boolean) => {
      setColumnVisibility((prev) => ({ ...prev, [key]: visible }));
    },
    []
  );

  const filterCount =
    (sourceFilter !== "all" ? 1 : 0) +
    (campaignFilter !== "all" ? 1 : 0) +
    (contactFilter !== "all" ? 1 : 0) +
    (dateAddedFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0);
  const sortActive = sortField !== "name" || sortOrder !== "asc";
  const activeCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status !== "archived" &&
      !isMagnetPlaybookId(campaign.source_playbook_id)
  );

  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const allMatchingSelected =
    displayPeople.length > 0 &&
    selectedIds.length === displayPeople.length &&
    displayPeople.every((row) => selectedIds.includes(row.id));

  const selectedPeople = useMemo(
    () => people.filter((row) => selectedIds.includes(row.id)),
    [people, selectedIds]
  );
  const campaignableSelected = useMemo(
    () => selectedPeople.filter((row) => row.campaignable),
    [selectedPeople]
  );
  const hasEmailCampaign = useMemo(
    () => activeCampaigns.some((campaign) => campaign.channel === "email"),
    [activeCampaigns]
  );
  const hasLinkedInCampaign = useMemo(
    () =>
      activeCampaigns.some(
        (campaign) => !campaign.channel || campaign.channel === "linkedin"
      ),
    [activeCampaigns]
  );
  const addCampaignHint = useMemo(() => {
    if (campaignableSelected.length > 0) return null;
    if (selectedPeople.some((row) => row.canFindPerson) && hasLinkedInCampaign) {
      return "LinkedIn campaigns need a personal profile. Find person first — or add to an email campaign if they have an email.";
    }
    if (hasEmailCampaign && !hasLinkedInCampaign) {
      return "Email campaigns need an email address on the lead.";
    }
    return "Pick people with a LinkedIn profile or email, then choose a matching campaign.";
  }, [
    campaignableSelected.length,
    hasEmailCampaign,
    hasLinkedInCampaign,
    selectedPeople,
  ]);
  const findPersonSelected = useMemo(
    () => selectedPeople.filter((row) => row.canFindPerson),
    [selectedPeople]
  );
  const selectedCount = selectedIds.length;
  const selectedCommonTags = useMemo(() => {
    if (!selectedPeople.length) return [] as string[];
    let common = normalizeProspectTags(selectedPeople[0]?.tags);
    for (let i = 1; i < selectedPeople.length; i += 1) {
      const have = new Set(
        normalizeProspectTags(selectedPeople[i]?.tags).map((tag) =>
          tag.toLowerCase()
        )
      );
      common = common.filter((tag) => have.has(tag.toLowerCase()));
    }
    return common;
  }, [selectedPeople]);
  const poolTagCatalog = useMemo(
    () =>
      mergeProspectTagCatalog(
        DEFAULT_PROSPECT_TAGS,
        extraTagCatalog,
        ...people.map((row) => row.tags ?? [])
      ),
    [extraTagCatalog, people]
  );
  const tagFilterOptions = useMemo(
    () => sortProspectTagCatalog(poolTagCatalog, []),
    [poolTagCatalog]
  );

  useEffect(() => {
    if (selectedCount === 0) {
      setTagsMenuOpen(false);
      setListMenuOpen(null);
    }
  }, [selectedCount]);
  useEffect(() => {
    if (tagsMenuOpen) setTagsRowId(null);
  }, [tagsMenuOpen]);
  const findPersonCount = Math.min(
    GOOGLE_MAPS_FIND_PERSON_MAX,
    findPersonSelected.length
  );
  const findPersonBusy = Boolean(findPersonJobId);
  const actionBusy = busy || findPersonBusy || Boolean(openingId);

  const campaignMenuPeople = useMemo(() => {
    if (!campaignMenu) return [];
    if (campaignMenu.kind === "bulk") return campaignableSelected;
    const row = people.find((person) => person.id === campaignMenu.id);
    return row ? [row] : [];
  }, [campaignMenu, campaignableSelected, people]);

  useEffect(() => {
    if (campaignMenu?.kind !== "bulk") return;
    if (!selectedIds.length || campaignableSelected.length === 0) {
      setCampaignMenu(null);
    }
  }, [campaignMenu?.kind, campaignableSelected.length, selectedIds.length]);

  useLayoutEffect(() => {
    if (campaignMenu?.kind !== "row") {
      setRowCampaignMenuPos(null);
      return;
    }
    const rowId = campaignMenu.id;
    function updatePosition() {
      const rect = rowCampaignBtnRefs.current.get(rowId)?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - CAMPAIGN_PICKER_WIDTH - 8
      );
      setRowCampaignMenuPos({ top: rect.bottom + 4, left });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [campaignMenu]);

  useEffect(() => {
    setPageSize(readStoredPoolPageSize());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(POOL_PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch {
      // ignore
    }
  }, [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, sourceFilter, campaignFilter, contactFilter, dateAddedFilter, tagFilter, sortField, sortOrder, grouping.field]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handlePageSizeChange(next: PoolPageSize) {
    setPageSize(next);
    setPage(1);
  }

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAllVisible() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  async function addToCampaign(campaignId: string, personIds?: string[]) {
    if (!listId) return;
    const campaign = activeCampaigns.find((row) => row.id === campaignId);
    const sourcePeople = personIds?.length
      ? people.filter((row) => personIds.includes(row.id))
      : selectedPeople;
    const itemIds = sourcePeople
      .filter((row) =>
        poolRowFitsCampaignChannel(row, campaign?.channel ?? "linkedin")
      )
      .map((row) => row.id);
    if (!itemIds.length) {
      setError(
        campaign?.channel === "email"
          ? "None of the selected people have an email address."
          : "None of the selected people have a LinkedIn profile."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setCampaignMenu(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < itemIds.length; i += 250) {
        const chunk = itemIds.slice(i, i + 250);
        const res = await fetch(
          `/api/coach/lead-lists/${encodeURIComponent(listId)}/add-to-campaign`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ campaign_id: campaignId, item_ids: chunk }),
          }
        );
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          added?: number;
          skipped?: number;
        };
        if (!res.ok) throw new Error(body.error || "Could not add to campaign.");
        added += Number(body.added ?? 0);
        skipped += Number(body.skipped ?? 0);
      }
      setNotice(
        `Added ${added} to campaign${skipped ? ` · ${skipped} skipped` : ""}.`
      );
      if (!personIds?.length) setSelectedIds([]);
      await reloadPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function pollMapsJob(jobId: string) {
    for (let i = 0; i < 90; i += 1) {
      let headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      let res = await fetch(
        `/api/coach/google-maps-import/${encodeURIComponent(jobId)}`,
        { headers }
      );
      if (res.status === 401) {
        headers = await getAuthHeaders();
        if (!headers) throw new Error("Sign in required.");
        res = await fetch(
          `/api/coach/google-maps-import/${encodeURIComponent(jobId)}`,
          { headers }
        );
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        peopleFound?: number;
      };
      if (res.status === 401 || res.status === 502) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        continue;
      }
      if (!res.ok) throw new Error(body.error || "Find person failed.");
      if (body.status === "succeeded") {
        return Math.max(0, Number(body.peopleFound ?? 0));
      }
      if (body.status === "failed") {
        throw new Error(body.error || "Find person failed.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    throw new Error("Find person is still running. Refresh the pool in a minute.");
  }

  async function findPerson(itemIds: string[]) {
    const ids = [...new Set(itemIds)].slice(0, GOOGLE_MAPS_FIND_PERSON_MAX);
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/google-maps-import/find-person", {
        method: "POST",
        headers,
        body: JSON.stringify({ item_ids: ids }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        jobId?: string;
      };
      if (!res.ok) throw new Error(body.error || "Find person failed.");
      if (!body.jobId) throw new Error("Find person started but no job id was returned.");
      setFindPersonJobId(body.jobId);
      setNotice(
        `Finding people for ${ids.length.toLocaleString()} ${
          ids.length === 1 ? "business" : "businesses"
        }…`
      );
      const found = await pollMapsJob(body.jobId);
      setNotice(
        found
          ? `Found ${found.toLocaleString()} ${found === 1 ? "person" : "people"}.`
          : "No people found on those listings yet."
      );
      await reloadPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Find person failed.");
    } finally {
      setFindPersonJobId(null);
      setBusy(false);
    }
  }

  async function blacklistSelected() {
    if (!listId || !selectedIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(listId)}/items`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "move_to_blacklist",
            item_ids: selectedIds,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not blacklist.");
      setSelectedIds([]);
      await reloadPeople();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not blacklist.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!listId || !selectedIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(listId)}/items`,
        {
          method: "DELETE",
          headers,
          body: JSON.stringify({ item_ids: selectedIds }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not delete.");
      setSelectedIds([]);
      await reloadPeople();
      await loadImportLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelectedFromList(targetListId?: string) {
    if (!listId || !selectedIds.length) return;
    const onNamedList = activeViewId !== "pool";
    const listToRemoveFrom = onNamedList ? activeViewId : targetListId;
    if (!listToRemoveFrom) return;

    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");

      if (onNamedList && listToRemoveFrom === activeViewId) {
        const res = await fetch(
          `/api/coach/lead-lists/${encodeURIComponent(listToRemoveFrom)}/items`,
          {
            method: "DELETE",
            headers,
            body: JSON.stringify({ item_ids: selectedIds }),
          }
        );
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error || "Could not remove from list.");
        const count = selectedIds.length;
        setSelectedIds([]);
        setListMenuOpen(null);
        setNotice(
          `Removed ${count.toLocaleString()} from this list. They stay in the pool.`
        );
        await reloadPeople();
        await loadImportLists();
        return;
      }

      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(listId)}/items`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "remove_from_list",
            item_ids: selectedIds,
            target_list_id: listToRemoveFrom,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        removed?: number;
      };
      if (!res.ok) throw new Error(body.error || "Could not remove from list.");
      const removed = body.removed ?? 0;
      const targetName =
        importLists.find((list) => list.id === listToRemoveFrom)?.name ||
        "list";
      setListMenuOpen(null);
      setNotice(
        removed > 0
          ? `Removed ${removed.toLocaleString()} from “${targetName}”. They stay in the pool.`
          : `None of the selected people were on “${targetName}”.`
      );
      await loadImportLists();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove from list."
      );
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedToList(opts: {
    targetListId?: string;
    name?: string;
  }) {
    if (!listId || !selectedIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(listId)}/items`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "copy_to_list",
            item_ids: selectedIds,
            target_list_id: opts.targetListId,
            name: opts.name,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        added?: number;
        skipped?: number;
        leadList?: AudienceListSummary;
        targetListId?: string;
      };
      if (!res.ok) throw new Error(body.error || "Could not add to list.");
      const added = body.added ?? 0;
      const skipped = body.skipped ?? 0;
      const targetName =
        body.leadList?.name ||
        importLists.find((list) => list.id === body.targetListId)?.name ||
        "list";
      setListMenuOpen(null);
      setNewListName("");
      setNotice(
        skipped > 0
          ? `Added ${added.toLocaleString()} to “${targetName}” (${skipped.toLocaleString()} already there).`
          : `Added ${added.toLocaleString()} to “${targetName}”.`
      );
      await loadImportLists();
      if (body.leadList?.id) {
        setActiveViewId(body.leadList.id);
        setSelectedIds([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to list.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePoolItemTags(
    itemIds: string[],
    add: string[],
    remove: string[]
  ) {
    if (!listId || !itemIds.length) return;
    if (!add.length && !remove.length) return;

    setTagsBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(listId)}/items`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "update_tags",
            item_ids: itemIds,
            add,
            remove,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: Array<{ id: string; tags: string[] }>;
      };
      if (!res.ok) throw new Error(body.error || "Could not update tags.");
      const byId = new Map(
        (body.items ?? []).map((item) => [item.id, item.tags] as const)
      );
      setPeople((prev) =>
        prev.map((row) => {
          const tags = byId.get(row.id);
          return tags ? { ...row, tags } : row;
        })
      );
      const cached = peopleCacheRef.current.get(activeViewId);
      if (cached) {
        peopleCacheRef.current.set(
          activeViewId,
          cached.map((row) => {
            const tags = byId.get(row.id);
            return tags ? { ...row, tags } : row;
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tags.");
      throw err;
    } finally {
      setTagsBusy(false);
    }
  }

  async function applySelectedTags(nextCommonTags: string[]) {
    const prevKeys = new Set(
      selectedCommonTags.map((tag) => tag.toLowerCase())
    );
    const nextKeys = new Set(
      nextCommonTags.map((tag) => tag.toLowerCase())
    );
    const add = nextCommonTags.filter(
      (tag) => !prevKeys.has(tag.toLowerCase())
    );
    const remove = selectedCommonTags.filter(
      (tag) => !nextKeys.has(tag.toLowerCase())
    );
    await updatePoolItemTags(selectedIds, add, remove);
  }

  async function applyRowTags(row: PoolPerson, nextTags: string[]) {
    const prev = normalizeProspectTags(row.tags);
    const next = normalizeProspectTags(nextTags);
    const prevKeys = new Set(prev.map((tag) => tag.toLowerCase()));
    const nextKeys = new Set(next.map((tag) => tag.toLowerCase()));
    const add = next.filter((tag) => !prevKeys.has(tag.toLowerCase()));
    const remove = prev.filter((tag) => !nextKeys.has(tag.toLowerCase()));
    await updatePoolItemTags([row.id], add, remove);
  }

  async function addTagFromFilter() {
    const tag = normalizeProspectTag(newTagDraft);
    if (!tag) return;
    setExtraTagCatalog((prev) => mergeProspectTagCatalog(prev, [tag]));
    setNewTagDraft("");
    if (selectedIds.length) {
      await updatePoolItemTags(selectedIds, [tag], []);
    }
  }

  async function deleteImportList(id: string) {
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(id)}`,
        { method: "DELETE", headers }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not delete list.");
      if (activeViewId === id) setActiveViewId("pool");
      setNotice("List deleted. People stay in the pool.");
      await loadImportLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete list.");
    } finally {
      setBusy(false);
    }
  }

  async function renameImportList(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not rename list.");
      await loadImportLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename list.");
    } finally {
      setBusy(false);
    }
  }

  async function createEmptyPoolList(name: string) {
    const trimmed = name.trim().slice(0, 120);
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/lead-lists", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: trimmed,
          filters: { from_pool_import: true },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        leadList?: AudienceListSummary;
      };
      if (!res.ok) throw new Error(body.error || "Could not create list.");
      const created = body.leadList;
      if (!created?.id) throw new Error("Could not create list.");
      setAddingList(false);
      setNewTabListName("");
      setImportLists((prev) => {
        if (prev.some((list) => list.id === created.id)) return prev;
        return [...prev, created].slice(-12);
      });
      setActiveViewId(created.id);
      setNotice(
        `Created “${created.name}”. Open All, select people, then Add to list.`
      );
      await loadImportLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateImportList(id: string) {
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch(
        `/api/coach/lead-lists/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "duplicate" }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        leadList?: AudienceListSummary;
      };
      if (!res.ok) throw new Error(body.error || "Could not duplicate list.");
      if (body.leadList?.id) {
        setActiveViewId(body.leadList.id);
        setNotice(`Duplicated as “${body.leadList.name}”.`);
      }
      await loadImportLists();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not duplicate list."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleExport(mode: "shown" | "all", _scope: CsvExportScope) {
    const keys =
      mode === "shown"
        ? shownColumnOptions.map((option) => option.key)
        : columnOrder.filter((key) => columnVisibility[key]);
    const identityKeys: PoolColumnKey[] = ["company", "email", "phone"];
    const exportKeys = [
      ...identityKeys.filter((key) => !keys.includes(key)),
      ...keys,
    ];
    const header = ["Name", ...exportKeys.map((key) => {
      const option = POOL_TABLE_COLUMN_OPTIONS.find((item) => item.key === key);
      return option?.label ?? key;
    })];
    const rows = filtered.map((row) => {
      const cells = [poolDisplayName(row) || row.full_name];
      for (const key of exportKeys) {
        if (key === "title") cells.push(row.job_title ?? "");
        else if (key === "company") cells.push(row.company ?? "");
        else if (key === "source") cells.push(poolSourceLabel(row.source));
        else if (key === "campaign") {
          cells.push(row.in_campaign ? "In campaign" : "Not in campaign");
        } else if (key === "created_at") {
          cells.push(row.created_at ? formatShortDate(row.created_at) : "");
        } else if (key === "linkedin") cells.push(row.linkedin_url ?? "");
        else if (key === "email") cells.push(row.email ?? "");
        else if (key === "phone") cells.push(row.phone ?? "");
        else if (key === "website") cells.push(row.website ?? "");
        else if (key === "address") cells.push(row.address ?? "");
        else if (key === "tags") cells.push((row.tags ?? []).join("; "));
      }
      return cells;
    });
    downloadCsv("pool.csv", [header, ...rows]);
  }

  function renderPoolContact(row: PoolPerson) {
    const phone = row.phone?.trim() || null;
    const email = row.email?.trim() || null;
    if (!phone && !email) return null;
    const formattedPhone = phone ? formatPhoneDisplay(phone) ?? phone : null;
    const telHref = phone ? phoneToTelHref(phone) : null;
    return (
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        {phone ? (
          telHref ? (
            <a
              href={telHref}
              className="min-w-0 truncate text-sm tabular-nums text-slate-800 hover:text-sky-700 hover:underline"
              title={`Call ${formattedPhone}`}
              onClick={(e) => e.stopPropagation()}
            >
              {formattedPhone}
            </a>
          ) : (
            <span className="min-w-0 truncate text-sm tabular-nums text-slate-800">
              {formattedPhone}
            </span>
          )
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            className={`min-w-0 truncate hover:text-sky-700 hover:underline ${
              phone ? "text-xs leading-snug text-slate-500" : "text-sm text-slate-800"
            }`}
            title={email}
            onClick={(e) => e.stopPropagation()}
          >
            {email}
          </a>
        ) : null}
      </div>
    );
  }

  function rememberPoolContact(itemId: string, contactId: string) {
    const patch = (rows: PoolPerson[]) =>
      rows.map((row) =>
        row.id === itemId ? { ...row, contact_id: contactId } : row
      );
    setPeople(patch);
    const cached = peopleCacheRef.current.get(activeViewId);
    if (cached) peopleCacheRef.current.set(activeViewId, patch(cached));
  }

  async function openPoolPerson(row: PoolPerson) {
    if (openingId || busy) return;
    if (row.contact_id) {
      router.push(poolPersonHref(row.contact_id, isAdmin));
      return;
    }
    if (!row.linkedin_url && !row.email && !row.phone) {
      setError(
        "Add a LinkedIn profile, email, or phone before opening this person."
      );
      return;
    }
    setOpeningId(row.id);
    setError(null);
    setNotice(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const res = await fetch(
        `/api/coach/pool/items/${encodeURIComponent(row.id)}/open`,
        { method: "POST", headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        href?: string;
        contactId?: string;
      };
      if (!res.ok || !body.href) {
        setError(body.error || "Could not open this person.");
        return;
      }
      if (body.contactId) rememberPoolContact(row.id, body.contactId);
      const href = isAdmin
        ? body.href.replace(/^\/coach\//, "/admin/")
        : body.href;
      router.push(href);
    } catch {
      setError("Could not open this person.");
    } finally {
      setOpeningId(null);
    }
  }

  const renderRows = (rows: PoolPerson[]) =>
    rows.map((row) => {
      const displayName = poolDisplayName(row) || row.full_name;
      const leadCompany = columnVisibility.company
        ? null
        : poolLeadCompany(row);
      const website = columnVisibility.website ? null : row.website;
      const contact = renderPoolContact(row);
      const canOpen = Boolean(row.linkedin_url || row.email || row.phone);
      const isOpening = openingId === row.id;
      return (
      <tr
        key={row.id}
        className={`border-t border-slate-100 ${
          canOpen ? "hover:bg-slate-50/80" : "hover:bg-slate-50/40"
        }`}
      >
        <td
          className="overflow-hidden px-1 py-2.5 text-center"
          style={{
            width: TABLE_CHECKBOX_COL_WIDTH,
            maxWidth: TABLE_CHECKBOX_COL_WIDTH,
          }}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            disabled={actionBusy}
            onChange={() => toggleId(row.id)}
            aria-label={`Select ${displayName}`}
            className="rounded border-slate-300 text-[#0c5290]"
          />
        </td>
        <td className="overflow-hidden py-2.5 pl-1 pr-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProspectTableAvatar name={displayName} />
            <div className="min-w-0 flex-1">
              {row.contact_id ? (
                <Link
                  href={poolPersonHref(row.contact_id, isAdmin)}
                  prefetch
                  className="block w-full min-w-0 truncate text-left text-sm font-medium text-[#0c5290] hover:underline"
                  title={`Open ${displayName}`}
                >
                  {displayName}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`block w-full min-w-0 truncate text-left text-sm font-medium ${
                    canOpen
                      ? "text-[#0c5290] hover:underline"
                      : "cursor-default text-slate-900"
                  }`}
                  title={
                    canOpen
                      ? `Open ${displayName}`
                      : "Add LinkedIn, email, or phone to open"
                  }
                  disabled={actionBusy || !canOpen}
                  aria-busy={isOpening}
                  onClick={() => void openPoolPerson(row)}
                >
                  {isOpening ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Opening…
                    </span>
                  ) : (
                    displayName
                  )}
                </button>
              )}
              <ProspectLeadSubtitle
                jobTitle={columnVisibility.title ? null : row.job_title}
                businessName={leadCompany}
                companyWebsite={website}
              />
            </div>
          </div>
        </td>
        <td className="overflow-hidden px-3 py-2.5 align-middle">
          {contact ?? <span className="text-sm text-slate-400">—</span>}
        </td>
        {shownColumnOptions.map((option) => (
          <td key={option.key} className="overflow-hidden px-3 py-2.5 text-sm text-slate-700">
            {option.key === "title" ? (
              row.job_title || "—"
            ) : option.key === "company" ? (
              row.company || "—"
            ) : option.key === "source" ? (
              poolSourceLabel(row.source)
            ) : option.key === "campaign" ? (
              row.in_campaign ? (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                  In campaign
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) rowCampaignBtnRefs.current.set(row.id, node);
                      else rowCampaignBtnRefs.current.delete(row.id);
                    }}
                    disabled={
                      actionBusy ||
                      !row.campaignable ||
                      activeCampaigns.length === 0
                    }
                    title={
                      !row.campaignable
                        ? "Needs a LinkedIn profile or email first"
                        : activeCampaigns.length === 0
                          ? "Create a campaign first"
                          : "Add to campaign"
                    }
                    aria-label={`Add ${displayName} to campaign`}
                    aria-expanded={
                      campaignMenu?.kind === "row" &&
                      campaignMenu.id === row.id
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!row.campaignable) return;
                      setCampaignMenu((prev) =>
                        prev?.kind === "row" && prev.id === row.id
                          ? null
                          : { kind: "row", id: row.id }
                      );
                    }}
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                      campaignMenu?.kind === "row" &&
                      campaignMenu.id === row.id
                        ? "bg-slate-800 text-white hover:bg-slate-700"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={
                      actionBusy ||
                      !row.campaignable ||
                      activeCampaigns.length === 0
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!row.campaignable) return;
                      setCampaignMenu((prev) =>
                        prev?.kind === "row" && prev.id === row.id
                          ? null
                          : { kind: "row", id: row.id }
                      );
                    }}
                    className="text-[12px] font-medium text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )
            ) : option.key === "created_at" ? (
              row.created_at ? formatShortDate(row.created_at) : "—"
            ) : option.key === "email" ? (
              row.email ? (
                <a
                  href={`mailto:${row.email}`}
                  className="block max-w-[14rem] truncate text-[#0c5290] hover:underline"
                  title={row.email}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.email}
                </a>
              ) : (
                "—"
              )
            ) : option.key === "phone" ? (
              row.phone ? (
                phoneToTelHref(row.phone) ? (
                  <a
                    href={phoneToTelHref(row.phone) ?? undefined}
                    className="tabular-nums text-slate-800 hover:text-sky-700 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formatPhoneDisplay(row.phone) ?? row.phone}
                  </a>
                ) : (
                  <span className="tabular-nums">
                    {formatPhoneDisplay(row.phone) ?? row.phone}
                  </span>
                )
              ) : (
                "—"
              )
            ) : option.key === "website" ? (
              row.website && poolWebsiteHref(row.website) ? (
                <a
                  href={poolWebsiteHref(row.website) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block max-w-[12rem] truncate text-[#0c5290] hover:underline"
                  title={row.website}
                  onClick={(e) => e.stopPropagation()}
                >
                  {normalizePoolWebsite(row.website) ?? row.website}
                </a>
              ) : (
                "—"
              )
            ) : option.key === "address" ? (
              row.address ? (
                <span className="block max-w-[16rem] truncate" title={row.address}>
                  {row.address}
                </span>
              ) : (
                "—"
              )
            ) : option.key === "linkedin" ? (
              row.linkedin_url ? (
                <a
                  href={row.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[#0c5290] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <LinkedInSolidIcon className="h-4 w-4" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              ) : row.canFindPerson ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void findPerson([row.id])}
                  className="text-xs font-semibold text-[#0c5290] hover:underline disabled:opacity-50"
                >
                  Find
                </button>
              ) : (
                "—"
              )
            ) : option.key === "tags" ? (
              <ProspectTagsPopover
                open={tagsRowId === row.id}
                tags={row.tags ?? []}
                catalog={poolTagCatalog}
                saving={tagsBusy}
                onClose={() => setTagsRowId(null)}
                onChange={(next) => applyRowTags(row, next)}
              >
                <button
                  type="button"
                  disabled={actionBusy}
                  title="Edit tags"
                  aria-label={`Edit tags for ${displayName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagsMenuOpen(false);
                    setCampaignMenu(null);
                    setTagsRowId((id) => (id === row.id ? null : row.id));
                  }}
                  className="flex max-w-[10.5rem] flex-wrap items-center gap-1 rounded-md text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  {(row.tags?.length ?? 0) > 0 ? (
                    <>
                      {row.tags.slice(0, 3).map((tag) => (
                        <ProspectTagChip key={tag} tag={tag} title={tag} />
                      ))}
                      {row.tags.length > 3 ? (
                        <span className="self-center text-[10px] font-medium tabular-nums text-slate-400">
                          +{row.tags.length - 3}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-400">
                      <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                      Add
                    </span>
                  )}
                </button>
              </ProspectTagsPopover>
            ) : null}
          </td>
        ))}
      </tr>
      );
    });

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div ref={toolbarRef} className="shrink-0">
        <ProspectsPipelineToolbar
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search pool…"
          menu={menu}
          onMenuChange={setMenu}
          filterCount={filterCount}
          filterMenu={
            <div role="menu" className={DROPDOWN}>
              <label className="block text-xs font-medium text-slate-600">
                Source
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {poolSourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Campaign
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={campaignFilter}
                  onChange={(e) =>
                    setCampaignFilter(
                      e.target.value as typeof campaignFilter
                    )
                  }
                >
                  <option value="all">All</option>
                  <option value="not_in_campaign">Not in a campaign</option>
                  <option value="in_campaign">In a campaign</option>
                </select>
              </label>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Contact info
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={contactFilter}
                  onChange={(e) =>
                    setContactFilter(e.target.value as PoolContactFilter)
                  }
                >
                  {POOL_CONTACT_FILTER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Date added
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={dateAddedFilter}
                  onChange={(e) =>
                    setDateAddedFilter(e.target.value as PoolDateAddedFilter)
                  }
                >
                  {POOL_DATE_ADDED_FILTER_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-600">Tags</p>
                <form
                  className="mt-1 flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addTagFromFilter();
                  }}
                >
                  <input
                    value={newTagDraft}
                    onChange={(e) => setNewTagDraft(e.target.value)}
                    maxLength={32}
                    placeholder="Add a tag"
                    aria-label="Add a tag"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={tagsBusy || !newTagDraft.trim()}
                    className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>
                {selectedCount > 0 ? (
                  <p className="mt-1 text-[11px] font-normal text-slate-500">
                    Applies to {selectedCount} selected
                  </p>
                ) : null}
                <select
                  className="mt-1.5 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  aria-label="Filter by tag"
                >
                  <option value="all">All</option>
                  <option value="none">No tags</option>
                  {tagFilterOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          sortActive={sortActive}
          sortMenu={
            <div role="menu" className={DROPDOWN}>
              <label className="block text-xs font-medium text-slate-600">
                Sort by
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={sortField}
                  onChange={(e) =>
                    setSortField(e.target.value as typeof sortField)
                  }
                >
                  <option value="name">Name</option>
                  <option value="company">Company</option>
                  <option value="created_at">Date added</option>
                  <option value="source">Source</option>
                </select>
              </label>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Order
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as typeof sortOrder)
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          }
          groupActive={Boolean(groupField)}
          groupMenu={
            <div
              role="menu"
              className="absolute left-0 z-[90] mt-1 w-56 rounded-md border border-slate-200 bg-white py-2 shadow-lg"
            >
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Group by
              </p>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setGrouping({ ...grouping, field: null })}
              >
                None
                {!groupField ? (
                  <Check className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                ) : null}
              </button>
              {POOL_GROUP_FIELDS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    setGrouping({ ...grouping, field: option.key })
                  }
                >
                  {option.label}
                  {groupField === option.key ? (
                    <Check className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                  ) : null}
                </button>
              ))}
              <div className="my-2 border-t border-slate-200" />
              <label className="block px-3 pb-1 text-xs font-medium text-slate-600">
                Group order
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  disabled={!groupField}
                  value={grouping.order}
                  onChange={(e) =>
                    setGrouping({
                      ...grouping,
                      order: e.target.value as PoolGroupOrder,
                    })
                  }
                >
                  <option value="asc">A → Z</option>
                  <option value="desc">Z → A</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
            </div>
          }
          fieldsLabel="Columns"
          fieldsMenu={
            <DataTableColumnsMenu
              open
              hideTrigger
              onToggle={() => setMenu(null)}
              menuRef={columnsMenuRef}
              shownOptions={shownColumnOptions}
              hiddenOptions={hiddenColumnOptions}
              columnVisibility={columnVisibility}
              onVisibilityChange={setColumnVisible}
              onMoveColumn={(dragged, target) =>
                setColumnOrder((prev) => moveKeyInOrder(prev, dragged, target))
              }
              draggingColumnKey={draggingColumnKey}
              onDraggingColumnKeyChange={setDraggingColumnKey}
              align="left"
              label="Columns"
            />
          }
          exportDisabled={loading || filtered.length === 0}
          exportMatchingCount={filtered.length}
          onExportShown={(scope) => handleExport("shown", scope)}
          onExportAll={(scope) => handleExport("all", scope)}
          end={
            <>
              {selectedCount > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                    {selectedCount} selected
                  </span>
                  <div className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
                  {findPersonCount > 0 ? (
                    <TableToolbarButton
                      label={
                        findPersonCount === 1
                          ? "Find person"
                          : `Find (${findPersonCount})`
                      }
                      title={`Find person · about $${estimateGoogleMapsFindPersonCostUsd(
                        findPersonCount
                      ).toFixed(2)}`}
                      disabled={actionBusy}
                      onClick={() =>
                        void findPerson(
                          findPersonSelected.map((row) => row.id)
                        )
                      }
                      icon={
                        findPersonBusy ? (
                          <Loader2
                            className="h-5 w-5 animate-spin text-slate-500"
                            aria-hidden
                          />
                        ) : (
                          <UserSearch
                            className="h-5 w-5 text-slate-500"
                            aria-hidden
                          />
                        )
                      }
                    />
                  ) : null}
                  <div className="flex shrink-0 items-center gap-1">
                    <ProspectTagsPopover
                      open={tagsMenuOpen}
                      tags={selectedCommonTags}
                      catalog={poolTagCatalog}
                      saving={tagsBusy}
                      onClose={() => setTagsMenuOpen(false)}
                      onChange={applySelectedTags}
                    >
                      <TableToolbarButton
                        label="Tags"
                        disabled={actionBusy}
                        active={tagsMenuOpen}
                        aria-expanded={tagsMenuOpen}
                        aria-haspopup="menu"
                        onClick={() => {
                          setCampaignMenu(null);
                          setListMenuOpen(null);
                          setTagsMenuOpen((open) => !open);
                        }}
                        icon={
                          <Tags
                            className="h-5 w-5 text-slate-500"
                            aria-hidden
                          />
                        }
                      />
                    </ProspectTagsPopover>
                    <div className="relative" data-pool-list-menu="">
                      <TableToolbarButton
                        label="Add to list"
                        disabled={actionBusy}
                        active={listMenuOpen === "add"}
                        aria-expanded={listMenuOpen === "add"}
                        aria-haspopup="menu"
                        onClick={() => {
                          setCampaignMenu(null);
                          setTagsMenuOpen(false);
                          setListMenuOpen((open) =>
                            open === "add" ? null : "add"
                          );
                        }}
                        icon={
                          <ListPlus
                            className="h-5 w-5 text-slate-500"
                            aria-hidden
                          />
                        }
                      />
                      {listMenuOpen === "add" ? (
                        <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Add to list
                          </p>
                          {importLists.filter((list) => list.id !== activeViewId)
                            .length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">
                              No other lists yet — create one below.
                            </p>
                          ) : (
                            importLists
                              .filter((list) => list.id !== activeViewId)
                              .map((list) => (
                                <button
                                  key={list.id}
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() =>
                                    void addSelectedToList({
                                      targetListId: list.id,
                                    })
                                  }
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <span className="min-w-0 truncate font-medium">
                                    {list.name}
                                  </span>
                                  {list.item_count > 0 ? (
                                    <span className="shrink-0 text-xs text-slate-400">
                                      {list.item_count.toLocaleString()}
                                    </span>
                                  ) : null}
                                </button>
                              ))
                          )}
                          <div className="mt-1 border-t border-slate-100 px-3 py-2">
                            <form
                              className="flex items-center gap-1.5"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const name = newListName.trim();
                                if (!name) return;
                                void addSelectedToList({ name });
                              }}
                            >
                              <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="New list name"
                                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                aria-label="New list name"
                              />
                              <button
                                type="submit"
                                disabled={actionBusy || !newListName.trim()}
                                className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                              >
                                Create
                              </button>
                            </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="relative" data-pool-list-menu="">
                      <TableToolbarButton
                        label="From list"
                        title="Remove from list"
                        disabled={
                          actionBusy ||
                          (activeViewId === "pool" && importLists.length === 0)
                        }
                        active={listMenuOpen === "remove"}
                        aria-expanded={listMenuOpen === "remove"}
                        aria-haspopup={
                          activeViewId === "pool" ? "menu" : undefined
                        }
                        onClick={() => {
                          setCampaignMenu(null);
                          setTagsMenuOpen(false);
                          if (activeViewId !== "pool") {
                            void removeSelectedFromList();
                            return;
                          }
                          setListMenuOpen((open) =>
                            open === "remove" ? null : "remove"
                          );
                        }}
                        icon={
                          <ListMinus
                            className="h-5 w-5 text-slate-500"
                            aria-hidden
                          />
                        }
                      />
                      {listMenuOpen === "remove" && activeViewId === "pool" ? (
                        <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Remove from list
                          </p>
                          {importLists.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-slate-500">
                              No lists yet.
                            </p>
                          ) : (
                            importLists.map((list) => (
                              <button
                                key={list.id}
                                type="button"
                                disabled={actionBusy}
                                onClick={() =>
                                  void removeSelectedFromList(list.id)
                                }
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <span className="min-w-0 truncate font-medium">
                                  {list.name}
                                </span>
                                {list.item_count > 0 ? (
                                  <span className="shrink-0 text-xs text-slate-400">
                                    {list.item_count.toLocaleString()}
                                  </span>
                                ) : null}
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                    <TableToolbarButton
                      label="Blacklist"
                      disabled={actionBusy}
                      onClick={() => void blacklistSelected()}
                      icon={
                        <Ban className="h-5 w-5 text-slate-500" aria-hidden />
                      }
                    />
                    {activeViewId === "pool" ? (
                      <TableToolbarButton
                        label="Delete"
                        disabled={actionBusy}
                        onClick={() => void deleteSelected()}
                        icon={
                          <Trash2
                            className="h-5 w-5 text-slate-500"
                            aria-hidden
                          />
                        }
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              {selectedCount > 0 ? (
                <div className="relative" data-pool-campaign-menu="">
                  <button
                    type="button"
                    disabled={actionBusy || campaignableSelected.length === 0}
                    title={addCampaignHint ?? undefined}
                    onClick={() => {
                      if (campaignableSelected.length === 0) return;
                      setTagsMenuOpen(false);
                      setListMenuOpen(null);
                      setCampaignMenu((prev) =>
                        prev?.kind === "bulk" ? null : { kind: "bulk" }
                      );
                    }}
                    className="inline-flex h-10 shrink-0 items-center rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {campaignableSelected.length <= 1
                      ? "Add to campaign"
                      : `Add ${campaignableSelected.length} to campaign`}
                  </button>
                  {campaignMenu?.kind === "bulk" ? (
                    <div className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <PoolCampaignPickerList
                        people={campaignMenuPeople}
                        campaigns={activeCampaigns}
                        toggleBusy={toggleBusy}
                        actionBusy={actionBusy}
                        linkedInConnected={linkedInConnected}
                        emailConnected={emailConnected}
                        onToggleCampaign={onToggleCampaign}
                        onPick={(campaignId) => void addToCampaign(campaignId)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                Import
              </button>
            </>
          }
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="border-b border-slate-200">
        <ProspectsTableViewBar
          views={tableViews.views}
          activeViewId={
            activeViewId === "pool" ? tableViews.activeViewId : null
          }
          onSwitchView={(viewId) => {
            setActiveViewId("pool");
            void tableViews.switchView(viewId);
          }}
          onAddView={(name) => {
            setActiveViewId("pool");
            void tableViews.addViewFromCurrent(name);
          }}
          onRenameView={(viewId, name) => {
            void tableViews.renameView(viewId, name);
          }}
          onDeleteView={(viewId) => {
            void tableViews.deleteView(viewId);
          }}
          onReorderViews={(orderedViewIds) => {
            void tableViews.reorderViews(orderedViewIds);
          }}
          showAddView={false}
          onDuplicateView={(viewId) => {
            setActiveViewId("pool");
            void tableViews.duplicateView(viewId);
          }}
          afterViews={
            <>
                {importLists.map((list) => {
                  const job = watchedImports.find(
                    (j) => j.saveListId === list.id
                  );
                  const live = job ? importLiveById[job.id] : null;
                  const importing = Boolean(job);
                  const progressCount = live?.progressCount ?? 0;
                  const targetCount =
                    live?.targetCount || job?.targetCount || 0;
                  const mapsImport =
                    (live?.kind ?? job?.kind) === "google_maps";
                  const tabPct =
                    importing && targetCount > 0
                      ? mapsImport
                        ? googleMapsImportProgressPercent({
                            progressCount,
                            targetCount,
                            startedAtMs: Date.parse(
                              job?.startedAt || new Date().toISOString()
                            ),
                            nowMs: importClockMs,
                            phase: live?.phase ?? "scraping",
                          })
                        : Math.min(
                            100,
                            Math.round(
                              (progressCount / Math.max(1, targetCount)) * 100
                            )
                          )
                      : 0;
                  const selected = activeViewId === list.id;
                  const renaming = renamingImportListId === list.id;
                  const tabSurface = importing
                    ? selected
                      ? "border-b-[3px] border-amber-600 bg-amber-100/90 text-amber-950"
                      : "border-b-[3px] border-transparent bg-amber-100/70 text-amber-800 hover:bg-amber-100"
                    : selected
                      ? "border-b-[3px] border-sky-600 bg-sky-100/90 text-sky-800"
                      : "border-b-[3px] border-transparent bg-slate-200/90 text-slate-600 hover:bg-slate-300/70 hover:text-slate-800";

                  if (renaming) {
                    return (
                      <form
                        key={list.id}
                        className={`flex shrink-0 items-center rounded-tl-md rounded-tr-md px-2 py-1.5 ${tabSurface}`}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = renameImportValue.trim();
                          setRenamingImportListId(null);
                          setRenameImportValue("");
                          if (trimmed && trimmed !== list.name) {
                            void renameImportList(list.id, trimmed);
                          }
                        }}
                      >
                        <input
                          ref={renameImportInputRef}
                          type="text"
                          value={renameImportValue}
                          onChange={(e) => setRenameImportValue(e.target.value)}
                          onBlur={() => {
                            const trimmed = renameImportValue.trim();
                            setRenamingImportListId(null);
                            setRenameImportValue("");
                            if (trimmed && trimmed !== list.name) {
                              void renameImportList(list.id, trimmed);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setRenamingImportListId(null);
                              setRenameImportValue("");
                            }
                          }}
                          className="w-32 rounded border border-slate-300 px-2 py-0.5 text-sm font-medium text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                          aria-label="Rename list"
                        />
                      </form>
                    );
                  }

                  return (
                    <div
                      key={list.id}
                      className={`group relative flex shrink-0 items-stretch rounded-tl-md rounded-tr-md ${tabSurface}`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveViewId(list.id)}
                        className="inline-flex max-w-[14rem] items-center gap-1.5 px-2 py-1.5 pr-6 text-sm font-medium transition-colors"
                      >
                        {importing ? (
                          <Loader2
                            className="h-3.5 w-3.5 shrink-0 animate-spin"
                            aria-hidden
                          />
                        ) : null}
                        <span className="min-w-0 truncate">{list.name}</span>
                        {!importing && list.item_count > 0 ? (
                          <span className="shrink-0 text-xs font-normal text-slate-500">
                            {list.item_count.toLocaleString()}
                          </span>
                        ) : null}
                      </button>
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2">
                        <TabOverflowMenu
                          label={list.name}
                          canRename={!importing}
                          canDelete={!importing}
                          canDuplicate={!importing}
                          disabled={busy || importing}
                          onRename={() => {
                            setRenamingImportListId(list.id);
                            setRenameImportValue(list.name);
                          }}
                          onDelete={() => {
                            void deleteImportList(list.id);
                          }}
                          onDuplicate={() => {
                            void duplicateImportList(list.id);
                          }}
                        />
                      </div>
                      {importing && targetCount > 0 ? (
                        <span
                          className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded bg-amber-100"
                          aria-hidden
                        >
                          <span
                            className="block h-full bg-amber-500 transition-[width] duration-700"
                            style={{
                              width: `${tabPct}%`,
                            }}
                          />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {addingList ? (
                  <form
                    className="flex items-center gap-2 rounded-tl-md rounded-tr-md border-b-[3px] border-transparent bg-slate-200/90 px-2 py-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void createEmptyPoolList(newTabListName);
                    }}
                  >
                    <input
                      ref={addListInputRef}
                      type="text"
                      value={newTabListName}
                      onChange={(e) => setNewTabListName(e.target.value)}
                      onBlur={() => {
                        if (!newTabListName.trim()) {
                          setAddingList(false);
                          setNewTabListName("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setAddingList(false);
                          setNewTabListName("");
                        }
                      }}
                      placeholder="List name"
                      disabled={busy}
                      className="w-36 rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      aria-label="New list name"
                    />
                    <button
                      type="submit"
                      disabled={busy || !newTabListName.trim()}
                      onMouseDown={(e) => e.preventDefault()}
                      className="rounded px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRenamingImportListId(null);
                      setAddingList(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-tl-md rounded-tr-md border-b-[3px] border-transparent bg-slate-200/90 px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-300/70 hover:text-slate-800 disabled:opacity-50"
                    aria-label="Add list"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    List
                  </button>
                )}
              </>
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl border border-t-0 border-slate-200 bg-white shadow-sm">

      {error ? (
        <div className="shrink-0 px-4 pt-3">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      ) : null}

      {allPageSelected && !allMatchingSelected ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-100 bg-sky-50 px-4 py-2 text-sm">
          <span className="font-medium text-sky-900">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(displayPeople.map((row) => row.id))
            }
            className="font-medium text-sky-700 hover:text-sky-900"
          >
            Select all {displayPeople.length} matching
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 overflow-auto overscroll-contain [container-type:inline-size]">
        <table
          className="w-full table-fixed border-separate border-spacing-0"
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            <col
              style={{
                width: TABLE_CHECKBOX_COL_WIDTH,
                minWidth: TABLE_CHECKBOX_COL_WIDTH,
                maxWidth: TABLE_CHECKBOX_COL_WIDTH,
              }}
            />
            <col style={{ width: TABLE_NAME_COL_WIDTH }} />
            <col style={{ width: TABLE_CONTACT_COL_WIDTH }} />
            {shownColumnOptions.map((column) => (
              <col
                key={column.key}
                style={{ width: getPoolColumnWidth(column.key) }}
              />
            ))}
          </colgroup>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th
                className="overflow-hidden px-1 py-2 text-center"
                style={{
                  width: TABLE_CHECKBOX_COL_WIDTH,
                  maxWidth: TABLE_CHECKBOX_COL_WIDTH,
                }}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  disabled={!pagedPeople.length}
                  onChange={toggleAllVisible}
                  aria-label="Select all people on this page"
                  className="rounded border-slate-300 text-[#0c5290]"
                />
              </th>
              <th className="overflow-hidden py-2 pl-1 pr-3">Name</th>
              <th className="overflow-hidden px-3 py-2">Contact Info</th>
              {shownColumnOptions.map((option) => (
                <th key={option.key} className="overflow-hidden px-3 py-2">
                  {option.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={3 + shownColumnOptions.length}
                  className="p-0"
                >
                  <div className="sticky left-0 w-[100cqw] px-3 py-12 text-center text-sm text-slate-600">
                  {savingImportListId &&
                  (savingImportListId === activeViewId ||
                    activeViewId === "pool")
                    ? "Saving businesses into your pool…"
                    : watchedImports.some((j) => j.saveListId === activeViewId)
                      ? "Still importing — hang tight…"
                      : "Loading pool…"}
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + shownColumnOptions.length}
                  className="p-0"
                >
                  <div className="sticky left-0 w-[100cqw] px-3 py-10 text-center text-sm text-slate-600">
                  {(() => {
                    const activeImport = watchedImports.find(
                      (j) => j.saveListId === activeViewId
                    );
                    const live = activeImport
                      ? importLiveById[activeImport.id]
                      : null;
                    if (
                      activeImport &&
                      (live?.kind === "google_maps" ||
                        activeImport.kind === "google_maps")
                    ) {
                      return (
                        <GoogleMapsImportWaitPanel
                          progressCount={live?.progressCount ?? 0}
                          targetCount={
                            live?.targetCount || activeImport.targetCount || 0
                          }
                          startedAt={activeImport.startedAt}
                          phase={live?.phase ?? "scraping"}
                          peopleFound={live?.peopleFound ?? 0}
                          listName={activeImport.name}
                        />
                      );
                    }
                    if (people.length === 0) {
                      if (activeViewId === "pool") {
                        return "The pool is empty. Add a person, upload a CSV, or import from Sales Nav or Google Maps.";
                      }
                      if (activeImport) {
                        return "Import in progress — people will show here when it finishes.";
                      }
                      return "This list is empty.";
                    }
                    return "No people match this smart list.";
                  })()}
                  </div>
                </td>
              </tr>
            ) : (
              pagedPeople.map((row) => {
                const section = groupHeaderByFirstRowId.get(row.id);
                return (
                  <Fragment key={row.id}>
                    {section ? (
                      <tr>
                        <td
                          colSpan={3 + shownColumnOptions.length}
                          className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {section.label}
                          <span className="ml-2 font-medium normal-case text-slate-400">
                            {section.people.length}
                          </span>
                        </td>
                      </tr>
                    ) : null}
                    {renderRows([row])}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>

      {!loading && displayPeople.length > 0 ? (
        <nav
          className={`flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white py-3 sm:flex-row sm:items-center sm:justify-between ${TABLE_SECTION_PADDING}`}
          aria-label="Pool pagination"
        >
          <label className="inline-flex items-center gap-2 text-sm text-slate-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) =>
                handlePageSizeChange(Number(e.target.value) as PoolPageSize)
              }
              className="h-8 rounded-lg border border-slate-200 bg-white py-0 pl-2 pr-7 text-sm font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              aria-label="People per page"
            >
              {POOL_PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>per page</span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="tabular-nums text-sm text-slate-500">
              {paginationRangeLabel}
            </p>
            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                {pageNumbers.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="px-1.5 text-sm text-slate-400"
                      aria-hidden
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                        item === page
                          ? "bg-sky-100 text-sky-800"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}
      </div>
      </div>

      <ImportPoolModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void reloadPeople();
          void loadImportLists();
        }}
        onImportStarted={(info) => {
          setImportOpen(false);
          setImportLists((prev) => {
            if (prev.some((list) => list.id === info.saveListId)) return prev;
            return [
              ...prev,
              {
                id: info.saveListId,
                name: info.saveListName,
                kind: "audience" as const,
                source:
                  info.kind === "google_maps" ? "google_maps" : "sales_nav",
                item_count: 0,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                from_pool_import: true,
              },
            ].slice(-12);
          });
          setActiveViewId(info.saveListId);
        }}
      />

      {campaignMenu?.kind === "row" && rowCampaignMenuPos
        ? createPortal(
            <div
              data-pool-campaign-menu=""
              className="fixed z-[220] w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                top: rowCampaignMenuPos.top,
                left: rowCampaignMenuPos.left,
              }}
            >
              <PoolCampaignPickerList
                people={campaignMenuPeople}
                campaigns={activeCampaigns}
                toggleBusy={toggleBusy}
                actionBusy={actionBusy}
                linkedInConnected={linkedInConnected}
                emailConnected={emailConnected}
                onToggleCampaign={onToggleCampaign}
                onPick={(campaignId) => {
                  const personId =
                    campaignMenu.kind === "row" ? campaignMenu.id : null;
                  if (!personId) return;
                  void addToCampaign(campaignId, [personId]);
                }}
              />
            </div>,
            document.body
          )
        : null}

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[90] max-w-[min(22rem,calc(100vw-2.5rem))] rounded-lg bg-slate-800 px-3.5 py-3 text-sm font-medium text-white shadow-lg sm:bottom-6 sm:right-6"
        >
          <p className="leading-snug">{notice}</p>
          {!notice.includes("…") ? (
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-1.5 text-xs font-semibold text-white/80 underline underline-offset-2 hover:text-white"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
