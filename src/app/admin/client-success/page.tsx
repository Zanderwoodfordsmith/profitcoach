"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSignatureMatrixColumns, type SignatureScore } from "@/lib/signatureModelV2";
import { CoachesHubTabs } from "@/components/admin/CoachesHubTabs";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";

type MatrixCoachRow = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  updated_at: string | null;
  scores: Record<string, SignatureScore>;
};

const SCORE_CELL_STYLE: Record<Exclude<SignatureScore, null>, string> = {
  red: "bg-rose-500 text-white",
  yellow: "bg-amber-400 text-amber-950",
  green: "bg-emerald-500 text-white",
};

const SCORE_LABEL: Record<Exclude<SignatureScore, null>, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
};

function getScoreCellClasses(score: SignatureScore): string {
  if (!score) {
    return "bg-slate-200 text-slate-500";
  }
  return SCORE_CELL_STYLE[score];
}

function getScoreText(score: SignatureScore): string {
  if (!score) return "-";
  return score.charAt(0).toUpperCase();
}

function getScoreLabel(score: SignatureScore): string {
  if (!score) return "Not scored";
  return SCORE_LABEL[score];
}

const PILLAR_DIVIDER = "border-l border-slate-300";

function isPillarStart(
  cols: Array<{ pillarTitle: string }>,
  index: number
): boolean {
  if (index <= 0) return false;
  return cols[index].pillarTitle !== cols[index - 1].pillarTitle;
}

export default function AdminClientSuccessPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MatrixCoachRow[]>([]);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => getSignatureMatrixColumns(), []);
  const groupedColumns = useMemo(() => {
    const groups: Array<{ title: string; count: number }> = [];
    for (const col of columns) {
      const last = groups[groups.length - 1];
      if (last && last.title === col.pillarTitle) {
        last.count += 1;
      } else {
        groups.push({ title: col.pillarTitle, count: 1 });
      }
    }
    return groups;
  }, [columns]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setCheckingRole(true);
      setLoading(true);
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
      };
      if (!roleRes.ok || !roleBody.role) {
        if (!cancelled) {
          setError("Unable to load your profile.");
          setCheckingRole(false);
          setLoading(false);
        }
        return;
      }

      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      setCheckingRole(false);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        if (!cancelled) {
          setError("Unable to load client success matrix.");
          setLoading(false);
        }
        return;
      }

      const res = await fetch("/api/admin/coach-signature-matrix", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const body = (await res.json().catch(() => ({}))) as {
        coaches?: MatrixCoachRow[];
        error?: string;
      };

      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Unable to load client success matrix.");
        setLoading(false);
        return;
      }

      setRows(body.coaches ?? []);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader title="Coaches" tabs={<CoachesHubTabs />} />

      {checkingRole ? <p className="text-sm text-slate-600">Checking access…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!checkingRole && !loading && !error && rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          No coaches found yet, so there is no client success matrix to display.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[78rem] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 min-w-[15rem] border-b border-r border-slate-200 bg-slate-50 px-4 py-2"
              >
                Coach
              </th>
              {groupedColumns.map((group, groupIndex) => (
                <th
                  key={group.title}
                  colSpan={group.count}
                  className={`border-b border-slate-200 px-2 py-2 text-center ${
                    groupIndex > 0 ? PILLAR_DIVIDER : ""
                  }`}
                >
                  {group.title}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column, colIndex) => (
                <th
                  key={column.moduleId}
                  className={`min-w-[3.25rem] border-b border-slate-200 px-2 py-2 text-center ${
                    isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                  }`}
                  title={`${column.code} - ${column.displayTitle}`}
                >
                  {column.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((coach) => (
              <tr key={coach.id} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 border-r border-t border-slate-100 bg-white px-4 py-2 align-top">
                  <p className="font-medium text-slate-900">{coach.full_name ?? "—"}</p>
                  <p className="text-xs text-slate-600">{coach.coach_business_name ?? "—"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{coach.slug}</p>
                </td>
                {columns.map((column, colIndex) => {
                  const score = (coach.scores?.[column.moduleId] ?? null) as SignatureScore;
                  const label = getScoreLabel(score);
                  return (
                    <td
                      key={`${coach.id}-${column.moduleId}`}
                      className={`border-t border-slate-100 px-2 py-1.5 ${
                        isPillarStart(columns, colIndex) ? PILLAR_DIVIDER : ""
                      }`}
                    >
                      <div
                        title={`${column.code} - ${column.displayTitle}: ${label}`}
                        aria-label={`${column.code} - ${column.displayTitle}: ${label}`}
                        className={`mx-auto flex h-8 w-9 items-center justify-center rounded text-xs font-semibold ${getScoreCellClasses(
                          score
                        )}`}
                      >
                        {getScoreText(score)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-3 text-sm text-slate-600"
                >
                  Loading client success matrix…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
