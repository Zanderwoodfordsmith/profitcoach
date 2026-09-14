"use client";

import type { ReactNode } from "react";
import { ArrowUpDown, Columns3, Layers, LayoutGrid, Search, Upload } from "lucide-react";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { TableCsvExportButton, type CsvExportScope } from "@/components/table/TableCsvExportButton";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";

export type ProspectsToolbarMenu = "filter" | "sort" | "group" | "fields" | "export" | null;

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  menu: ProspectsToolbarMenu;
  onMenuChange: (menu: ProspectsToolbarMenu) => void;
  filterCount: number;
  filterMenu: ReactNode;
  sortActive: boolean;
  sortMenu: ReactNode;
  groupActive?: boolean;
  groupMenu?: ReactNode;
  fieldsLabel: "Cards" | "Columns";
  fieldsMenu: ReactNode;
  exportDisabled?: boolean;
  exportSelectedCount?: number;
  exportMatchingCount: number;
  onExportShown: (scope: CsvExportScope) => void;
  onExportAll: (scope: CsvExportScope) => void;
  onImport?: () => void;
  searchPlaceholder?: string;
  end?: ReactNode;
};

export function ProspectsPipelineToolbar({
  search,
  onSearchChange,
  menu,
  onMenuChange,
  filterCount,
  filterMenu,
  sortActive,
  sortMenu,
  groupActive = false,
  groupMenu,
  fieldsLabel,
  fieldsMenu,
  exportDisabled = false,
  exportSelectedCount = 0,
  exportMatchingCount,
  onExportShown,
  onExportAll,
  onImport,
  searchPlaceholder = "Search prospects…",
  end,
}: Props) {
  function toggle(next: Exclude<ProspectsToolbarMenu, null>) {
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
            placeholder={searchPlaceholder}
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

          <div className="relative">
            <TableToolbarButton
              label="Sort"
              aria-haspopup="true"
              aria-expanded={menu === "sort"}
              active={menu === "sort"}
              badge={sortActive ? 1 : null}
              onClick={() => toggle("sort")}
              icon={<ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />}
            />
            {menu === "sort" ? sortMenu : null}
          </div>

          {groupMenu ? (
            <div className="relative">
              <TableToolbarButton
                label="Group"
                aria-haspopup="true"
                aria-expanded={menu === "group"}
                active={menu === "group" || groupActive}
                badge={groupActive ? 1 : null}
                onClick={() => toggle("group")}
                icon={<Layers className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {menu === "group" ? groupMenu : null}
            </div>
          ) : null}

          <div className="relative">
            <TableToolbarButton
              label={fieldsLabel}
              aria-haspopup="true"
              aria-expanded={menu === "fields"}
              active={menu === "fields"}
              onClick={() => toggle("fields")}
              icon={
                fieldsLabel === "Cards" ? (
                  <LayoutGrid className="h-5 w-5 text-slate-500" aria-hidden />
                ) : (
                  <Columns3 className="h-5 w-5 text-slate-500" aria-hidden />
                )
              }
            />
            {menu === "fields" ? fieldsMenu : null}
          </div>

          {onImport ? (
            <TableToolbarButton
              label="Import"
              onClick={() => {
                onMenuChange(null);
                onImport();
              }}
              icon={<Upload className="h-5 w-5 text-slate-500" aria-hidden />}
            />
          ) : null}

          <TableCsvExportButton
            disabled={exportDisabled}
            selectedCount={exportSelectedCount}
            totalMatchingCount={exportMatchingCount}
            onExportShown={onExportShown}
            onExportAll={onExportAll}
          />
        </div>
      </div>

      {end ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div>
      ) : null}
    </div>
  );
}
