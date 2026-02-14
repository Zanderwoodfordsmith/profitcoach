"use client";

export type ProspectRow = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
  type: string;
  coach_id?: string;
  coach_name?: string | null;
  coach_business_name?: string | null;
  last_score: number | null;
  last_completed_at: string | null;
};

type Props = {
  prospects: ProspectRow[];
  loading: boolean;
  error: string | null;
  showCoachColumn?: boolean;
  showTypeColumn?: boolean;
  onRowClick?: (id: string) => void;
  emptyMessage?: string;
  /** Renders actions cell per row (e.g. "View as client" button). Stops row click propagation. */
  renderRowActions?: (row: ProspectRow) => React.ReactNode;
};

export function ProspectsTable({
  prospects,
  loading,
  error,
  showCoachColumn = false,
  showTypeColumn = true,
  onRowClick,
  emptyMessage = "No prospects found for this selection.",
  renderRowActions,
}: Props) {
  const colCount =
    4 + (showTypeColumn ? 1 : 0) + (showCoachColumn ? 1 : 0) + (renderRowActions ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Business</th>
            <th className="px-4 py-2">Email</th>
            {showTypeColumn && (
              <th className="px-4 py-2">Type</th>
            )}
            {showCoachColumn && (
              <th className="px-4 py-2">Coach</th>
            )}
            {renderRowActions && (
              <th className="px-4 py-2">Actions</th>
            )}
            <th className="px-4 py-2">Last score</th>
            <th className="px-4 py-2">Last assessed</th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr
              key={p.id}
              className={
                onRowClick
                  ? "cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  : "border-t border-slate-100 hover:bg-slate-50"
              }
              onClick={
                onRowClick
                  ? (e) => {
                      if ((e.target as HTMLElement).closest("[data-row-action]")) return;
                      onRowClick(p.id);
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
            >
              <td className="px-4 py-2 text-slate-900">
                {p.full_name}
              </td>
              <td className="px-4 py-2 text-slate-700">
                {p.business_name ?? "—"}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {p.email ?? "—"}
              </td>
              {showTypeColumn && (
                <td className="px-4 py-2 text-xs text-slate-700">
                  {p.type}
                </td>
              )}
              {showCoachColumn && (
                <td className="px-4 py-2 text-xs text-slate-700">
                  {p.coach_name ??
                    p.coach_business_name ??
                    "Unknown coach"}
                </td>
              )}
              {renderRowActions && (
                <td className="px-4 py-2" data-row-action onClick={(e) => e.stopPropagation()}>
                  {renderRowActions(p)}
                </td>
              )}
              <td className="px-4 py-2 text-slate-900">
                {p.last_score != null
                  ? `${p.last_score} / 100`
                  : "—"}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {p.last_completed_at
                  ? new Date(p.last_completed_at).toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
          {!loading && prospects.length === 0 && !error && (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-3 text-sm text-slate-600"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
