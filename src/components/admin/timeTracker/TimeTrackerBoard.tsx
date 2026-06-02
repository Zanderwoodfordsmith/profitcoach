"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Settings2 } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  DEFAULT_TIME_TRACKER_SETTINGS,
  type TimeTrackerAdmin,
  type TimeTrackerBlock,
  type TimeTrackerSettings,
} from "@/lib/timeTracker/types";
import {
  addWeeks,
  formatWeekRange,
  toDateKey,
  weekDates as computeWeekDates,
  fromDateKey,
  formatDateShort,
  weekdayLabel,
} from "@/lib/timeTracker/time";
import { TimeTrackerGrid } from "./TimeTrackerGrid";
import { TimeTrackerBlockModal, type BlockDraft } from "./TimeTrackerBlockModal";
import { TimeTrackerSelect } from "./TimeTrackerSelect";

function initials(name: string | null, email: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function adminLabel(admin: TimeTrackerAdmin): string {
  return admin.fullName || admin.email || "Admin";
}

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 8); // 8..24
const START_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30); // every 30 min

function formatStartOption(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function TimeTrackerBoard() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [admins, setAdmins] = useState<TimeTrackerAdmin[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [settings, setSettings] = useState<TimeTrackerSettings>(
    DEFAULT_TIME_TRACKER_SETTINGS
  );
  const [blocks, setBlocks] = useState<TimeTrackerBlock[]>([]);
  const [titleHistory, setTitleHistory] = useState<string[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<string[]>([]);

  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [activeBlock, setActiveBlock] = useState<TimeTrackerBlock | null>(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [deletingBlock, setDeletingBlock] = useState(false);

  const weekDates = useMemo(() => computeWeekDates(weekAnchor), [weekAnchor]);
  const editable = selectedUserId !== null && selectedUserId === currentUserId;

  const authHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => ({
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...extra,
    }),
    [accessToken]
  );

  // Bootstrap: token + admins list.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const token = session?.access_token ?? null;
      if (cancelled) return;
      setAccessToken(token);
      if (!token) {
        setError("Not signed in.");
        setLoadingAdmins(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/time-tracker/admins", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as {
          admins?: TimeTrackerAdmin[];
          currentUserId?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? "Unable to load admins.");
        setAdmins(body.admins ?? []);
        setCurrentUserId(body.currentUserId ?? null);
        setSelectedUserId(body.currentUserId ?? body.admins?.[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load admins.");
        }
      } finally {
        if (!cancelled) setLoadingAdmins(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load settings + blocks whenever the selected admin or week changes.
  const reloadGrid = useCallback(async () => {
    if (!accessToken || !selectedUserId) return;
    setLoadingGrid(true);
    setError(null);
    const from = toDateKey(weekDates[0]);
    const to = toDateKey(weekDates[6]);
    try {
      const [settingsRes, blocksRes, suggestionsRes] = await Promise.all([
        fetch(
          `/api/admin/time-tracker/settings?userId=${encodeURIComponent(selectedUserId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
        fetch(
          `/api/admin/time-tracker/blocks?userId=${encodeURIComponent(
            selectedUserId
          )}&from=${from}&to=${to}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
        fetch(
          `/api/admin/time-tracker/suggestions?userId=${encodeURIComponent(selectedUserId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
      ]);
      const settingsBody = (await settingsRes.json()) as {
        settings?: TimeTrackerSettings;
      };
      const blocksBody = (await blocksRes.json()) as {
        blocks?: TimeTrackerBlock[];
        error?: string;
      };
      const suggestionsBody = (await suggestionsRes.json().catch(() => ({}))) as {
        titles?: string[];
        categories?: string[];
      };
      if (!blocksRes.ok) throw new Error(blocksBody.error ?? "Unable to load blocks.");
      setSettings(settingsBody.settings ?? DEFAULT_TIME_TRACKER_SETTINGS);
      setBlocks(blocksBody.blocks ?? []);
      setTitleHistory(suggestionsBody.titles ?? []);
      setCategoryHistory(suggestionsBody.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tracker.");
    } finally {
      setLoadingGrid(false);
    }
  }, [accessToken, selectedUserId, weekDates]);

  useEffect(() => {
    void reloadGrid();
  }, [reloadGrid]);

  const handleCreate = useCallback(
    async (dayKey: string, startMin: number, endMin: number) => {
      if (!accessToken || !editable) return;
      try {
        const res = await fetch("/api/admin/time-tracker/blocks", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ dayDate: dayKey, startMin, endMin }),
        });
        const body = (await res.json()) as { block?: TimeTrackerBlock; error?: string };
        if (!res.ok || !body.block) {
          throw new Error(body.error ?? "Unable to create block.");
        }
        setBlocks((prev) => [...prev, body.block!]);
        setActiveBlock(body.block);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to create block.");
      }
    },
    [accessToken, authHeaders, editable]
  );

  const handleMoveResize = useCallback(
    async (block: TimeTrackerBlock, startMin: number, endMin: number) => {
      if (!accessToken || !editable) return;
      const previous = blocks;
      // Optimistic update so the block snaps to its new position immediately.
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, startMin, endMin } : b))
      );
      try {
        const res = await fetch(`/api/admin/time-tracker/blocks/${block.id}`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ startMin, endMin }),
        });
        const body = (await res.json()) as { block?: TimeTrackerBlock; error?: string };
        if (!res.ok || !body.block) {
          throw new Error(body.error ?? "Unable to move block.");
        }
        setBlocks((prev) =>
          prev.map((b) => (b.id === body.block!.id ? body.block! : b))
        );
      } catch (err) {
        setBlocks(previous);
        setError(err instanceof Error ? err.message : "Unable to move block.");
      }
    },
    [accessToken, authHeaders, blocks, editable]
  );

  const handleSaveBlock = useCallback(
    async (draft: BlockDraft) => {
      if (!accessToken || !activeBlock) return;
      setSavingBlock(true);
      try {
        const res = await fetch(`/api/admin/time-tracker/blocks/${activeBlock.id}`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(draft),
        });
        const body = (await res.json()) as { block?: TimeTrackerBlock; error?: string };
        if (!res.ok || !body.block) {
          throw new Error(body.error ?? "Unable to save block.");
        }
        setBlocks((prev) =>
          prev.map((b) => (b.id === body.block!.id ? body.block! : b))
        );
        setActiveBlock(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save block.");
      } finally {
        setSavingBlock(false);
      }
    },
    [accessToken, activeBlock, authHeaders]
  );

  const handleDeleteBlock = useCallback(async () => {
    if (!accessToken || !activeBlock) return;
    setDeletingBlock(true);
    try {
      const res = await fetch(`/api/admin/time-tracker/blocks/${activeBlock.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unable to delete block.");
      }
      setBlocks((prev) => prev.filter((b) => b.id !== activeBlock.id));
      setActiveBlock(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete block.");
    } finally {
      setDeletingBlock(false);
    }
  }, [accessToken, activeBlock, authHeaders]);

  const saveSettings = useCallback(
    async (next: TimeTrackerSettings) => {
      if (!accessToken || !editable) return;
      setSettings(next);
      try {
        const res = await fetch("/api/admin/time-tracker/settings", {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Unable to save settings.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save settings.");
      }
    },
    [accessToken, authHeaders, editable]
  );

  const dedupe = useCallback((values: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
      const trimmed = value.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  }, []);

  // History first (most-recent across all weeks), then any new values from the
  // current week so freshly-typed entries show up immediately.
  const titleSuggestions = useMemo(
    () => dedupe([...titleHistory, ...blocks.map((b) => b.title)]),
    [blocks, dedupe, titleHistory]
  );
  const categorySuggestions = useMemo(
    () => dedupe([...categoryHistory, ...blocks.map((b) => b.category)]),
    [blocks, categoryHistory, dedupe]
  );

  const activeBlockDayLabel = useMemo(() => {
    if (!activeBlock) return "";
    const date = fromDateKey(activeBlock.dayDate);
    return `${weekdayLabel((date.getDay() + 6) % 7)}, ${formatDateShort(date)}`;
  }, [activeBlock]);

  if (loadingAdmins) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading time tracker…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Admin tabs */}
      {admins.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {admins.map((admin) => {
            const isSelected = admin.id === selectedUserId;
            const isMe = admin.id === currentUserId;
            return (
              <button
                key={admin.id}
                type="button"
                onClick={() => {
                  setSelectedUserId(admin.id);
                  setShowSettings(false);
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isSelected
                    ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {admin.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={admin.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(admin.fullName, admin.email)
                  )}
                </span>
                <span className="max-w-[140px] truncate">{adminLabel(admin)}</span>
                {isMe && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isSelected ? "bg-white/20" : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    You
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: week nav + settings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addWeeks(d, -1))}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(new Date())}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-sm font-semibold text-slate-800">
            {formatWeekRange(weekAnchor)}
          </span>
          {loadingGrid && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>

        <div className="flex items-center gap-2">
          {!editable && selectedUserId && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              Read-only
            </span>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                showSettings
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Settings2 className="h-4 w-4" />
              Day setup
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {editable && showSettings && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Day starts at
            </span>
            <TimeTrackerSelect
              value={String(settings.dayStartMin)}
              onChange={(v) => saveSettings({ ...settings, dayStartMin: Number(v) })}
              options={START_OPTIONS.map((min) => ({
                value: String(min),
                label: formatStartOption(min),
              }))}
              ariaLabel="Day starts at"
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hours shown
            </span>
            <TimeTrackerSelect
              value={String(settings.visibleHours)}
              onChange={(v) => saveSettings({ ...settings, visibleHours: Number(v) })}
              options={HOUR_OPTIONS.map((h) => ({
                value: String(h),
                label: `${h} hours`,
              }))}
              ariaLabel="Hours shown"
              className="w-32"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Slot size
            </span>
            <TimeTrackerSelect
              value={String(settings.slotMinutes)}
              onChange={(v) => saveSettings({ ...settings, slotMinutes: Number(v) })}
              options={[15, 30, 60].map((m) => ({
                value: String(m),
                label: `${m} min`,
              }))}
              ariaLabel="Slot size"
              className="w-28"
            />
          </div>
          <p className="text-xs text-slate-400">
            Click and drag on the grid to block out time. Click a block to add notes.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <TimeTrackerGrid
        settings={settings}
        weekDates={weekDates}
        blocks={blocks}
        editable={editable}
        onCreate={handleCreate}
        onMoveResize={handleMoveResize}
        onOpenBlock={setActiveBlock}
      />

      {activeBlock && (
        <TimeTrackerBlockModal
          block={activeBlock}
          dayLabel={activeBlockDayLabel}
          readOnly={!editable}
          saving={savingBlock}
          deleting={deletingBlock}
          slotMinutes={settings.slotMinutes}
          titleSuggestions={titleSuggestions}
          categorySuggestions={categorySuggestions}
          onClose={() => setActiveBlock(null)}
          onSave={handleSaveBlock}
          onDelete={handleDeleteBlock}
        />
      )}
    </div>
  );
}
