"use client";

import type { CallRow } from "@/lib/callRow";
import { ContactInfoCell } from "@/components/table/ContactInfoCell";
import { ProspectEmptyValue } from "@/components/prospects/ProspectEmptyValue";
import { ProspectLeadSubtitle } from "@/components/prospects/ProspectLeadSubtitle";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import {
  callStatusClass,
  formatCallWhen,
  formatProspectLastAssessed,
  getCallDisplayName,
  getCallStatusLabel,
} from "@/lib/prospectNextCall";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";

export type { CallRow };

type Props = {
  rows: CallRow[];
  loading: boolean;
  error: string | null;
  onRowClick?: (row: CallRow) => void;
  emptyMessage?: string;
  showCoachColumn?: boolean;
  renderCallStatus?: (row: CallRow) => React.ReactNode;
};

function CallStatusBadge({ row }: { row: CallRow }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${callStatusClass(row.status_normalized)}`}
    >
      {getCallStatusLabel(row.status_normalized)}
    </span>
  );
}

export function CallsTable({
  rows,
  loading,
  error,
  onRowClick,
  emptyMessage = "No calls found for this selection.",
  showCoachColumn = false,
  renderCallStatus,
}: Props) {
  const columnCount = 6 + (showCoachColumn ? 1 : 0);

  return (
    <div
      className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ maxHeight: "calc(100vh - 14rem)" }}
    >
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left">Prospect</th>
              <th className="px-4 py-3 text-left">Contact info</th>
              <th className="px-4 py-3 text-left">Date added</th>
              <th className="px-4 py-3 text-left">Call time</th>
              <th className="px-4 py-3 text-left">Calendar</th>
              <th className="px-4 py-3 text-left">Call status</th>
              {showCoachColumn ? (
                <th className="px-4 py-3 text-left">Coach</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const displayName =
                formatProspectPersonName(row.prospect_name) ||
                row.prospect_name;
              const callTime = formatCallWhen(row.start_time);
              const statusControl = renderCallStatus?.(row);
              return (
                <tr
                  key={row.id}
                  className={
                    onRowClick
                      ? "group cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      : "group border-t border-slate-100 hover:bg-slate-50"
                  }
                  onClick={
                    onRowClick
                      ? (e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "[data-row-action]"
                            )
                          ) {
                            return;
                          }
                          onRowClick(row);
                        }
                      : undefined
                  }
                >
                  <td className="px-4 py-3 text-slate-900">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProspectTableAvatar name={displayName} />
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 truncate text-sm font-medium">
                          {displayName}
                        </div>
                        <ProspectLeadSubtitle
                          jobTitle={null}
                          businessName={row.business_name}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ContactInfoCell
                      phone={row.prospect_phone}
                      email={row.prospect_email}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {row.created_at ? (
                      <span className="whitespace-nowrap text-sm text-slate-500">
                        {formatProspectLastAssessed(row.created_at)}
                      </span>
                    ) : (
                      <ProspectEmptyValue />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {callTime ? (
                      <span className="whitespace-nowrap text-sm text-slate-800">
                        {callTime}
                      </span>
                    ) : (
                      <ProspectEmptyValue />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-800">
                      {getCallDisplayName(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {statusControl ? (
                      <div data-row-action>{statusControl}</div>
                    ) : (
                      <CallStatusBadge row={row} />
                    )}
                  </td>
                  {showCoachColumn ? (
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {row.coach_name ??
                          row.coach_business_name ??
                          "Unknown coach"}
                      </span>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {error ?? emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
