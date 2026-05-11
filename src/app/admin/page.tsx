"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  ArrowUpDown,
  ChevronDown,
  Columns3,
  ExternalLink,
  GripVertical,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { LADDER_LEVELS, ladderAdminSelectLabel } from "@/lib/ladder";

const CRM_LOCATION_BASE_URL = "https://app.procoachplatform.com/v2/location";
const COACH_TABLE_SETTINGS_STORAGE_KEY = "admin-coaches-table-settings-v1";

function ladderLevelShortName(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return LADDER_LEVELS.find((l) => l.id === id)?.name ?? id;
}

function formatDateDisplay(value: Date): string {
  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() === currentYear ? {} : { year: "numeric" }),
  }).format(value);
}

function formatGoalDateDisplay(iso: string): string {
  const t = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(t)) return iso;
  return formatDateDisplay(new Date(t));
}

function ReadonlyLadderLevelCell({
  levelId,
}: {
  levelId: string | null | undefined;
}) {
  const short = ladderLevelShortName(levelId);
  if (!short) {
    return <span className="text-xs text-slate-400">Not set</span>;
  }
  const lvl = LADDER_LEVELS.find((l) => l.id === levelId);
  return (
    <span
      className="block truncate text-xs text-slate-800"
      title={lvl ? ladderAdminSelectLabel(lvl) : short}
    >
      {short}
    </span>
  );
}

type CoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  avatar_url: string | null;
  coach_business_name: string | null;
  linkedin_url: string | null;
  current_monthly_income: number | null;
  goal_monthly_income: number | null;
  joined_at: string | null;
  client_count: number;
  directory_listed: boolean;
  directory_level: string | null;
  conference_status: "no" | "maybe" | "yes" | null;
  /** Admin-only: outbound webhook fired with prospect contact info + score. */
  lead_webhook_url: string | null;
  /** Human-readable CRM account/profile label (e.g. AMF Consulting). */
  crm_profile_name: string | null;
  /** CRM location id appended to Pro Coach Platform location URL. */
  crm_location_id: string | null;
  ladder_level: string | null;
  ladder_goal_level: string | null;
  ladder_goal_target_date: string | null;
  last_login_at: string | null;
};

type ConferenceFilter = "all" | "yes" | "maybe" | "no" | "not_set";
type CrmNameFilter = "all" | "has_name" | "no_name";
type LastLoginFilter = "all" | "has_login" | "never" | "last_30_days" | "over_90_days";
type LastLoginSort = "recent_first" | "oldest_first" | "never_first";

type CoachTableColumnVisibility = {
  slug: boolean;
  joinDate: boolean;
  memberFor: boolean;
  goalLevel: boolean;
  clients: boolean;
  linkedinProfile: boolean;
  directory: boolean;
  certification: boolean;
  conference: boolean;
  currentLevel: boolean;
  goalBy: boolean;
  lastLogin: boolean;
  crm: boolean;
  leadWebhook: boolean;
  landing: boolean;
  viewAs: boolean;
};

type PersistedCoachTableSettings = {
  conferenceFilter: ConferenceFilter;
  crmNameFilter: CrmNameFilter;
  lastLoginFilter: LastLoginFilter;
  lastLoginSort: LastLoginSort;
  columnVisibility: CoachTableColumnVisibility;
  columnOrder: Array<keyof CoachTableColumnVisibility>;
};

const DEFAULT_COACH_TABLE_COLUMNS: CoachTableColumnVisibility = {
  slug: true,
  joinDate: true,
  memberFor: true,
  goalLevel: true,
  clients: true,
  linkedinProfile: true,
  directory: true,
  certification: true,
  conference: true,
  currentLevel: true,
  goalBy: true,
  lastLogin: true,
  crm: true,
  leadWebhook: true,
  landing: true,
  viewAs: true,
};

const COACH_TABLE_COLUMN_OPTIONS: Array<{
  key: keyof CoachTableColumnVisibility;
  label: string;
}> = [
  { key: "slug", label: "Slug" },
  { key: "joinDate", label: "Join date" },
  { key: "memberFor", label: "Member for" },
  { key: "goalLevel", label: "Goal" },
  { key: "clients", label: "Clients" },
  { key: "linkedinProfile", label: "LinkedIn" },
  { key: "directory", label: "Directory" },
  { key: "certification", label: "Certification" },
  { key: "conference", label: "Conference" },
  { key: "currentLevel", label: "Current level" },
  { key: "goalBy", label: "Goal by" },
  { key: "lastLogin", label: "Last login" },
  { key: "crm", label: "CRM" },
  { key: "leadWebhook", label: "Lead webhook" },
  { key: "landing", label: "Landing / preview" },
  { key: "viewAs", label: "View as coach" },
];

const COACH_TABLE_COLUMN_OPTION_BY_KEY = new Map(
  COACH_TABLE_COLUMN_OPTIONS.map((option) => [option.key, option] as const)
);
const COACH_TABLE_COLUMN_KEYS = COACH_TABLE_COLUMN_OPTIONS.map(
  (option) => option.key
);

function isConferenceFilter(value: unknown): value is ConferenceFilter {
  return (
    value === "all" ||
    value === "yes" ||
    value === "maybe" ||
    value === "no" ||
    value === "not_set"
  );
}

function isCrmNameFilter(value: unknown): value is CrmNameFilter {
  return value === "all" || value === "has_name" || value === "no_name";
}

function isLastLoginFilter(value: unknown): value is LastLoginFilter {
  return (
    value === "all" ||
    value === "has_login" ||
    value === "never" ||
    value === "last_30_days" ||
    value === "over_90_days"
  );
}

function isLastLoginSort(value: unknown): value is LastLoginSort {
  return (
    value === "recent_first" ||
    value === "oldest_first" ||
    value === "never_first"
  );
}

function parsePersistedCoachTableSettings(
  raw: string
): PersistedCoachTableSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedCoachTableSettings>;
    if (
      !parsed ||
      !isConferenceFilter(parsed.conferenceFilter) ||
      !isCrmNameFilter(parsed.crmNameFilter) ||
      !isLastLoginFilter(parsed.lastLoginFilter) ||
      !isLastLoginSort(parsed.lastLoginSort) ||
      !parsed.columnVisibility ||
      !parsed.columnOrder
    ) {
      return null;
    }

    const visibility = COACH_TABLE_COLUMN_KEYS.reduce((acc, key) => {
      const rawValue = parsed.columnVisibility?.[key];
      acc[key] =
        typeof rawValue === "boolean"
          ? rawValue
          : DEFAULT_COACH_TABLE_COLUMNS[key];
      return acc;
    }, {} as CoachTableColumnVisibility);

    const seen = new Set<keyof CoachTableColumnVisibility>();
    const orderedKeys: Array<keyof CoachTableColumnVisibility> = [];
    for (const key of parsed.columnOrder) {
      if (COACH_TABLE_COLUMN_OPTION_BY_KEY.has(key) && !seen.has(key)) {
        seen.add(key);
        orderedKeys.push(key);
      }
    }
    for (const key of COACH_TABLE_COLUMN_KEYS) {
      if (!seen.has(key)) orderedKeys.push(key);
    }

    return {
      conferenceFilter: parsed.conferenceFilter,
      crmNameFilter: parsed.crmNameFilter,
      lastLoginFilter: parsed.lastLoginFilter,
      lastLoginSort: parsed.lastLoginSort,
      columnVisibility: visibility,
      columnOrder: orderedKeys,
    };
  } catch {
    return null;
  }
}

function conferenceStatusClasses(status: CoachRow["conference_status"]): string {
  if (status === "yes") return "bg-emerald-100 text-emerald-800";
  if (status === "maybe") return "bg-amber-100 text-amber-800";
  if (status === "no") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-600";
}

function formatLastLoginDisplay(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return formatDateDisplay(new Date(t));
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

function addMonths(date: Date, months: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const d = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));
  return new Date(targetYear, targetMonth, d);
}

function totalDaysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function formatMemberFor(joinedIso: string): { label: string; totalDays: number } {
  const base = joinedIso.includes("T")
    ? new Date(joinedIso)
    : new Date(`${joinedIso}T12:00:00`);
  if (Number.isNaN(base.getTime())) {
    return { label: joinedIso, totalDays: 0 };
  }

  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (start > end) return { label: "0d", totalDays: 0 };

  let years = end.getFullYear() - start.getFullYear();
  let cursor = addMonths(start, years * 12);
  if (cursor > end) {
    years -= 1;
    cursor = addMonths(start, years * 12);
  }

  let months = 0;
  while (months < 11) {
    const next = addMonths(cursor, 1);
    if (next > end) break;
    cursor = next;
    months += 1;
  }

  const days = totalDaysBetween(cursor, end);
  const totalDays = totalDaysBetween(start, end);

  if (years <= 0 && months <= 0) return { label: `${days}d`, totalDays };
  if (years <= 0) return { label: `${months}m ${days}d`, totalDays };
  return { label: `${years}y ${months}m ${days}d`, totalDays };
}

export default function AdminPage() {
  const router = useRouter();
  const { setImpersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [creatingCoach, setCreatingCoach] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [coachSearchTerm, setCoachSearchTerm] = useState("");
  const [conferenceFilter, setConferenceFilter] =
    useState<ConferenceFilter>("all");
  const [crmNameFilter, setCrmNameFilter] = useState<CrmNameFilter>("all");
  const [lastLoginFilter, setLastLoginFilter] =
    useState<LastLoginFilter>("all");
  const [lastLoginSort, setLastLoginSort] =
    useState<LastLoginSort>("recent_first");
  const [columnVisibility, setColumnVisibility] =
    useState<CoachTableColumnVisibility>(DEFAULT_COACH_TABLE_COLUMNS);
  const [columnOrder, setColumnOrder] = useState<
    Array<keyof CoachTableColumnVisibility>
  >(COACH_TABLE_COLUMN_OPTIONS.map((option) => option.key));
  const [hasLoadedPersistedSettings, setHasLoadedPersistedSettings] =
    useState(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<
    keyof CoachTableColumnVisibility | null
  >(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const filtersMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [sendInvite, setSendInvite] = useState(true);
  const [directorySavingId, setDirectorySavingId] = useState<string | null>(
    null
  );
  const [deletingCoachId, setDeletingCoachId] = useState<string | null>(null);
  const [webhookEditCoachId, setWebhookEditCoachId] = useState<string | null>(
    null
  );
  const [crmProfileNameValue, setCrmProfileNameValue] = useState("");
  const [crmLocationIdValue, setCrmLocationIdValue] = useState("");
  const [coachFullNameValue, setCoachFullNameValue] = useState("");
  const [coachBusinessNameValue, setCoachBusinessNameValue] = useState("");
  const [coachLinkedinUrlValue, setCoachLinkedinUrlValue] = useState("");
  const [webhookEditValue, setWebhookEditValue] = useState("");
  const [webhookEditError, setWebhookEditError] = useState<string | null>(null);
  const [webhookEditSaving, setWebhookEditSaving] = useState(false);

  useEffect(() => {
    if (!columnsMenuOpen && !filtersMenuOpen && !sortMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        columnsMenuRef.current &&
        columnsMenuRef.current.contains(target)
      ) {
        return;
      }
      if (
        filtersMenuRef.current &&
        filtersMenuRef.current.contains(target)
      ) {
        return;
      }
      if (sortMenuRef.current && sortMenuRef.current.contains(target)) {
        return;
      }
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(target)
      ) {
        setColumnsMenuOpen(false);
      }
      setFiltersMenuOpen(false);
      setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen, filtersMenuOpen, sortMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(COACH_TABLE_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = parsePersistedCoachTableSettings(raw);
      if (parsed) {
        setConferenceFilter(parsed.conferenceFilter);
        setCrmNameFilter(parsed.crmNameFilter);
        setLastLoginFilter(parsed.lastLoginFilter);
        setLastLoginSort(parsed.lastLoginSort);
        setColumnVisibility(parsed.columnVisibility);
        setColumnOrder(parsed.columnOrder);
      }
    }
    setHasLoadedPersistedSettings(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedSettings || typeof window === "undefined") return;
    const payload: PersistedCoachTableSettings = {
      conferenceFilter,
      crmNameFilter,
      lastLoginFilter,
      lastLoginSort,
      columnVisibility,
      columnOrder,
    };
    window.localStorage.setItem(
      COACH_TABLE_SETTINGS_STORAGE_KEY,
      JSON.stringify(payload)
    );
  }, [
    hasLoadedPersistedSettings,
    conferenceFilter,
    crmNameFilter,
    lastLoginFilter,
    lastLoginSort,
    columnVisibility,
    columnOrder,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setCheckingRole(true);
      setError(null);

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setCheckingRole(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      setCheckingRole(false);
      setLoading(true);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setError("Unable to load coaches.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/coaches", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as {
        coaches?: CoachRow[];
        error?: string;
      };

      if (cancelled) return;

      if (!res.ok) {
        setError(body?.error ?? "Unable to load coaches.");
        setLoading(false);
        return;
      }

      setCoaches(body.coaches ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function patchCoachRow(
    coachId: string,
    body: {
      directory_listed?: boolean;
      directory_level?: string | null;
      conference_status?: "no" | "maybe" | "yes" | null;
      ladder_level?: string | null;
      ladder_goal_level?: string | null;
      ladder_goal_target_date?: string | null;
      lead_webhook_url?: string | null;
      crm_profile_name?: string | null;
      crm_location_id?: string | null;
      full_name?: string | null;
      coach_business_name?: string | null;
      linkedin_url?: string | null;
    }
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, error: "Not signed in." };
    }
    setDirectorySavingId(coachId);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? "Update failed.");
      }
      setCoaches((prev) =>
        prev.map((c) =>
          c.id === coachId
            ? {
                ...c,
                ...(body.directory_listed !== undefined
                  ? { directory_listed: body.directory_listed }
                  : {}),
                ...(body.directory_level !== undefined
                  ? { directory_level: body.directory_level }
                  : {}),
                ...(body.conference_status !== undefined
                  ? { conference_status: body.conference_status }
                  : {}),
                ...(body.ladder_level !== undefined
                  ? { ladder_level: body.ladder_level }
                  : {}),
                ...(body.ladder_goal_level !== undefined
                  ? { ladder_goal_level: body.ladder_goal_level }
                  : {}),
                ...(body.ladder_goal_target_date !== undefined
                  ? { ladder_goal_target_date: body.ladder_goal_target_date }
                  : {}),
                ...(body.lead_webhook_url !== undefined
                  ? { lead_webhook_url: body.lead_webhook_url }
                  : {}),
                ...(body.crm_profile_name !== undefined
                  ? { crm_profile_name: body.crm_profile_name }
                  : {}),
                ...(body.crm_location_id !== undefined
                  ? { crm_location_id: body.crm_location_id }
                  : {}),
                ...(body.full_name !== undefined
                  ? { full_name: body.full_name }
                  : {}),
                ...(body.coach_business_name !== undefined
                  ? { coach_business_name: body.coach_business_name }
                  : {}),
                ...(body.linkedin_url !== undefined
                  ? { linkedin_url: body.linkedin_url }
                  : {}),
              }
            : c
        )
      );
      return { ok: true };
    } catch (e) {
      console.error(e);
      const msg = (e as Error)?.message ?? "Could not update coach.";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setDirectorySavingId(null);
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const normalizedCoachSearchTerm = coachSearchTerm.trim().toLowerCase();
  const orderedColumnOptions = columnOrder
    .map((key) => COACH_TABLE_COLUMN_OPTION_BY_KEY.get(key))
    .filter((option): option is { key: keyof CoachTableColumnVisibility; label: string } =>
      Boolean(option)
    );
  const shownColumnOptions = orderedColumnOptions.filter(
    ({ key }) => columnVisibility[key]
  );
  const hiddenColumnOptions = orderedColumnOptions.filter(
    ({ key }) => !columnVisibility[key]
  );
  const activeFilterCount =
    (conferenceFilter !== "all" ? 1 : 0) +
    (lastLoginFilter !== "all" ? 1 : 0) +
    (crmNameFilter !== "all" ? 1 : 0);
  const visibleColumnCount =
    3 +
    COACH_TABLE_COLUMN_OPTIONS.reduce(
      (n, { key }) => n + (columnVisibility[key] ? 1 : 0),
      0
    );

  function moveColumnInOrder(
    draggedKey: keyof CoachTableColumnVisibility,
    targetKey: keyof CoachTableColumnVisibility
  ) {
    if (draggedKey === targetKey) return;
    setColumnOrder((prev) => {
      const from = prev.indexOf(draggedKey);
      const to = prev.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function openCoachEditModal(coach: CoachRow) {
    setWebhookEditCoachId(coach.id);
    setCoachFullNameValue(coach.full_name ?? "");
    setCoachBusinessNameValue(coach.coach_business_name ?? "");
    setCoachLinkedinUrlValue(coach.linkedin_url ?? "");
    setCrmProfileNameValue(coach.crm_profile_name ?? "");
    setCrmLocationIdValue(coach.crm_location_id ?? "");
    setWebhookEditValue(coach.lead_webhook_url ?? "");
    setWebhookEditError(null);
  }
  const now = Date.now();
  const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgoMs = now - 90 * 24 * 60 * 60 * 1000;
  const filteredCoaches = coaches
    .filter((coach) => {
      const matchesName = normalizedCoachSearchTerm
        ? (coach.full_name ?? "")
            .toLowerCase()
            .includes(normalizedCoachSearchTerm)
        : true;
      const matchesConference =
        conferenceFilter === "all"
          ? true
          : conferenceFilter === "not_set"
            ? coach.conference_status === null
            : coach.conference_status === conferenceFilter;
      const hasCrmName = !!coach.crm_profile_name?.trim();
      const matchesCrmName =
        crmNameFilter === "all"
          ? true
          : crmNameFilter === "has_name"
            ? hasCrmName
            : !hasCrmName;
      const lastLoginMs = coach.last_login_at
        ? Date.parse(coach.last_login_at)
        : Number.NaN;
      const hasValidLastLogin = !Number.isNaN(lastLoginMs);
      const matchesLastLogin =
        lastLoginFilter === "all"
          ? true
          : lastLoginFilter === "has_login"
            ? hasValidLastLogin
            : lastLoginFilter === "never"
              ? !hasValidLastLogin
              : lastLoginFilter === "last_30_days"
                ? hasValidLastLogin && lastLoginMs >= thirtyDaysAgoMs
                : hasValidLastLogin && lastLoginMs <= ninetyDaysAgoMs;
      return matchesName && matchesConference && matchesCrmName && matchesLastLogin;
    })
    .sort((a, b) => {
      const aMs = a.last_login_at ? Date.parse(a.last_login_at) : Number.NaN;
      const bMs = b.last_login_at ? Date.parse(b.last_login_at) : Number.NaN;
      const aHas = !Number.isNaN(aMs);
      const bHas = !Number.isNaN(bMs);
      if (lastLoginSort === "never_first") {
        if (aHas !== bHas) return aHas ? 1 : -1;
        if (!aHas && !bHas) return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      } else {
        if (aHas !== bHas) return aHas ? -1 : 1;
      }
      if (!aHas && !bHas) return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      if (lastLoginSort === "oldest_first") return aMs - bMs;
      return bMs - aMs;
    });

  async function handleCreateCoach(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreatingCoach(true);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in to create a coach.");
      }

      const res = await fetch("/api/admin/coaches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName: newFullName,
          businessName: newBusinessName,
          email: newEmail,
          slug: newSlug,
          invite: sendInvite,
          password: sendInvite ? undefined : newPassword,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.error ?? "Unable to create coach.");
      }

      setCreateSuccess(
        sendInvite
          ? "Coach created and invite email requested."
          : "Coach created successfully."
      );
      setNewFullName("");
      setNewBusinessName("");
      setNewEmail("");
      setNewSlug("");
      setNewPassword("");

      // Reload coaches list
      const listRes = await fetch("/api/admin/coaches", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const listBody = (await listRes.json().catch(() => ({}))) as {
        coaches?: CoachRow[];
      };
      if (listRes.ok && listBody.coaches) {
        setCoaches(listBody.coaches);
      }
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Unable to create coach."
      );
    } finally {
      setCreatingCoach(false);
    }
  }

  async function handleDeleteCoach(coach: CoachRow) {
    const label = coach.full_name?.trim() || coach.slug;
    if (
      !window.confirm(
        `Delete coach profile for "${label}"? This removes their account and related coach data. This cannot be undone.`
      )
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      setError("You must be signed in to delete a coach.");
      return;
    }

    setDeletingCoachId(coach.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coach.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to delete coach.");
      }
      setCoaches((prev) => prev.filter((c) => c.id !== coach.id));
    } catch (e) {
      setError((e as Error)?.message ?? "Unable to delete coach.");
    } finally {
      setDeletingCoachId(null);
    }
  }

  function renderColumnHeader(key: keyof CoachTableColumnVisibility) {
    if (key === "slug") {
      return <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">Slug</th>;
    }
    if (key === "joinDate") {
      return (
        <th className="sticky top-0 z-10 w-28 bg-slate-50 px-2 py-2">
          Join date
        </th>
      );
    }
    if (key === "memberFor") {
      return (
        <th className="sticky top-0 z-10 w-28 bg-slate-50 px-2 py-2">
          Member for
        </th>
      );
    }
    if (key === "goalLevel") {
      return <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Goal</th>;
    }
    if (key === "clients") {
      return (
        <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">
          Clients
        </th>
      );
    }
    if (key === "linkedinProfile") {
      return (
        <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">LinkedIn</th>
      );
    }
    if (key === "directory") {
      return (
        <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">
          Dir.
        </th>
      );
    }
    if (key === "certification") {
      return <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Cert.</th>;
    }
    if (key === "conference") {
      return <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Conf.</th>;
    }
    if (key === "currentLevel") {
      return (
        <th className="sticky top-0 z-10 w-24 max-w-[6.5rem] bg-slate-50 px-2 py-2">
          Current
        </th>
      );
    }
    if (key === "goalBy") {
      return <th className="sticky top-0 z-10 w-28 bg-slate-50 px-2 py-2">Goal by</th>;
    }
    if (key === "lastLogin") {
      return (
        <th className="sticky top-0 z-10 w-36 bg-slate-50 px-2 py-2">Last login</th>
      );
    }
    if (key === "crm") {
      return <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">CRM</th>;
    }
    if (key === "leadWebhook") {
      return (
        <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2">Lead webhook</th>
      );
    }
    if (key === "landing") {
      return (
        <th
          className="sticky top-0 z-10 w-10 bg-slate-50 px-1 py-2 text-center"
          aria-label="Landing"
        />
      );
    }
    return (
      <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center">View as</th>
    );
  }

  function renderColumnCell(
    key: keyof CoachTableColumnVisibility,
    coach: CoachRow,
    link: string,
    reportPreviewLink: string,
    crmLink: string | null
  ) {
    if (key === "slug") {
      return <td className="px-3 py-2 font-mono text-xs text-slate-500">{coach.slug}</td>;
    }
    if (key === "joinDate") {
      return (
        <td className="px-2 py-2 align-middle text-xs text-slate-700">
          {coach.joined_at ? (
            formatDateDisplay(new Date(coach.joined_at))
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      );
    }
    if (key === "memberFor") {
      return (
        <td className="px-2 py-2 align-middle text-xs text-slate-700">
          {coach.joined_at ? (
            (() => {
              const memberFor = formatMemberFor(coach.joined_at);
              return (
                <span
                  title={`Joined ${formatDateDisplay(new Date(coach.joined_at))} (${memberFor.totalDays} days)`}
                >
                  {memberFor.label}
                </span>
              );
            })()
          ) : (
            <span className="text-slate-400">Not set</span>
          )}
        </td>
      );
    }
    if (key === "goalLevel") {
      return (
        <td className="max-w-[7rem] px-2 py-2 align-middle">
          {coach.goal_monthly_income == null ? (
            <span className="text-xs text-slate-400">Not set</span>
          ) : (
            <span className="text-xs text-slate-700">
              {formatGbp(coach.goal_monthly_income)}
            </span>
          )}
        </td>
      );
    }
    if (key === "clients") {
      return (
        <td className="px-2 py-2 text-center align-middle text-sm text-slate-800">
          {coach.client_count > 0 ? (
            coach.client_count
          ) : (
            <span className="text-xs text-slate-400">Not set</span>
          )}
        </td>
      );
    }
    if (key === "linkedinProfile") {
      return (
        <td className="max-w-[14rem] px-2 py-2 align-middle text-xs">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => openCoachEditModal(coach)}
              className="block w-full truncate rounded px-1 py-0.5 text-left text-sky-700 hover:bg-slate-100 hover:underline"
              title={coach.linkedin_url ? "Edit LinkedIn URL" : "Set LinkedIn URL"}
            >
              {coach.linkedin_url ? coach.linkedin_url : "Not set"}
            </button>
            {coach.linkedin_url ? (
              <a
                href={coach.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 rounded p-1 text-sky-700 hover:bg-sky-50"
                title="Open LinkedIn profile"
                aria-label={`Open LinkedIn profile for ${coach.full_name ?? coach.slug}`}
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </td>
      );
    }
    if (key === "directory") {
      return (
        <td className="px-4 py-2 text-center">
          <input
            type="checkbox"
            title="Listed in public directory"
            checked={coach.directory_listed}
            disabled={directorySavingId === coach.id}
            onChange={(e) =>
              void patchCoachRow(coach.id, {
                directory_listed: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
        </td>
      );
    }
    if (key === "certification") {
      return (
        <td className="px-2 py-2 align-middle">
          <select
            title="Certification level (admin only)"
            value={coach.directory_level ?? ""}
            disabled={directorySavingId === coach.id}
            onChange={(e) => {
              const v = e.target.value;
              void patchCoachRow(coach.id, {
                directory_level: v === "" ? null : v,
              });
            }}
            className="max-w-full cursor-pointer border-0 border-b border-dotted border-slate-300 bg-transparent py-0.5 pl-0 pr-1 text-xs text-slate-800 shadow-none ring-0 hover:border-slate-500 focus:border-solid focus:border-sky-500 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Not set</option>
            <option value="certified">Certified</option>
            <option value="professional">Professional</option>
            <option value="elite">Elite</option>
          </select>
        </td>
      );
    }
    if (key === "conference") {
      return (
        <td className="px-2 py-2 align-middle">
          <select
            title="Conference attendance status"
            value={coach.conference_status ?? ""}
            disabled={directorySavingId === coach.id}
            onChange={(e) => {
              const v = e.target.value as "no" | "maybe" | "yes" | "";
              void patchCoachRow(coach.id, {
                conference_status: v === "" ? null : v,
              });
            }}
            className={`max-w-full cursor-pointer rounded px-1 py-0.5 text-xs font-medium shadow-none ring-0 hover:opacity-90 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${conferenceStatusClasses(
              coach.conference_status
            )}`}
          >
            <option value="">Not set</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
            <option value="yes">Yes</option>
          </select>
        </td>
      );
    }
    if (key === "currentLevel") {
      return (
        <td className="max-w-[6.5rem] px-2 py-2 align-middle">
          {coach.current_monthly_income == null ? (
            <span className="text-xs text-slate-400">Not set</span>
          ) : (
            <span className="text-xs text-slate-700">
              {formatGbp(coach.current_monthly_income)}
            </span>
          )}
        </td>
      );
    }
    if (key === "goalBy") {
      return (
        <td className="px-2 py-2 align-middle text-xs text-slate-700">
          {coach.ladder_goal_target_date ? (
            formatGoalDateDisplay(coach.ladder_goal_target_date)
          ) : (
            <span className="text-slate-400">Not set</span>
          )}
        </td>
      );
    }
    if (key === "lastLogin") {
      return (
        <td className="px-2 py-2 align-middle text-xs text-slate-700">
          {coach.last_login_at ? (
            formatLastLoginDisplay(coach.last_login_at)
          ) : (
            <span className="text-slate-400">Never</span>
          )}
        </td>
      );
    }
    if (key === "crm") {
      return (
        <td className="max-w-[16rem] px-2 py-2 align-middle">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => openCoachEditModal(coach)}
              className="block w-full rounded px-1 py-0.5 text-left hover:bg-slate-100"
              title="Edit CRM details"
            >
              {coach.crm_profile_name?.trim() ? (
                <span className="block truncate text-xs font-medium text-slate-700">
                  {coach.crm_profile_name}
                </span>
              ) : (
                <span className="block text-xs text-slate-400">Not set</span>
              )}
            </button>
            {crmLink ? (
              <a
                href={crmLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 rounded p-1 text-sky-700 hover:bg-sky-50"
                title="Open CRM"
                aria-label={`Open CRM for ${coach.full_name ?? coach.slug}`}
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </td>
      );
    }
    if (key === "leadWebhook") {
      return (
        <td className="max-w-[14rem] px-2 py-2 align-middle">
          <button
            type="button"
            onClick={() => openCoachEditModal(coach)}
            className="block w-full max-w-[14rem] truncate rounded px-1 py-0.5 text-left text-xs underline-offset-2 hover:bg-slate-100 hover:underline"
            title={
              coach.lead_webhook_url
                ? `Edit lead webhook (${coach.lead_webhook_url})`
                : "Set lead webhook URL"
            }
          >
            {coach.lead_webhook_url ? (
              <span className="text-slate-700">{coach.lead_webhook_url}</span>
            ) : (
              <span className="text-slate-400">Not set</span>
            )}
          </button>
        </td>
      );
    }
    if (key === "landing") {
      return (
        <td className="px-1 py-2 text-center align-middle">
          <div className="inline-flex items-center gap-1">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"
              title="Open landing page"
              aria-label={`Landing page for ${coach.slug}`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={reportPreviewLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"
              title="Open design-system report preview with mock prospect data"
              aria-label={`Report preview for ${coach.slug}`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </td>
      );
    }
    return (
      <td className="px-2 py-2 text-center align-middle">
        <button
          type="button"
          onClick={() => {
            setImpersonatingCoachId(coach.id);
            router.push("/coach");
          }}
          className="rounded px-2 py-1 text-xs text-slate-500 underline-offset-2 hover:bg-slate-100 hover:text-slate-800 hover:underline"
        >
          View as coach
        </button>
      </td>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        title="Coaches"
        tabs={<CoachesHubTabs />}
        actions={
          <button
            type="button"
            onClick={() => {
              setShowAddCoach(true);
              setCreateError(null);
              setCreateSuccess(null);
            }}
            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            + Add coach
          </button>
        }
      />

      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!checkingRole && !loading && coaches.length === 0 && !error ? (
        <p className="text-sm text-slate-600">
          No coaches found yet. Use the{" "}
          <span className="font-semibold">Add coach</span> button above
          to invite or create your first coach.
        </p>
      ) : null}

      {showAddCoach && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Add coach
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Create a coach account and either send them an invite
                email to set their own password, or set a password
                manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddCoach(false);
                setCreateError(null);
                setCreateSuccess(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>

          <form
            onSubmit={handleCreateCoach}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <div className="space-y-1">
              <label
                htmlFor="coachFullName"
                className="block text-xs font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="coachFullName"
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachBusinessName"
                className="block text-xs font-medium text-slate-700"
              >
                Coaching business name
              </label>
              <input
                id="coachBusinessName"
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachEmail"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="coachEmail"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="coachSlug"
                className="block text-xs font-medium text-slate-700"
              >
                Coach link slug
              </label>
              <input
                id="coachSlug"
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="e.g. alex-smith"
              />
              <p className="text-[0.7rem] text-slate-500">
                Their landing link will be e.g.{" "}
                <code>/landing/a?coach=alex-smith</code>. Use only lowercase
                letters, numbers, and hyphens.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                  />
                  <span>Send invite email so the coach sets their own password</span>
                </label>
              </div>
              {!sendInvite && (
                <div className="space-y-1 md:max-w-xs">
                  <label
                    htmlFor="coachPassword"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Temporary password
                  </label>
                  <input
                    id="coachPassword"
                    type="password"
                    required={!sendInvite}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <p className="text-[0.7rem] text-slate-500">
                    Share this password with the coach out of band. They
                    can change it later.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center md:justify-between">
              <div className="space-x-2">
                <button
                  type="submit"
                  disabled={creatingCoach}
                  className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
                >
                  {creatingCoach ? "Creating coach…" : "Create coach"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCoach(false);
                    setCreateError(null);
                    setCreateSuccess(null);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs">
                {createError && (
                  <p className="text-rose-600" role="alert">
                    {createError}
                  </p>
                )}
                {createSuccess && (
                  <p className="text-emerald-600" role="status">
                    {createSuccess}
                  </p>
                )}
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="coach-search"
                type="search"
                value={coachSearchTerm}
                onChange={(e) => setCoachSearchTerm(e.target.value)}
                placeholder="Search coaches"
                className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div ref={filtersMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={filtersMenuOpen}
                aria-controls="coach-filters-menu"
                onClick={() => {
                  setFiltersMenuOpen((open) => !open);
                  setSortMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                title="Filters"
                className={`relative inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${filtersMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              {filtersMenuOpen ? (
                <div
                  id="coach-filters-menu"
                  role="menu"
                  className="absolute left-0 z-[90] mt-1 w-[min(92vw,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="conference-filter" className="mb-1 block text-xs font-medium text-slate-600">
                        Coming to conference
                      </label>
                      <select
                        id="conference-filter"
                        value={conferenceFilter}
                        onChange={(e) => setConferenceFilter(e.target.value as ConferenceFilter)}
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="yes">Yes</option>
                        <option value="maybe">Maybe</option>
                        <option value="no">No</option>
                        <option value="not_set">Not set</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="last-login-filter" className="mb-1 block text-xs font-medium text-slate-600">
                        Last login filter
                      </label>
                      <select
                        id="last-login-filter"
                        value={lastLoginFilter}
                        onChange={(e) => setLastLoginFilter(e.target.value as LastLoginFilter)}
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="has_login">Has login</option>
                        <option value="never">Never logged in</option>
                        <option value="last_30_days">Last 30 days</option>
                        <option value="over_90_days">90+ days ago</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="crm-name-filter" className="mb-1 block text-xs font-medium text-slate-600">
                        CRM name
                      </label>
                      <select
                        id="crm-name-filter"
                        value={crmNameFilter}
                        onChange={(e) => setCrmNameFilter(e.target.value as CrmNameFilter)}
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All</option>
                        <option value="has_name">Has CRM name</option>
                        <option value="no_name">No CRM name</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={sortMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={sortMenuOpen}
                aria-controls="coach-sort-menu"
                onClick={() => {
                  setSortMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setColumnsMenuOpen(false);
                }}
                title="Sort"
                className={`inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${sortMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <ArrowUpDown className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
              {sortMenuOpen ? (
                <div
                  id="coach-sort-menu"
                  role="menu"
                  className="absolute left-0 z-[90] mt-1 w-[min(92vw,16rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <label htmlFor="last-login-sort" className="mb-1 block text-xs font-medium text-slate-600">
                    Last login sort
                  </label>
                  <select
                    id="last-login-sort"
                    value={lastLoginSort}
                    onChange={(e) => setLastLoginSort(e.target.value as LastLoginSort)}
                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="recent_first">Most recent first</option>
                    <option value="oldest_first">Oldest first</option>
                    <option value="never_first">Never logged in first</option>
                  </select>
                </div>
              ) : null}
            </div>

            <div ref={columnsMenuRef} className="relative">
              <button
                type="button"
                id="coach-columns-trigger"
                aria-haspopup="true"
                aria-expanded={columnsMenuOpen}
                aria-controls="coach-columns-menu"
                onClick={() => {
                  setColumnsMenuOpen((open) => !open);
                  setFiltersMenuOpen(false);
                  setSortMenuOpen(false);
                }}
                title="Columns"
                className={`inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${columnsMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
              >
                <Columns3 className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
              {columnsMenuOpen ? (
                <div
                  id="coach-columns-menu"
                  role="menu"
                  aria-labelledby="coach-columns-trigger"
                  className="absolute right-0 z-[90] mt-1 max-h-[min(24rem,70vh)] w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-2 shadow-lg"
                >
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shown
                  </p>
                  <ul className="space-y-0.5 px-2">
                    {shownColumnOptions.map(({ key, label }) => (
                      <li
                        key={key}
                        role="none"
                        draggable
                        onDragStart={(e) => {
                          setDraggingColumnKey(key);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedKey =
                            (e.dataTransfer.getData("text/plain") as keyof CoachTableColumnVisibility) ||
                            draggingColumnKey;
                          if (droppedKey) moveColumnInOrder(droppedKey, key);
                          setDraggingColumnKey(null);
                        }}
                        onDragEnd={() => setDraggingColumnKey(null)}
                        className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          <GripVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          <input
                            type="checkbox"
                            role="menuitemcheckbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={columnVisibility[key]}
                            onChange={(e) =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="my-2 border-t border-slate-200" />
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hidden
                  </p>
                  <ul className="space-y-0.5 px-2">
                    {hiddenColumnOptions.map(({ key, label }) => (
                      <li
                        key={key}
                        role="none"
                        draggable
                        onDragStart={(e) => {
                          setDraggingColumnKey(key);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", key);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedKey =
                            (e.dataTransfer.getData("text/plain") as keyof CoachTableColumnVisibility) ||
                            draggingColumnKey;
                          if (droppedKey) moveColumnInOrder(droppedKey, key);
                          setDraggingColumnKey(null);
                        }}
                        onDragEnd={() => setDraggingColumnKey(null)}
                        className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                          <GripVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          <input
                            type="checkbox"
                            role="menuitemcheckbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={columnVisibility[key]}
                            onChange={(e) =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-max min-w-max text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky top-0 z-10 w-14 bg-slate-50 px-2 py-2 text-center" aria-label="Avatar" />
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2">Coach</th>
              {orderedColumnOptions
                .filter(({ key }) => columnVisibility[key])
                .map(({ key }) => (
                  <Fragment key={key}>{renderColumnHeader(key)}</Fragment>
                ))}
              <th className="sticky top-0 z-10 bg-slate-50 px-2 py-2 text-center" aria-label="Delete" />
            </tr>
          </thead>
          <tbody>
            {filteredCoaches.map((coach) => {
              const link = origin
                ? `${origin}/landing/a?coach=${encodeURIComponent(coach.slug)}`
                : `/landing/a?coach=${encodeURIComponent(coach.slug)}`;
              const reportPreviewLink = origin
                ? `${origin}/preview/report-design-system?preview=1&score=74&coach=${encodeURIComponent(
                    coach.slug
                  )}&name=Alex%20Prospect&email=alex.prospect%40example.com&business=North%20Star%20Electrical`
                : `/preview/report-design-system?preview=1&score=74&coach=${encodeURIComponent(
                    coach.slug
                  )}&name=Alex%20Prospect&email=alex.prospect%40example.com&business=North%20Star%20Electrical`;
              const crmLink = coach.crm_location_id?.trim()
                ? `${CRM_LOCATION_BASE_URL}/${encodeURIComponent(
                    coach.crm_location_id
                  )}`
                : null;
              return (
                <tr
                  key={coach.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-2 py-2 align-middle">
                    {coach.avatar_url ? (
                      <img
                        src={coach.avatar_url}
                        alt=""
                        className="mx-auto h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200"
                        aria-hidden
                      >
                        —
                      </div>
                    )}
                  </td>
                  <td className="w-max whitespace-nowrap px-4 py-2 font-medium text-slate-900">
                    {coach.full_name ?? "—"}
                  </td>
                  {orderedColumnOptions
                    .filter(({ key }) => columnVisibility[key])
                    .map(({ key }) => (
                      <Fragment key={`${coach.id}-${key}`}>
                        {renderColumnCell(
                          key,
                          coach,
                          link,
                          reportPreviewLink,
                          crmLink
                        )}
                      </Fragment>
                    ))}
                  <td className="px-2 py-2 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCoach(coach)}
                      disabled={deletingCoachId === coach.id}
                      title={
                        deletingCoachId === coach.id
                          ? "Deleting coach…"
                          : `Delete coach ${coach.full_name ?? coach.slug}`
                      }
                      aria-label={
                        deletingCoachId === coach.id
                          ? "Deleting coach"
                          : `Delete coach ${coach.full_name ?? coach.slug}`
                      }
                      className="inline-flex rounded p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingCoachId === coach.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {loading && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  Loading coaches…
                </td>
              </tr>
            )}
            {!loading && !error && filteredCoaches.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  No coaches match that name.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>

      {webhookEditCoachId && (
        <div
          role="dialog"
          aria-modal
          aria-label="Edit coach details, CRM and lead webhook"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !webhookEditSaving) {
              setWebhookEditCoachId(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Coach details + CRM + lead webhook
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Admin only. The coach does not see this field. Profit Coach POSTs
              prospect contact info here as soon as we have an email, and again
              with the BOSS score when the assessment finishes.
            </p>
            <label
              htmlFor="coach-full-name"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              Coach full name
            </label>
            <input
              id="coach-full-name"
              type="text"
              value={coachFullNameValue}
              onChange={(e) => setCoachFullNameValue(e.target.value)}
              placeholder="Alex Smith"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <label
              htmlFor="coach-business-name"
              className="mt-3 block text-xs font-medium text-slate-700"
            >
              Coaching business name
            </label>
            <input
              id="coach-business-name"
              type="text"
              value={coachBusinessNameValue}
              onChange={(e) => setCoachBusinessNameValue(e.target.value)}
              placeholder="North Star Coaching"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <label
              htmlFor="coach-linkedin-url"
              className="mt-3 block text-xs font-medium text-slate-700"
            >
              LinkedIn profile URL
            </label>
            <input
              id="coach-linkedin-url"
              type="url"
              value={coachLinkedinUrlValue}
              onChange={(e) => setCoachLinkedinUrlValue(e.target.value)}
              placeholder="https://www.linkedin.com/in/example"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <label
              htmlFor="crm-profile-name"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              CRM profile name
            </label>
            <input
              id="crm-profile-name"
              type="text"
              value={crmProfileNameValue}
              onChange={(e) => setCrmProfileNameValue(e.target.value)}
              placeholder="AMF Consulting"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <label
              htmlFor="crm-location-id"
              className="mt-3 block text-xs font-medium text-slate-700"
            >
              CRM location ID
            </label>
            <input
              id="crm-location-id"
              type="text"
              value={crmLocationIdValue}
              onChange={(e) => setCrmLocationIdValue(e.target.value)}
              placeholder="BsRxKtV0lVHcvvZ6qHtu"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Coach CRM link is built as{" "}
              <code>{CRM_LOCATION_BASE_URL}/&lt;location-id&gt;</code>.
            </p>
            <label
              htmlFor="lead-webhook-url"
              className="mt-4 block text-xs font-medium text-slate-700"
            >
              Lead webhook URL
            </label>
            <input
              id="lead-webhook-url"
              type="url"
              value={webhookEditValue}
              onChange={(e) => setWebhookEditValue(e.target.value)}
              placeholder="https://hooks.example.com/coach-leads"
              disabled={webhookEditSaving}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            />
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Leave blank to disable. Must start with <code>http://</code> or{" "}
              <code>https://</code>.
            </p>
            {webhookEditError ? (
              <p className="mt-2 text-xs text-rose-600" role="alert">
                {webhookEditError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!webhookEditSaving) setWebhookEditCoachId(null);
                }}
                disabled={webhookEditSaving}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!webhookEditCoachId) return;
                  const trimmed = webhookEditValue.trim();
                  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                    setWebhookEditError(
                      "URL must start with http:// or https://."
                    );
                    return;
                  }
                  const trimmedLinkedinUrl = coachLinkedinUrlValue.trim();
                  if (trimmedLinkedinUrl && !/^https?:\/\//i.test(trimmedLinkedinUrl)) {
                    setWebhookEditError(
                      "LinkedIn URL must start with http:// or https://."
                    );
                    return;
                  }
                  setWebhookEditError(null);
                  setWebhookEditSaving(true);
                  const trimmedProfileName = crmProfileNameValue.trim();
                  const trimmedLocationId = crmLocationIdValue.trim();
                  const trimmedFullName = coachFullNameValue.trim();
                  const trimmedBusinessName = coachBusinessNameValue.trim();
                  const result = await patchCoachRow(webhookEditCoachId, {
                    full_name: trimmedFullName === "" ? null : trimmedFullName,
                    coach_business_name:
                      trimmedBusinessName === "" ? null : trimmedBusinessName,
                    linkedin_url:
                      trimmedLinkedinUrl === "" ? null : trimmedLinkedinUrl,
                    crm_profile_name:
                      trimmedProfileName === "" ? null : trimmedProfileName,
                    crm_location_id:
                      trimmedLocationId === "" ? null : trimmedLocationId,
                    lead_webhook_url: trimmed === "" ? null : trimmed,
                  });
                  setWebhookEditSaving(false);
                  if (result.ok) {
                    setWebhookEditCoachId(null);
                  } else {
                    setWebhookEditError(result.error);
                  }
                }}
                disabled={webhookEditSaving}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60"
              >
                {webhookEditSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

