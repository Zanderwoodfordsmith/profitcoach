"use client";

import type { ReactNode } from "react";
import { ArrowUpDown, CalendarPlus, Search, SlidersHorizontal } from "lucide-react";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import {
  CallsViewSwitcher,
  type CallsWorkspaceView,
} from "@/components/calls/CallsViewSwitcher";

export type CallsToolbarMenu = "filter" | "sort" | null;

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  view: CallsWorkspaceView;
  onViewChange: (view: CallsWorkspaceView) => void;
  menu: CallsToolbarMenu;
  onMenuChange: (menu: CallsToolbarMenu) => void;
  filterCount: number;
  filterMenu: ReactNode;
  sortActive?: boolean;
  sortMenu?: ReactNode;
  onSettings: () => void;
  onBook: () => void;
};

export function CallsToolbar({
  search,
  onSearchChange,
  view,
  onViewChange,
  menu,
  onMenuChange,
  filterCount,
  filterMenu,
  sortActive = false,
  sortMenu,
  onSettings,
  onBook,
}: Props) {
  const list = view === "list";

  function toggle(next: Exclude<CallsToolbarMenu, null>) {
    onMenuChange(menu === next ? null : next);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative w-44 shrink-0 sm:w-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search calls…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
          />
        </label>

        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <TableToolbarButton
              label="Filter"
              aria-haspopup="true"
              aria-expanded={menu === "filter"}
              active={menu === "filter"}
              badge={filterCount > 0 ? filterCount : null}
              onClick={() => toggle("filter")}
              icon={<FilterSlidersIcon className="h-5 w-5 text-slate-500" />}
            />
            {menu === "filter" ? filterMenu : null}
          </div>

          {list && sortMenu ? (
            <div className="relative">
              <TableToolbarButton
                label="Sort"
                aria-haspopup="true"
                aria-expanded={menu === "sort"}
                active={menu === "sort"}
                badge={sortActive ? 1 : null}
                title={sortActive ? "Sort (active)" : "Sort"}
                onClick={() => toggle("sort")}
                icon={
                  <ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />
                }
              />
              {menu === "sort" ? sortMenu : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => {
            onMenuChange(null);
            onSettings();
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          <SlidersHorizontal
            className="h-3.5 w-3.5 text-slate-500"
            strokeWidth={2.25}
            aria-hidden
          />
          Settings
        </button>
        <CallsViewSwitcher view={view} onChange={onViewChange} />
        <button
          type="button"
          onClick={() => {
            onMenuChange(null);
            onBook();
          }}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <CalendarPlus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Add a call
        </button>
      </div>
    </div>
  );
}
