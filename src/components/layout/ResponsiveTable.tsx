"use client";

import type { ReactNode } from "react";

export type ResponsiveTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Desktop table cell */
  cell: (row: T) => ReactNode;
  /** Optional — shown in mobile card header (defaults to first column) */
  mobilePrimary?: boolean;
  className?: string;
};

type ResponsiveTableProps<T> = {
  rows: T[];
  columns: ResponsiveTableColumn<T>[];
  getRowKey: (row: T) => string;
  renderMobileCard: (row: T) => ReactNode;
  className?: string;
  tableClassName?: string;
  emptyMessage?: ReactNode;
};

/**
 * Renders a table on lg+ and card list below lg.
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  getRowKey,
  renderMobileCard,
  className = "",
  tableClassName = "",
  emptyMessage = "No rows to show.",
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <div key={getRowKey(row)}>{renderMobileCard(row)}</div>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className={`w-full min-w-full text-left text-sm ${tableClassName}`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 font-semibold text-slate-700 ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-slate-100 last:border-b-0">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
