"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossGrid } from "@/components/BossGrid";
import { BossWheel, BossDoughnut, FocusAreas } from "@/components/BossCharts";
import { computeAreaScores } from "@/lib/bossScores";
import type { AnswersMap } from "@/lib/bossScores";

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
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        assessment?: Assessment | null;
      };

      setContact(body.contact ?? null);
      setAssessment(body.assessment ?? null);
      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  const answers = assessment?.answers ?? {};
  const areaScores = computeAreaScores(answers);

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          Profit System
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Dashboard
        </h1>
        {contact && (
          <p className="mt-1 text-sm text-slate-700">
            {contact.full_name ?? "Client"}
            {contact.business_name ? ` · ${contact.business_name}` : null}
          </p>
        )}
      </header>

      {loading && (
        <p className="text-sm text-slate-600">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {assessment && !loading && !error && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              Latest assessment
            </h2>
            <p className="text-sm text-slate-700">
              Completed{" "}
              {new Date(assessment.completed_at).toLocaleString()}{" "}
              · Score{" "}
              <span className="font-semibold text-emerald-600">
                {assessment.total_score} / 100
              </span>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              Charts
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex justify-center">
                <BossWheel
                  areaScores={areaScores}
                  totalScore={assessment.total_score}
                />
              </div>
              <div className="flex justify-center">
                <BossDoughnut scores={answers} />
              </div>
              <div>
                <FocusAreas scores={answers} variant="full" />
              </div>
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              BOSS grid
            </h2>
            <BossGrid
              answers={answers}
              showDials
              showHeaders
              playbookLinkBase="/client/playbooks"
            />
          </section>
        </>
      )}

      {!assessment && !loading && !error && contact && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">
            No assessment yet. Complete the BOSS Review to see your grid and
            priorities.
          </p>
        </div>
      )}
    </div>
  );
}
