"use client";

import { useEffect, useMemo, useState } from "react";
import type { CallRow } from "@/lib/callRow";
import { callMatchesSearch } from "@/lib/calls/callSearch";
import {
  getCallStatusLabel,
  isUpcomingCall,
} from "@/lib/prospectNextCall";

export type TimingFilter = "all" | "upcoming" | "past";
export type StatusFilter =
  | "all"
  | "booked"
  | "confirmed"
  | "cancelled"
  | "showed"
  | "completed"
  | "noshow"
  | "other";
export type MatchFilter = "all" | "matched" | "unmatched_contact" | "unmatched_coach";
export type CallSortField = "prospect" | "start_time" | "created_at" | "status";
export type CallSortOrder = "asc" | "desc" | "missing_first";

type CoachFilterOption = {
  id: string;
  label: string;
};

type Args = {
  calls: CallRow[];
  searchTerm: string;
  coachFilterOptions?: CoachFilterOption[];
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
};

function compareTimes(
  aIso: string | null,
  bIso: string | null,
  sortOrder: CallSortOrder
): number {
  const aTime = aIso ? new Date(aIso).getTime() : null;
  const bTime = bIso ? new Date(bIso).getTime() : null;
  if (aTime == null && bTime == null) return 0;
  if (aTime == null) return sortOrder === "missing_first" ? -1 : 1;
  if (bTime == null) return sortOrder === "missing_first" ? 1 : -1;
  return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
}

export function useCallsTableControls({
  calls,
  searchTerm,
  coachFilterOptions,
  coachFilter: controlledCoachFilter,
  onCoachFilterChange,
}: Args) {
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [internalCoachFilter, setInternalCoachFilter] = useState<
    string | "all"
  >("all");
  const [sortField, setSortField] = useState<CallSortField>("start_time");
  const [sortOrder, setSortOrder] = useState<CallSortOrder>("desc");

  const coachFilter = controlledCoachFilter ?? internalCoachFilter;
  const setCoachFilter = onCoachFilterChange ?? setInternalCoachFilter;
  const showCoachFilter = Boolean(
    coachFilterOptions && coachFilterOptions.length > 0
  );

  const filterCount = useMemo(() => {
    let count = 0;
    if (timingFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (matchFilter !== "all") count += 1;
    if (showCoachFilter && coachFilter !== "all") count += 1;
    return count;
  }, [timingFilter, statusFilter, matchFilter, showCoachFilter, coachFilter]);

  const hasActiveSort =
    sortField !== "start_time" || sortOrder !== "desc";

  const sortedCalls = useMemo(() => {
    const filtered = calls.filter((row) => {
      if (!callMatchesSearch(row, searchTerm)) return false;

      if (timingFilter === "upcoming") {
        if (!isUpcomingCall(row.start_time, row.status_normalized)) {
          return false;
        }
      }
      if (timingFilter === "past") {
        if (isUpcomingCall(row.start_time, row.status_normalized)) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        const status = row.status_normalized;
        const matches =
          status === statusFilter ||
          (statusFilter === "confirmed" && status === "booked") ||
          (statusFilter === "completed" &&
            (status === "showed" || status === "completed")) ||
          (statusFilter === "showed" &&
            (status === "showed" || status === "completed"));
        if (!matches) return false;
      }

      if (matchFilter !== "all" && row.match_status !== matchFilter) {
        return false;
      }

      if (
        showCoachFilter &&
        coachFilter !== "all" &&
        row.coach_id !== coachFilter
      ) {
        return false;
      }

      return true;
    });

    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortField === "prospect") {
        const cmp = a.prospect_name.localeCompare(b.prospect_name, undefined, {
          sensitivity: "base",
        });
        return sortOrder === "asc" ? cmp : -cmp;
      }

      if (sortField === "status") {
        const cmp = getCallStatusLabel(a.status_normalized).localeCompare(
          getCallStatusLabel(b.status_normalized),
          undefined,
          { sensitivity: "base" }
        );
        return sortOrder === "asc" ? cmp : -cmp;
      }

      if (sortField === "created_at") {
        return compareTimes(a.created_at, b.created_at, sortOrder);
      }

      return compareTimes(a.start_time, b.start_time, sortOrder);
    });

    return rows;
  }, [
    calls,
    searchTerm,
    timingFilter,
    statusFilter,
    matchFilter,
    showCoachFilter,
    coachFilter,
    sortField,
    sortOrder,
  ]);

  const sortOrderOptions = useMemo(() => {
    if (sortField === "prospect" || sortField === "status") {
      return [
        { value: "asc" as const, label: "A → Z" },
        { value: "desc" as const, label: "Z → A" },
      ];
    }
    return [
      { value: "desc" as const, label: "Latest first" },
      { value: "asc" as const, label: "Earliest first" },
      { value: "missing_first" as const, label: "No date first" },
    ];
  }, [sortField]);

  useEffect(() => {
    const valid = new Set(sortOrderOptions.map((option) => option.value));
    if (!valid.has(sortOrder)) {
      setSortOrder(sortOrderOptions[0]?.value ?? "desc");
    }
  }, [sortField, sortOrder, sortOrderOptions]);

  return {
    timingFilter,
    setTimingFilter,
    statusFilter,
    setStatusFilter,
    matchFilter,
    setMatchFilter,
    coachFilter,
    setCoachFilter,
    showCoachFilter,
    coachFilterOptions,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    sortOrderOptions,
    filterCount,
    hasActiveSort,
    sortedCalls,
  };
}
