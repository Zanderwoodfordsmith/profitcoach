"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  MapPin,
  Minus,
  Plus,
  Star,
  User,
  X,
} from "lucide-react";

import styles from "@/app/ladder/ladder.module.css";
import {
  deriveCurrentLevelId,
  deriveNextLevelId,
  getLadderLevel,
  iconForKind,
  LADDER_LEVELS,
  LADDER_PHASE_UI,
  type CommunityLadderEventDTO,
  type LadderPhaseKey,
  type LadderAchievementDTO,
  type LadderLevelConfig,
} from "@/lib/ladder";
import {
  defaultMonthlyIncomeForLevelId,
  formatWeeksInterval,
  monthlyIncomeToLadderLevelId,
  parseMoneyInput,
  signClientEveryWeeks,
} from "@/lib/ladderIncomeGoal";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const PAGE_SIZE = 50;
const stylesMap = styles as Record<string, string>;

/** Collapsible ladder phases: onramp open by default; Promotion / Proof / Prestige start closed */
const INITIAL_PHASE_OPEN: Record<LadderPhaseKey, boolean> = {
  onramp: true,
  metals: true,
  gemstones: false,
  diamonds: false,
};

function coachDisplayName(p: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const n =
    p.full_name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return n || "Coach";
}

function eventDisplayName(e: CommunityLadderEventDTO): string {
  return coachDisplayName(e);
}

function isHiddenLevelUpEvent(e: CommunityLadderEventDTO): boolean {
  const full = (e.full_name ?? "").toLowerCase();
  const first = (e.first_name ?? "").toLowerCase();
  const last = (e.last_name ?? "").toLowerCase();
  return (
    (first.includes("laur") && last.includes("shak")) ||
    (full.includes("laur") && full.includes("shak"))
  );
}

/**
 * Collapse consecutive same-user level-ups so "tick earlier steps" bursts only
 * show the latest/highest row for that coach in the recent feed.
 */
function collapseConsecutiveFeedEvents(
  rows: CommunityLadderEventDTO[]
): CommunityLadderEventDTO[] {
  const out: CommunityLadderEventDTO[] = [];
  let lastUserId: string | null = null;
  for (const row of rows) {
    if (row.user_id === lastUserId) continue;
    out.push(row);
    lastUserId = row.user_id;
  }
  return out;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseClientCountInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function clientsToBronzeLevelId(clients: number): LadderLevelConfig["id"] | null {
  if (!Number.isFinite(clients) || clients < 1) return null;
  if (clients >= 3) return "bronze_iii";
  if (clients >= 2) return "bronze_ii";
  return "bronze_i";
}

const GOAL_DATE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** e.g. `3 May` this year, `3 May 2027` otherwise */
function formatGoalDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const currentY = new Date().getFullYear();
  const day = d.getDate();
  const mon = GOAL_DATE_MONTHS[d.getMonth()] ?? "";
  if (y === currentY) return `${day} ${mon}`;
  return `${day} ${mon} ${y}`;
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled) return;
  try {
    input.showPicker();
  } catch {
    input.focus();
    input.click();
  }
}

type DatePromptState = {
  level: LadderLevelConfig;
  step: "choice" | "pick";
  /** Earlier levels to mark with the same date (ascending); empty = only `level` */
  fillGaps: LadderLevelConfig[];
};

export default function CoachCommunityLadderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();

  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [achievements, setAchievements] = useState<LadderAchievementDTO[]>([]);
  const [ladderGoalLevel, setLadderGoalLevel] = useState<string | null>(null);
  const [ladderGoalTargetDate, setLadderGoalTargetDate] = useState<
    string | null
  >(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showLadderLevelOnProfile, setShowLadderLevelOnProfile] =
    useState(false);

  const [savingLevelId, setSavingLevelId] = useState<string | null>(null);
  const [savingGoalDate, setSavingGoalDate] = useState(false);
  const [datePrompt, setDatePrompt] = useState<DatePromptState | null>(null);
  const [pickDateValue, setPickDateValue] = useState("");
  const [gapPrompt, setGapPrompt] = useState<{
    level: LadderLevelConfig;
    missing: LadderLevelConfig[];
  } | null>(null);

  const [feedEvents, setFeedEvents] = useState<CommunityLadderEventDTO[]>([]);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [phaseOpen, setPhaseOpen] =
    useState<Record<LadderPhaseKey, boolean>>(INITIAL_PHASE_OPEN);

  const [incomeCurrency, setIncomeCurrency] = useState<"GBP" | "USD">("GBP");
  const [currentMonthlyIncomeRaw, setCurrentMonthlyIncomeRaw] = useState("");
  const [currentClientsRaw, setCurrentClientsRaw] = useState("");
  const [monthlyIncomeRaw, setMonthlyIncomeRaw] = useState("");
  const [perClientMonthlyRaw, setPerClientMonthlyRaw] = useState("2000");

  const goalDateInputRef = useRef<HTMLInputElement>(null);
  const seededIncomeFromGoal = useRef(false);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;

    const roleRes = await fetch("/api/profile-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const roleBody = (await roleRes.json().catch(() => ({}))) as {
      role?: string;
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    const onAdminSignature = pathname?.startsWith("/admin/signature") ?? false;
    if (roleBody.role === "admin" && impersonatingCoachId && !onAdminSignature) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  }, [impersonatingCoachId, pathname]);

  const loadMain = useCallback(async () => {
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.user?.id) {
      router.replace("/login");
      return;
    }

    const roleRes = await fetch("/api/profile-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const roleBody = (await roleRes.json().catch(() => ({}))) as {
      role?: string;
    };
    const onAdminSignature =
      pathname?.startsWith("/admin/signature") ?? false;
    if (
      roleBody.role === "admin" &&
      !impersonatingCoachId &&
      !onAdminSignature
    ) {
      router.replace("/admin");
      return;
    }

    const res = await fetch(
      `/api/coach/ladder?eventsLimit=${PAGE_SIZE}&eventsOffset=0&kind=level_up`,
      { headers }
    );
    if (!res.ok) {
      setError("Could not load ladder data.");
      setLoading(false);
      return;
    }

    const body = (await res.json()) as {
      achievements: LadderAchievementDTO[];
      ladder_goal_level: string | null;
      ladder_goal_target_date: string | null;
      show_ladder_level_on_profile?: boolean;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      events: CommunityLadderEventDTO[];
      hasMore: boolean;
      migrationNeeded?: boolean;
    };

    setAchievements(body.achievements ?? []);
    setLadderGoalLevel(body.ladder_goal_level);
    setLadderGoalTargetDate(body.ladder_goal_target_date);
    setShowLadderLevelOnProfile(!!body.show_ladder_level_on_profile);
    setFullName(body.full_name);
    setFirstName(body.first_name);
    setLastName(body.last_name);
    setAvatarUrl(body.avatar_url);
    setFeedEvents(body.events ?? []);
    setFeedHasMore(body.hasMore ?? false);
    setMigrationNeeded(!!body.migrationNeeded);
    setLoading(false);
  }, [authHeaders, impersonatingCoachId, pathname, router]);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  const loadMoreFeed = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    setFeedLoading(true);
    try {
      const offset = feedEvents.length;
      const res = await fetch(
        `/api/coach/ladder?eventsLimit=${PAGE_SIZE}&eventsOffset=${offset}&kind=level_up`,
        { headers }
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        events: CommunityLadderEventDTO[];
        hasMore: boolean;
      };
      setFeedEvents((prev) => [...prev, ...(body.events ?? [])]);
      setFeedHasMore(body.hasMore ?? false);
    } finally {
      setFeedLoading(false);
    }
  }, [authHeaders, feedEvents.length]);

  const achievementByLevel = useMemo(() => {
    const map = new Map<string, LadderAchievementDTO>();
    for (const a of achievements) map.set(a.level_id, a);
    return map;
  }, [achievements]);

  const currentLevelId = useMemo(
    () => deriveCurrentLevelId(achievements),
    [achievements]
  );
  const nextLevelId = useMemo(
    () => deriveNextLevelId(achievements),
    [achievements]
  );
  const currentMeta = useMemo(
    () => getLadderLevel(currentLevelId),
    [currentLevelId]
  );
  const visibleFeedEvents = useMemo(
    () =>
      collapseConsecutiveFeedEvents(
        feedEvents.filter((event) => !isHiddenLevelUpEvent(event))
      ),
    [feedEvents]
  );

  const incomeParsed = useMemo(
    () => parseMoneyInput(monthlyIncomeRaw),
    [monthlyIncomeRaw]
  );
  const currentIncomeParsed = useMemo(
    () => parseMoneyInput(currentMonthlyIncomeRaw),
    [currentMonthlyIncomeRaw]
  );
  const incomeHighlightLevelId = useMemo(() => {
    if (incomeParsed === null || incomeParsed < 5_000) return null;
    return monthlyIncomeToLadderLevelId(incomeParsed);
  }, [incomeParsed]);
  const currentIncomeTierId = useMemo(() => {
    if (currentIncomeParsed === null || currentIncomeParsed < 5_000) {
      return null;
    }
    return monthlyIncomeToLadderLevelId(currentIncomeParsed);
  }, [currentIncomeParsed]);
  const currentClientsParsed = useMemo(
    () => parseClientCountInput(currentClientsRaw),
    [currentClientsRaw]
  );
  const currentBronzeTierId = useMemo(() => {
    if (currentClientsParsed === null) return null;
    return clientsToBronzeLevelId(currentClientsParsed);
  }, [currentClientsParsed]);
  const currentEstimatedTierId = currentIncomeTierId ?? currentBronzeTierId;

  const perClientParsed = useMemo(
    () => parseMoneyInput(perClientMonthlyRaw),
    [perClientMonthlyRaw]
  );

  const idealClientCount = useMemo(() => {
    if (incomeParsed === null || incomeParsed <= 0) return null;
    if (perClientParsed === null || perClientParsed <= 0) return null;
    return Math.max(1, Math.round(incomeParsed / perClientParsed));
  }, [incomeParsed, perClientParsed]);
  const closeRateCallScenarios = useMemo(
    () => [
      {
        label: "17%",
        calls: idealClientCount === null ? null : idealClientCount * 6,
      },
      {
        label: "25%",
        calls: idealClientCount === null ? null : idealClientCount * 4,
      },
      {
        label: "33%",
        calls: idealClientCount === null ? null : idealClientCount * 3,
      },
    ],
    [idealClientCount]
  );

  const currencySymbol = incomeCurrency === "GBP" ? "£" : "$";

  useEffect(() => {
    if (loading || seededIncomeFromGoal.current) return;
    const def = defaultMonthlyIncomeForLevelId(ladderGoalLevel);
    if (def !== null) {
      setMonthlyIncomeRaw(String(def));
    }
    seededIncomeFromGoal.current = true;
  }, [loading, ladderGoalLevel]);

  async function patchAPI(body: unknown): Promise<boolean> {
    const headers = await authHeaders();
    if (!headers) {
      router.replace("/login");
      return false;
    }
    const res = await fetch("/api/coach/ladder", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Could not save.");
      return false;
    }
    return true;
  }

  const patchAPIRef = useRef(patchAPI);
  patchAPIRef.current = patchAPI;

  async function unmarkLevel(level: LadderLevelConfig) {
    if (savingLevelId) return;
    setSavingLevelId(level.id);
    setError(null);
    try {
      const ok = await patchAPI({ unmark_achieved: { level_id: level.id } });
      if (ok) await loadMain();
    } finally {
      setSavingLevelId(null);
    }
  }

  async function markLevelWithGaps(
    level: LadderLevelConfig,
    achievedOn: string | null,
    fillGaps: LadderLevelConfig[]
  ) {
    if (savingLevelId) return;
    setSavingLevelId(level.id);
    setError(null);
    try {
      const sortedGaps = [...fillGaps].sort((a, b) => a.ordinal - b.ordinal);
      for (const g of sortedGaps) {
        const body =
          achievedOn === null
            ? {
                mark_achieved: {
                  level_id: g.id,
                  achieved_on: null,
                },
              }
            : {
                mark_achieved: {
                  level_id: g.id,
                  achieved_on: achievedOn,
                },
              };
        const ok = await patchAPI(body);
        if (!ok) return;
      }
      const body =
        achievedOn === null
          ? {
              mark_achieved: {
                level_id: level.id,
                achieved_on: null,
              },
            }
          : {
              mark_achieved: {
                level_id: level.id,
                achieved_on: achievedOn,
              },
            };
      const ok = await patchAPI(body);
      if (ok) await loadMain();
    } finally {
      setSavingLevelId(null);
      setDatePrompt(null);
    }
  }

  function openTickFlow(
    level: LadderLevelConfig,
    fillGaps: LadderLevelConfig[] = []
  ) {
    setPickDateValue(todayIso());
    setDatePrompt({ level, step: "choice", fillGaps });
  }

  function onCheckboxActivate(level: LadderLevelConfig) {
    if (migrationNeeded) return;
    if (achievementByLevel.has(level.id)) {
      void unmarkLevel(level);
    } else {
      const missing = LADDER_LEVELS.filter(
        (l) => l.ordinal < level.ordinal && !achievementByLevel.has(l.id)
      ).sort((a, b) => a.ordinal - b.ordinal);
      if (missing.length > 0) {
        setGapPrompt({ level, missing });
      } else {
        openTickFlow(level, []);
      }
    }
  }

  const setGoalLevel = useCallback(async (levelId: string | null) => {
    setError(null);
    const ok = await patchAPIRef.current({ ladder_goal_level: levelId });
    if (ok) {
      setLadderGoalLevel(levelId);
      if (!levelId) {
        const ok2 = await patchAPIRef.current({
          ladder_goal_target_date: null,
        });
        if (ok2) setLadderGoalTargetDate(null);
      }
    }
  }, []);

  useEffect(() => {
    if (loading || migrationNeeded) return;
    const mapped = incomeHighlightLevelId;
    if (mapped === null) return;
    if (mapped === ladderGoalLevel) return;
    const t = setTimeout(() => {
      void setGoalLevel(mapped);
    }, 450);
    return () => clearTimeout(t);
  }, [
    incomeHighlightLevelId,
    ladderGoalLevel,
    loading,
    migrationNeeded,
    setGoalLevel,
  ]);

  async function setGoalDate(iso: string | null) {
    setSavingGoalDate(true);
    setError(null);
    try {
      const ok = await patchAPI({ ladder_goal_target_date: iso });
      if (ok) setLadderGoalTargetDate(iso);
    } finally {
      setSavingGoalDate(false);
    }
  }

  async function setProfileLevelVisibility(nextValue: boolean) {
    setError(null);
    const prev = showLadderLevelOnProfile;
    setShowLadderLevelOnProfile(nextValue);
    const ok = await patchAPI({
      show_ladder_level_on_profile: nextValue,
    });
    if (!ok) {
      setShowLadderLevelOnProfile(prev);
    }
  }

  function renderLevelRow(level: LadderLevelConfig) {
    const levelCls = stylesMap[level.cssLevelClass] ?? "";
    const achieved = achievementByLevel.has(level.id);
    const isGoal = ladderGoalLevel === level.id;
    const isCurrent = currentLevelId === level.id;
    const isNext = nextLevelId === level.id && !achieved;
    const icon = iconForKind(level.iconKind);
    const saving = savingLevelId === level.id;
    const incomeMatch = incomeHighlightLevelId === level.id;

    const ringCls = isCurrent
      ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-100"
      : incomeMatch
        ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-100"
        : isGoal
          ? "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-100 ring-dashed"
          : "";

    const incompleteRow = !achieved;

    return (
      <div
        key={level.id}
        className={`rounded-2xl transition-shadow ${ringCls}`}
      >
        <div
          className={[
            styles.level,
            levelCls,
            "!grid !grid-cols-[auto_minmax(0,1fr)_8.25rem_auto] !items-center !gap-x-3 !rounded-2xl !px-4 !py-3 sm:!grid-cols-[auto_minmax(0,1fr)_9.25rem_auto]",
            "transition-[opacity,filter]",
            incompleteRow
              ? "opacity-[0.88] saturate-[0.88]"
              : "opacity-100 saturate-100",
          ].join(" ")}
        >
          <div
            className={`${styles.levelIcon} !m-0 !mr-0 !h-10 !w-10 !text-[1.125rem]`}
          >
            {icon}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`${styles.levelName} !flex-none`}>
              {level.name}
            </span>
            {isCurrent ? (
              <MapPin
                className="h-4 w-4 shrink-0 text-sky-600"
                strokeWidth={2.5}
                aria-label="Your current ceiling"
              />
            ) : null}
            {isNext ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                Next
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5">
            {isGoal ? (
              <Star
                className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500 sm:h-[1.125rem] sm:w-[1.125rem]"
                aria-label="Your goal level"
              />
            ) : null}
            <span className="text-right text-[0.95rem] font-medium tabular-nums leading-none text-slate-500 sm:text-[1.05rem]">
              {level.amountText}
            </span>
          </div>

          <div className={styles.levelClients}>{level.clientsText}</div>

          <div className="flex items-center justify-self-end">
            <button
              type="button"
              role="checkbox"
              aria-checked={achieved}
              disabled={saving || migrationNeeded}
              onClick={() => onCheckboxActivate(level)}
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                achieved
                  ? "border-emerald-600 bg-emerald-500 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-300 hover:border-slate-400 hover:text-slate-400",
              ].join(" ")}
              title={
                achieved ? "Clear this step" : "Mark this step as done"
              }
            >
              <Check
                className={achieved ? "h-4 w-4" : "h-3.5 w-3.5"}
                strokeWidth={achieved ? 3 : 2}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  const promptLevel = datePrompt?.level;
  const fillGaps = datePrompt?.fillGaps ?? [];

  return (
    <div className="pt-4">
      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {migrationNeeded ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ladder tracking will be available after the latest database migration
          is applied.
        </p>
      ) : null}

      {gapPrompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ladder-gap-prompt-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGapPrompt(null);
          }}
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <button
              type="button"
              onClick={() => setGapPrompt(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h2
              id="ladder-gap-prompt-title"
              className="pr-8 text-base font-semibold text-slate-900"
            >
              Earlier steps aren&apos;t checked
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;re marking{" "}
              <span className="font-semibold text-slate-800">
                {gapPrompt.level.name}
              </span>
              , but{" "}
              {gapPrompt.missing.length === 1 ? (
                <>
                  <span className="font-semibold text-slate-800">
                    {gapPrompt.missing[0].name}
                  </span>{" "}
                  isn&apos;t checked yet
                </>
              ) : (
                <>
                  {gapPrompt.missing.length} earlier steps on the ladder
                  aren&apos;t checked yet (
                  {gapPrompt.missing.map((m) => m.name).join(", ")})
                </>
              )}
              . Add those steps too (you&apos;ll set the date on the next
              screen), or mark only this one?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const { level, missing } = gapPrompt;
                  setGapPrompt(null);
                  openTickFlow(level, missing);
                }}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Add earlier steps
              </button>
              <button
                type="button"
                onClick={() => {
                  const { level } = gapPrompt;
                  setGapPrompt(null);
                  openTickFlow(level, []);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Only {gapPrompt.level.name}
              </button>
              <button
                type="button"
                onClick={() => setGapPrompt(null)}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {datePrompt && promptLevel ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ladder-date-prompt-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDatePrompt(null);
          }}
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <button
              type="button"
              onClick={() => setDatePrompt(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h2
              id="ladder-date-prompt-title"
              className="pr-8 text-base font-semibold text-slate-900"
            >
              {promptLevel.name}
            </h2>
            {fillGaps.length > 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Same date will apply to {fillGaps.length} earlier step
                {fillGaps.length === 1 ? "" : "s"} you chose to include.
              </p>
            ) : null}
            {datePrompt.step === "choice" ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  When did you reach this step? Optional — add a date for
                  marketing and milestones, or skip.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={!!savingLevelId}
                    onClick={() =>
                      void markLevelWithGaps(
                        promptLevel,
                        todayIso(),
                        fillGaps
                      )
                    }
                    className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    disabled={!!savingLevelId}
                    onClick={() =>
                      setDatePrompt({
                        level: promptLevel,
                        step: "pick",
                        fillGaps,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Choose a different date…
                  </button>
                  <button
                    type="button"
                    disabled={!!savingLevelId}
                    onClick={() =>
                      void markLevelWithGaps(promptLevel, null, fillGaps)
                    }
                    className="w-full rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                  >
                    No date
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Pick the date you hit this step.
                </p>
                <input
                  type="date"
                  value={pickDateValue}
                  onChange={(e) => setPickDateValue(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={!!savingLevelId}
                    onClick={() =>
                      setDatePrompt({
                        level: promptLevel,
                        step: "choice",
                        fillGaps,
                      })
                    }
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!!savingLevelId || !pickDateValue}
                    onClick={() =>
                      void markLevelWithGaps(
                        promptLevel,
                        pickDateValue,
                        fillGaps
                      )
                    }
                    className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="min-w-0">
          <div className={`${styles.root} !min-h-0 !bg-transparent !py-0`}>
            <div className={`${styles.container} !max-w-none !w-full`}>
              {LADDER_PHASE_UI.map((phase) => {
                const open = phaseOpen[phase.key];
                const panelId = `ladder-phase-${phase.key}`;
                const btnId = `ladder-phase-${phase.key}-btn`;
                return (
                  <div
                    key={phase.key}
                    className={`${styles.phase} ${stylesMap[phase.cssPhaseClass] ?? ""}`}
                  >
                    <button
                      type="button"
                      id={btnId}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() =>
                        setPhaseOpen((prev) => ({
                          ...prev,
                          [phase.key]: !prev[phase.key],
                        }))
                      }
                      className={`${styles.phaseHeader} -ml-1 w-full max-w-full cursor-pointer rounded-lg border border-transparent px-1 py-0.5 text-left transition-colors hover:border-slate-200/80 hover:bg-slate-50/90`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm"
                        aria-hidden
                      >
                        {open ? (
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        ) : (
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        )}
                      </span>
                      <span className={styles.phaseName}>{phase.label}</span>
                      <div className={styles.phaseLine} />
                      {phase.jumpLabel ? (
                        <span className={styles.phaseJump}>
                          {phase.jumpLabel}
                        </span>
                      ) : null}
                    </button>
                    {open ? (
                      <div id={panelId} role="region" aria-labelledby={btnId}>
                        {LADDER_LEVELS.filter((l) => l.phase === phase.key).map(
                          (level) => renderLevelRow(level)
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent ladder level-ups
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Celebrating coaches who leveled up.
            </p>

            {visibleFeedEvents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No level-ups recorded yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {visibleFeedEvents.map((ev) => {
                  const lvl = getLadderLevel(ev.to_level);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-center gap-3 py-3 first:pt-0"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${lvl?.chipClassName ?? "border border-slate-200 bg-slate-50"}`}
                      >
                        {lvl?.ordinal ?? "—"}
                      </div>
                      <div className="relative h-10 w-10 shrink-0">
                        {ev.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ev.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 text-slate-400">
                            <User className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">
                          {eventDisplayName(ev)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {lvl?.name ?? ev.to_level} ·{" "}
                          {new Date(ev.created_at).toLocaleDateString(
                            undefined,
                            { dateStyle: "medium" }
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {feedHasMore ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={feedLoading}
                  onClick={() => void loadMoreFeed()}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  {feedLoading ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 w-full lg:sticky lg:top-4 lg:w-full lg:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left lg:flex-col lg:items-center lg:text-center">
              <div className="relative h-20 w-20 shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-200 text-slate-400">
                    <User className="h-9 w-9" />
                  </div>
                )}
                {showLadderLevelOnProfile && currentMeta ? (
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold tabular-nums shadow-md ring-2 ring-white ${currentMeta.chipClassName}`}
                  >
                    {currentMeta.ordinal}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 min-w-0 sm:ml-4 sm:mt-0 lg:ml-0 lg:mt-4">
                <p className="truncate text-base font-semibold text-slate-900">
                  {coachDisplayName({
                    full_name: fullName,
                    first_name: firstName,
                    last_name: lastName,
                  })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  <span className="font-medium text-sky-700">
                    {currentMeta ? currentMeta.name : "No level ticked yet"}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5 text-left">
              <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showLadderLevelOnProfile}
                  onChange={(e) =>
                    void setProfileLevelVisibility(e.target.checked)
                  }
                  disabled={migrationNeeded}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-45"
                />
                <span>Show my ladder number on my profile</span>
              </label>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Monthly income
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Currency
                </span>
                <div
                  className="inline-flex rounded-full border border-slate-200 p-0.5"
                  role="group"
                  aria-label="Income currency"
                >
                  <button
                    type="button"
                    disabled={migrationNeeded}
                    onClick={() => setIncomeCurrency("GBP")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      incomeCurrency === "GBP"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    £
                  </button>
                  <button
                    type="button"
                    disabled={migrationNeeded}
                    onClick={() => setIncomeCurrency("USD")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      incomeCurrency === "USD"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    $
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex min-w-0 items-end gap-2">
                <span className="w-14 shrink-0 pb-1 text-xs font-semibold text-slate-800">
                  Current
                </span>
                <div className="flex min-w-0 flex-1 items-end gap-1.5 border-b border-slate-200 pb-1 focus-within:border-sky-500">
                  <span
                    className="pb-0.5 text-base font-semibold leading-none tabular-nums text-slate-600"
                    aria-hidden
                  >
                    {currencySymbol}
                  </span>
                  <label htmlFor="ladder-current-monthly-income" className="sr-only">
                    Current monthly income (optional)
                  </label>
                  <input
                    id="ladder-current-monthly-income"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 12000"
                    value={currentMonthlyIncomeRaw}
                    onChange={(e) => setCurrentMonthlyIncomeRaw(e.target.value)}
                    disabled={migrationNeeded}
                    className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm font-medium tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 disabled:opacity-45"
                  />
                </div>
              </div>
              <div className="mt-2.5 flex min-w-0 items-end gap-2">
                <span className="w-14 shrink-0 pb-1 text-xs font-semibold text-slate-800">
                  Clients
                </span>
                <div className="flex min-w-0 flex-1 items-end gap-1.5 border-b border-slate-200 pb-1 focus-within:border-sky-500">
                  <label htmlFor="ladder-current-clients" className="sr-only">
                    Current number of clients
                  </label>
                  <input
                    id="ladder-current-clients"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 2"
                    value={currentClientsRaw}
                    onChange={(e) => setCurrentClientsRaw(e.target.value)}
                    disabled={migrationNeeded}
                    className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm font-medium tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 disabled:opacity-45"
                  />
                </div>
              </div>
              {currentEstimatedTierId ? (
                <p className="mt-1 pl-[3.25rem] text-[11px] text-slate-600">
                  ~{" "}
                  <span className="font-medium text-slate-800">
                    {getLadderLevel(currentEstimatedTierId)?.name}
                  </span>{" "}
                  band
                </p>
              ) : null}

              <div className="mt-2.5 flex min-w-0 flex-wrap items-end gap-2">
                <span className="w-14 shrink-0 pb-1 text-xs font-semibold text-slate-800">
                  Ideal
                </span>
                <div className="flex min-w-0 flex-1 items-end gap-1.5 border-b border-slate-200 pb-1 focus-within:border-sky-500">
                  <span
                    className="pb-0.5 text-base font-semibold leading-none tabular-nums text-slate-600"
                    aria-hidden
                  >
                    {currencySymbol}
                  </span>
                  <label htmlFor="ladder-monthly-income" className="sr-only">
                    Ideal monthly income
                  </label>
                  <input
                    id="ladder-monthly-income"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 20000"
                    value={monthlyIncomeRaw}
                    onChange={(e) => setMonthlyIncomeRaw(e.target.value)}
                    disabled={migrationNeeded}
                    className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm font-medium tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 disabled:opacity-45"
                  />
                </div>
                <div className="relative w-max max-w-[min(100%,11rem)] shrink-0">
                  <div
                    className={`border-b border-slate-200 text-left transition-[border-color] focus-within:border-sky-500 ${
                      migrationNeeded ||
                      savingGoalDate ||
                      !(ladderGoalLevel || incomeHighlightLevelId)
                        ? "cursor-not-allowed opacity-45"
                        : "hover:border-slate-300"
                    }`}
                  >
                    <input
                      ref={goalDateInputRef}
                      id="ladder-goal-target-date"
                      type="date"
                      value={ladderGoalTargetDate ?? ""}
                      onChange={(e) =>
                        void setGoalDate(e.target.value ? e.target.value : null)
                      }
                      disabled={
                        migrationNeeded ||
                        savingGoalDate ||
                        !(ladderGoalLevel || incomeHighlightLevelId)
                      }
                      tabIndex={-1}
                      aria-hidden
                      className="sr-only"
                    />
                    <button
                      type="button"
                      disabled={
                        migrationNeeded ||
                        savingGoalDate ||
                        !(ladderGoalLevel || incomeHighlightLevelId)
                      }
                      aria-label={
                        ladderGoalTargetDate
                          ? `Ideal target date, ${formatGoalDate(ladderGoalTargetDate)}. Open calendar.`
                          : "Ideal target date (optional). Open calendar."
                      }
                      onClick={() => openDatePicker(goalDateInputRef.current)}
                      className="w-full border-0 bg-transparent px-0.5 py-1.5 text-left text-sm font-medium tabular-nums text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
                    >
                      {ladderGoalTargetDate ? (
                        formatGoalDate(ladderGoalTargetDate)
                      ) : (
                        <span className="font-normal text-slate-400">
                          Date (optional)
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {incomeHighlightLevelId ? (
                <p className="mt-3 text-xs font-medium text-violet-800">
                  Ideal ladder match:{" "}
                  <span className="text-violet-950">
                    {getLadderLevel(incomeHighlightLevelId)?.name}
                  </span>
                </p>
              ) : incomeParsed !== null &&
                incomeParsed > 0 &&
                incomeParsed < 5_000 ? (
                <p className="mt-3 text-xs text-amber-900">
                  Income tiers start at 5,000/mo (Silver). Bronze steps are
                  about client count on the ladder.
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/90 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  What It Takes
                </h3>
                <p className="mt-2 flex items-baseline gap-1 text-sm leading-relaxed text-slate-800">
                  <span className="font-semibold tabular-nums">
                    {idealClientCount ?? "—"}{" "}
                    {idealClientCount === 1 ? "client" : "clients"} at
                  </span>
                  <span className="inline-flex items-baseline gap-0.5 font-semibold tabular-nums text-slate-900">
                    {currencySymbol}
                    <label htmlFor="ladder-per-client" className="sr-only">
                      Average revenue per client per month
                    </label>
                    <input
                      id="ladder-per-client"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={perClientMonthlyRaw}
                      onChange={(e) => setPerClientMonthlyRaw(e.target.value)}
                      disabled={migrationNeeded}
                      className="w-[4.5rem] border-0 border-b border-slate-300 bg-transparent px-0 py-0.5 text-sm font-semibold outline-none focus:border-sky-500 disabled:opacity-45"
                    />
                  </span>
                  <span>/mo.</span>
                </p>
                <p className="mt-4 text-xs font-semibold text-slate-900">
                  Client retention pace
                </p>
                <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Keep clients</span>
                  <span className="text-right">Sign a client every...</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {([12, 24, 36] as const).map((months) => {
                    const weeks =
                      incomeParsed !== null &&
                      incomeParsed > 0 &&
                      perClientParsed !== null &&
                      perClientParsed > 0
                        ? signClientEveryWeeks({
                            monthsStay: months,
                            pricePerClientMonth: perClientParsed,
                            monthlyIncomeGoal: incomeParsed,
                          })
                        : null;
                    const weeksLabel =
                      weeks === null ? "—" : formatWeeksInterval(weeks);
                    return (
                      <li
                        key={months}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm text-slate-800"
                      >
                        <span className="shrink-0 text-slate-700">
                          {months} months
                        </span>
                        <span
                          className="min-w-[5.5rem] text-right font-semibold tabular-nums text-slate-900"
                          aria-label={
                            weeks === null
                              ? undefined
                              : `Sign a client every ${weeksLabel}`
                          }
                        >
                          {weeksLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-900">
                    Calls needed by close rate
                  </p>
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-center border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Close rate</span>
                    <span className="text-right">Number of calls</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {closeRateCallScenarios.map((row) => {
                      return (
                        <li
                          key={row.label}
                          className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm text-slate-800"
                        >
                          <span className="shrink-0 text-slate-700">{row.label}</span>
                          <span className="min-w-[5.5rem] text-right font-semibold tabular-nums text-slate-900">
                            {row.calls === null ? "—" : row.calls}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-900">
                    Lead volume required
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="py-1.5 pr-3 text-left">Lead to call ratio</th>
                          {closeRateCallScenarios.map((row) => (
                            <th key={`calls-${row.label}`} className="py-1.5 px-2 text-center">
                              <span className="block">
                                {row.calls === null ? "—" : row.calls}
                              </span>
                              <span className="block text-[10px] font-medium normal-case tracking-normal text-slate-400">
                                calls
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[5, 10, 15].map((ratio) => (
                          <tr
                            key={`lead-ratio-${ratio}`}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="py-1.5 pr-3 text-slate-700">
                              {ratio} → 1 call
                            </td>
                            {closeRateCallScenarios.map((row) => (
                              <td
                                key={`lead-${ratio}-${row.label}`}
                                className="py-1.5 px-2 text-right font-semibold tabular-nums text-slate-900"
                              >
                                {row.calls === null ? "—" : row.calls * ratio}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
