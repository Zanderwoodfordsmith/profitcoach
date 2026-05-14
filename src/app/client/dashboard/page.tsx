"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossGridTransposed } from "@/components/BossGrid";
import { BossWheel, BossDoughnut, FocusAreas } from "@/components/BossCharts";
import { CalendarEmbed } from "@/components/CalendarEmbed";
import { useWheelColorScheme } from "@/lib/useWheelColorScheme";
import { useWheelViewMode } from "@/lib/useWheelViewMode";
import { InsightDashboard, type CoachingSectionContext } from "@/components/InsightDashboard";
import type { StoredInsights } from "@/lib/insightGenerator";
import { computeAreaScores, getTotalScore } from "@/lib/bossScores";
import type { AnswersMap } from "@/lib/bossScores";

const INSIGHTS_DEBOUNCE_MS = 3 * 60 * 1000; // 3 minutes
const INSIGHTS_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
};

type Assessment = {
  id: string;
  total_score: number;
  completed_at: string;
  answers: AnswersMap;
  insights?: StoredInsights | null;
  insights_generated_at?: string | null;
};

/** Default colors for Growth Matrix Transposed section (stored for reset). */
const GROWTH_MATRIX_DEFAULTS = {
  sectionGradientStart: "#0c5280",
  sectionGradientEnd: "#0f172a",
  headerTableColor: "#0f172a",
} as const;

export default function ClientDashboardPage() {
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [coachSlug, setCoachSlug] = useState<string>("BCA");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [coachCalendarEmbedCode, setCoachCalendarEmbedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingScores, setEditingScores] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<AnswersMap>({});
  const [showNamesForScores, setShowNamesForScores] = useState<(0 | 1 | 2)[]>([]);

  const [insightsGenerating, setInsightsGenerating] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [wheelColorScheme, setWheelColorScheme] = useWheelColorScheme();
  const [wheelViewMode, setWheelViewMode] = useWheelViewMode();
  const [sectionGradientStart, setSectionGradientStart] = useState<string>(
    GROWTH_MATRIX_DEFAULTS.sectionGradientStart
  );
  const [sectionGradientEnd, setSectionGradientEnd] = useState<string>(
    GROWTH_MATRIX_DEFAULTS.sectionGradientEnd
  );
  const [headerTableColor, setHeaderTableColor] = useState<string>(
    GROWTH_MATRIX_DEFAULTS.headerTableColor
  );
  const resetGrowthMatrixColors = useCallback(() => {
    setSectionGradientStart(GROWTH_MATRIX_DEFAULTS.sectionGradientStart);
    setSectionGradientEnd(GROWTH_MATRIX_DEFAULTS.sectionGradientEnd);
    setHeaderTableColor(GROWTH_MATRIX_DEFAULTS.headerTableColor);
  }, []);

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
      const res = await fetch("/api/client/me", { headers });

      if (cancelled) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load your data.");
        setLoading(false);
        return;
      }

      const body = (await res.json()) as {
        contact?: Contact;
        coach_slug?: string;
        coach_calendar_embed_code?: string | null;
        assessment?: Assessment | null;
      };

      setContact(body.contact ?? null);
      setCoachSlug(body.coach_slug ?? "BCA");
      setCoachCalendarEmbedCode(body.coach_calendar_embed_code ?? null);
      const loadedAssessment = body.assessment ?? null;
      setAssessment(loadedAssessment);

      if (loadedAssessment && !cancelled) {
        const hasNoInsights = !loadedAssessment.insights;
        const generatedAt = loadedAssessment.insights_generated_at
          ? new Date(loadedAssessment.insights_generated_at).getTime()
          : 0;
        const isStale = Date.now() - generatedAt > INSIGHTS_STALE_MS;

        if (hasNoInsights) {
          setInsightsGenerating(true);
          try {
            const genRes = await fetch("/api/client/insights/generate", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}`, ...(impersonatingContactId ? { "x-impersonate-contact-id": impersonatingContactId } : {}) },
            });
            const genData = (await genRes.json().catch(() => ({}))) as { insights?: StoredInsights };
            if (genRes.ok && genData.insights) {
              setAssessment((prev) =>
                prev ? { ...prev, insights: genData.insights!, insights_generated_at: new Date().toISOString() } : null
              );
            }
          } finally {
            if (!cancelled) setInsightsGenerating(false);
          }
        } else if (isStale) {
          fetch("/api/client/insights/generate", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, ...(impersonatingContactId ? { "x-impersonate-contact-id": impersonatingContactId } : {}) },
          })
            .then((r) => r.json())
            .then((genData: { insights?: StoredInsights }) => {
              if (genData.insights) {
                setAssessment((prev) =>
                  prev ? { ...prev, insights: genData.insights!, insights_generated_at: new Date().toISOString() } : null
                );
              }
            })
            .catch(() => {});
        }
      }
      if (body.contact && body.coach_slug) {
        try {
          sessionStorage.setItem(
            "boss_client_dashboard",
            JSON.stringify({
              contact: {
                full_name: body.contact.full_name,
                email: body.contact.email,
                business_name: body.contact.business_name,
              },
              coach_slug: body.coach_slug,
            })
          );
        } catch {
          // ignore storage errors
        }
      }
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const answers = editingScores ? localAnswers : (assessment?.answers ?? {});
  const areaScores = computeAreaScores(answers);
  const totalScore = editingScores ? getTotalScore(localAnswers) : (assessment?.total_score ?? getTotalScore(answers));
  const hasAssessment = Boolean(assessment);

  const startEditingScores = useCallback(() => {
    if (assessment?.answers) {
      setLocalAnswers({ ...assessment.answers });
      setEditingScores(true);
    }
  }, [assessment?.answers]);

  const stopEditingScores = useCallback(() => {
    setEditingScores(false);
  }, []);

  const triggerInsightsRegenerate = useCallback(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
      if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
      fetch("/api/client/insights/generate", { method: "POST", headers })
        .then((r) => r.json())
        .then((data: { insights?: StoredInsights }) => {
          if (data.insights) {
            setAssessment((prev) =>
              prev ? { ...prev, insights: data.insights!, insights_generated_at: new Date().toISOString() } : null
            );
          }
        })
        .catch(() => {});
    });
  }, [impersonatingContactId]);

  const handleRefreshInsights = useCallback(() => {
    setInsightsGenerating(true);
    supabaseClient.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session?.access_token) {
          setInsightsGenerating(false);
          return;
        }
        const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
        if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
        return fetch("/api/client/insights/generate", { method: "POST", headers })
          .then((r) => r.json())
          .then((data: { insights?: StoredInsights }) => {
            if (data.insights) {
              setAssessment((prev) =>
                prev ? { ...prev, insights: data.insights!, insights_generated_at: new Date().toISOString() } : null
              );
            }
          })
          .finally(() => setInsightsGenerating(false));
      })
      .catch(() => setInsightsGenerating(false));
  }, [impersonatingContactId]);

  const handleScoreChange = useCallback(
    async (ref: string, score: 0 | 1 | 2) => {
      const next = { ...(editingScores ? localAnswers : assessment?.answers ?? {}), [ref]: score };
      setLocalAnswers(next);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };
      if (impersonatingContactId) {
        headers["x-impersonate-contact-id"] = impersonatingContactId;
      }
      const res = await fetch("/api/client/assessment", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ answers: next }),
      });
      if (res.ok && assessment) {
        const data = (await res.json()) as { total_score: number; answers: AnswersMap };
        setAssessment((prev) =>
          prev ? { ...prev, total_score: data.total_score, answers: data.answers } : null
        );
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(triggerInsightsRegenerate, INSIGHTS_DEBOUNCE_MS);
      }
    },
    [assessment, editingScores, localAnswers, impersonatingContactId, triggerInsightsRegenerate]
  );

  return (
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        eyebrow="Profit System"
        title="Dashboard"
        descriptionPlacement="below"
        description={
          contact ? (
            <span className="text-sm text-slate-700">
              {contact.full_name ?? "Client"}
              {contact.business_name ? ` · ${contact.business_name}` : null}
            </span>
          ) : null
        }
        actions={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {hasAssessment && (
              <button
                type="button"
                onClick={editingScores ? stopEditingScores : startEditingScores}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {editingScores ? "Done" : "Edit scores"}
              </button>
            )}
            {!loading && !error && !hasAssessment && (
              <Link
                href={`/assessment/${encodeURIComponent(coachSlug)}?from=dashboard`}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Take BOSS Review
              </Link>
            )}
          </div>
        }
      />

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {!loading && !error && (
        <>
          {hasAssessment && (
            <InsightDashboard
              answers={answers}
              totalScore={totalScore}
              insights={assessment?.insights ?? null}
              insightsGenerating={insightsGenerating}
              onRefreshInsights={handleRefreshInsights}
              onGetCoaching={(context: CoachingSectionContext) => {
                try {
                  sessionStorage.setItem("coachSectionContext", JSON.stringify(context));
                } catch {
                  // ignore
                }
                router.push("/client/ai-coach?from=insight");
              }}
            />
          )}

          <section
            className="mt-6 w-full rounded-xl px-4 py-6"
            style={{
              background: [
                "radial-gradient(ellipse 70% 60% at 15% 30%, rgba(224, 242, 254, 0.5), transparent 60%)",
                "radial-gradient(ellipse 50% 70% at 85% 20%, rgba(6, 182, 212, 0.25), transparent 55%)",
                "radial-gradient(ellipse 60% 50% at 50% 85%, rgba(56, 189, 248, 0.2), transparent 55%)",
                "radial-gradient(ellipse 40% 40% at 75% 60%, rgba(255, 255, 255, 0.12), transparent 50%)",
                `linear-gradient(165deg, ${sectionGradientStart} 0%, ${sectionGradientEnd} 35%, #0e4d6e 65%, ${sectionGradientStart} 100%)`,
              ].join(", "),
            }}
          >
            {editingScores && (
              <p className="mb-3 text-sm text-slate-200">
                Click a cell to cycle through not in place → partially → fully in place.
              </p>
            )}
            <div className="w-full max-w-full">
              <BossGridTransposed
                answers={answers}
                interactive={editingScores}
                onScoreChange={editingScores ? handleScoreChange : undefined}
                playbookLinkBase={hasAssessment ? "/client/playbooks" : undefined}
                glass
                chromeColor={headerTableColor}
                showNamesForScores={showNamesForScores}
                title="Profit System"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4" role="group" aria-label="Show playbook names for">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showNamesForScores.includes(0)}
                    onChange={(e) => {
                      setShowNamesForScores((prev) =>
                        e.target.checked
                          ? ([...prev, 0].sort((a, b) => a - b) as (0 | 1 | 2)[])
                          : prev.filter((s) => s !== 0)
                      );
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800 text-red-400 focus:ring-red-500"
                  />
                  <span className="text-red-400">Needs attention</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showNamesForScores.includes(1)}
                    onChange={(e) => {
                      setShowNamesForScores((prev) =>
                        e.target.checked
                          ? ([...prev, 1].sort((a, b) => a - b) as (0 | 1 | 2)[])
                          : prev.filter((s) => s !== 1)
                      );
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800 text-amber-400 focus:ring-amber-500"
                  />
                  <span className="text-amber-400">Building</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showNamesForScores.includes(2)}
                    onChange={(e) => {
                      setShowNamesForScores((prev) =>
                        e.target.checked
                          ? ([...prev, 2].sort((a, b) => a - b) as (0 | 1 | 2)[])
                          : prev.filter((s) => s !== 2)
                      );
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800 text-emerald-400 focus:ring-emerald-500"
                  />
                  <span className="text-emerald-400">On track</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-4" role="group" aria-label="Section and table colors">
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <span>Section gradient start</span>
                  <input
                    type="color"
                    value={sectionGradientStart}
                    onChange={(e) => setSectionGradientStart(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-500 bg-slate-800"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <span>Section gradient end</span>
                  <input
                    type="color"
                    value={sectionGradientEnd}
                    onChange={(e) => setSectionGradientEnd(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-500 bg-slate-800"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <span>Header & table</span>
                  <input
                    type="color"
                    value={headerTableColor}
                    onChange={(e) => setHeaderTableColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-500 bg-slate-800"
                  />
                </label>
                <button
                  type="button"
                  onClick={resetGrowthMatrixColors}
                  className="rounded-md border border-slate-500 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  Reset to default
                </button>
              </div>
            </div>
          </section>

          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <span>Wheel colors:</span>
                <select
                  value={wheelColorScheme}
                  onChange={(e) => setWheelColorScheme(e.target.value as "default" | "alt")}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="alt">Warm (coral, yellow, green)</option>
                  <option value="default">Default (blue, purple)</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>View:</span>
                <select
                  value={wheelViewMode}
                  onChange={(e) => setWheelViewMode(e.target.value as "areas" | "pillars" | "levels")}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="areas">10 areas</option>
                  <option value="pillars">4 pillars</option>
                  <option value="levels">5 levels</option>
                </select>
              </label>
            </div>
            <BossWheel
              areaScores={areaScores}
              totalScore={totalScore}
              answers={answers}
              colorScheme={wheelColorScheme}
              viewMode={wheelViewMode}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                Score breakdown
              </h2>
              <div className="flex justify-center">
                <BossDoughnut scores={answers} />
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                Focus areas
              </h2>
              <FocusAreas scores={answers} variant="full" />
            </section>
          </div>

          {hasAssessment && coachCalendarEmbedCode ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Book your strategy call
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick a time with your coach to review this report and your next
                steps.
              </p>
              <div className="mt-4">
                <CalendarEmbed embedCode={coachCalendarEmbedCode} />
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
