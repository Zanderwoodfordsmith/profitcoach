"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { StickyPageHeader } from "@/components/layout";
import { PLAYBOOKS } from "@/lib/bossData";
import { LEVELS, AREAS } from "@/lib/bossData";
import { PlaybookCard, type PlaybookSummary } from "@/components/playbooks/PlaybookCard";

type UnlockState = Record<string, boolean>;
type AnswersMap = Record<string, 0 | 1 | 2>;
type ViewMode = "list" | "cards";
type GroupBy = "level" | "pillar" | "area";

const PILLARS = [
  { id: "foundation" as const, name: "Foundation", areaIds: [0] },
  { id: "vision" as const, name: "Vision", areaIds: [1, 2, 3] },
  { id: "velocity" as const, name: "Velocity", areaIds: [4, 5, 6] },
  { id: "value" as const, name: "Value", areaIds: [7, 8, 9] },
] as const;

const LEVELS_ASCENDING = [...LEVELS].sort((a, b) => a.id - b.id);

export default function ClientPlaybooksListPage() {
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [unlocks, setUnlocks] = useState<UnlockState>({});
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [summaries, setSummaries] = useState<PlaybookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [groupBy, setGroupBy] = useState<GroupBy>("level");
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(1);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingContactId) {
        headers["x-impersonate-contact-id"] = impersonatingContactId;
      }

      const [meRes, summaryRes] = await Promise.all([
        fetch("/api/client/me", { headers }),
        fetch("/api/playbooks/summary", { headers }),
      ]);

      if (cancelled) return;

      if (!meRes.ok) {
        const body = (await meRes.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load.");
        setLoading(false);
        return;
      }

      const meBody = (await meRes.json()) as {
        contact?: { id: string };
        assessment?: { answers?: AnswersMap };
      };
      const cid = meBody.contact?.id ?? null;
      setAnswers(meBody.assessment?.answers ?? {});

      if (summaryRes.ok) {
        const summaryBody = (await summaryRes.json()) as { playbooks?: PlaybookSummary[] };
        setSummaries(summaryBody.playbooks ?? []);
      } else {
        const fallback: PlaybookSummary[] = PLAYBOOKS.map((p) => ({
          ref: p.ref,
          name: p.name,
          level: p.level,
          area: p.area,
          subtitle: "",
          description: "",
          playCount: 0,
        }));
        setSummaries(fallback);
      }

      if (cid) {
        const unlocksHeaders: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (impersonatingContactId) {
          unlocksHeaders["x-impersonate-contact-id"] = impersonatingContactId;
        }
        const unlocksRes = await fetch(
          `/api/client/playbooks/unlocks?contact_id=${encodeURIComponent(cid)}`,
          { headers: unlocksHeaders }
        );
        if (unlocksRes.ok) {
          const unlocksBody = (await unlocksRes.json()) as {
            unlocks?: string[];
          };
          const map: UnlockState = {};
          for (const ref of unlocksBody.unlocks ?? []) {
            map[ref] = true;
          }
          setUnlocks(map);
        }
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  function renderCardsView() {
    if (groupBy === "level") {
      const levelsToShow =
        selectedLevelId != null
          ? LEVELS_ASCENDING.filter((l) => l.id === selectedLevelId)
          : LEVELS_ASCENDING;
      return levelsToShow.map((level) => {
        const items = summaries.filter((s) => s.level === level.id);
        if (items.length === 0) return null;
        return (
          <section key={level.id} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Level {level.id} — {level.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((s) => (
                <PlaybookCard
                  key={s.ref}
                  summary={s}
                  href={`/client/playbooks/${s.ref}`}
                  score={answers[s.ref] as 0 | 1 | 2 | undefined}
                  locked={!unlocks[s.ref]}
                />
              ))}
            </div>
          </section>
        );
      });
    }
    if (groupBy === "pillar") {
      return PILLARS.map((pillar) => {
        const items = summaries.filter((s) =>
          (pillar.areaIds as readonly number[]).includes(s.area)
        );
        if (items.length === 0) return null;
        return (
          <section key={pillar.id} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              {pillar.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((s) => (
                <PlaybookCard
                  key={s.ref}
                  summary={s}
                  href={`/client/playbooks/${s.ref}`}
                  score={answers[s.ref] as 0 | 1 | 2 | undefined}
                  locked={!unlocks[s.ref]}
                />
              ))}
            </div>
          </section>
        );
      });
    }
    return AREAS.map((area) => {
      const items = summaries.filter((s) => s.area === area.id);
      if (items.length === 0) return null;
      return (
        <section key={area.id} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Area {area.id} — {area.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((s) => (
              <PlaybookCard
                key={s.ref}
                summary={s}
                href={`/client/playbooks/${s.ref}`}
                score={answers[s.ref] as 0 | 1 | 2 | undefined}
                locked={!unlocks[s.ref]}
              />
            ))}
          </div>
        </section>
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <StickyPageHeader
        eyebrow="Profit System"
        title="Playbooks"
        description="Browse the full Profit System. Unlocked playbooks are available to you; others can be unlocked by your coach."
        actions={
          !loading && !error ? (
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex rounded-lg border border-slate-200 p-0.5"
                role="group"
                aria-label="View mode"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    viewMode === "cards"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    viewMode === "list"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          ) : null
        }
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {!loading && !error && viewMode === "list" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {PLAYBOOKS.map((p) => {
              const unlocked = unlocks[p.ref] ?? false;
              return (
                <li key={p.ref}>
                  <Link
                    href={`/client/playbooks/${p.ref}`}
                    className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 ${
                      unlocked ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    <span className="font-medium">
                      {p.ref} {p.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        unlocked
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && !error && viewMode === "cards" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4">
            <div
              className="inline-flex rounded-full p-1"
              style={{ backgroundColor: "#EBEBEB" }}
              role="tablist"
              aria-label="Group by"
            >
              {(["level", "pillar", "area"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  onClick={() => {
                    setGroupBy(tab);
                    if (tab === "level") setSelectedLevelId(1);
                  }}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                    groupBy === tab
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === "level" ? "Levels" : tab === "pillar" ? "Pillars" : "Area"}
                </button>
              ))}
            </div>
            {groupBy === "level" && (
              <div
                className="inline-flex rounded-full p-1"
                style={{ backgroundColor: "#EBEBEB" }}
                role="tablist"
                aria-label="Select level"
              >
                {LEVELS_ASCENDING.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    role="tab"
                    onClick={() => setSelectedLevelId(level.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedLevelId === level.id
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Level {level.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          {renderCardsView()}
        </div>
      )}
    </div>
  );
}
