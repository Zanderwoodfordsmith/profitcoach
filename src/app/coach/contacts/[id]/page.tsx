"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { BossGrid } from "@/components/BossGrid";
import { BossWheel, BossDoughnut, FocusAreas } from "@/components/BossCharts";
import { computeAreaScores } from "@/lib/bossScores";

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  business_name: string | null;
};

type Assessment = {
  id: string;
  total_score: number;
  completed_at: string;
  answers: Record<string, 0 | 1 | 2>;
};

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = use(params);
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();

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
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profileError) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }

      const effectiveCoachId =
        profile.role === "admin" && impersonatingCoachId
          ? impersonatingCoachId
          : user.id;

      if (profile.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }

      const { data: contactRow, error: contactError } =
        await supabaseClient
          .from("contacts")
          .select("id, full_name, email, business_name, coach_id")
          .eq("id", contactId)
          .maybeSingle();

      if (cancelled) return;

      if (!contactRow || contactError) {
        setError("Contact not found.");
        setLoading(false);
        return;
      }

      if (contactRow.coach_id !== effectiveCoachId) {
        setError("You do not have access to this contact.");
        setLoading(false);
        return;
      }

      setContact({
        id: contactRow.id as string,
        full_name: contactRow.full_name as string,
        email: contactRow.email ?? null,
        business_name: contactRow.business_name ?? null,
      });

      const { data: latest, error: assessError } = await supabaseClient
        .from("assessments")
        .select("id, total_score, completed_at, answers")
        .eq("contact_id", contactId)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assessError) {
        setError("Unable to load latest assessment.");
        setLoading(false);
        return;
      }

      if (latest) {
        setAssessment({
          id: latest.id as string,
          total_score: latest.total_score as number,
          completed_at: latest.completed_at as string,
          answers: (latest.answers ?? {}) as Record<
            string,
            0 | 1 | 2
          >,
        });
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [contactId, router, impersonatingCoachId]);

  const answers = assessment?.answers ?? {};
  const areaScores = computeAreaScores(answers);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="border-b border-slate-200 pb-3">
          <div className="mb-2 flex items-center gap-4">
            <button
              type="button"
              className="text-xs text-slate-600 hover:text-slate-800"
              onClick={() => router.push("/coach/contacts")}
            >
              ← Back to contacts
            </button>
            <a
              href={`/coach/contacts/${contactId}/playbooks`}
              className="text-xs font-medium text-sky-700 hover:text-sky-800"
            >
              Playbooks →
            </a>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            BOSS Dashboard
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {contact ? contact.full_name : "Contact"}
          </h1>
          {contact && (
            <p className="mt-1 text-sm text-slate-700">
              {contact.business_name ?? "No business name"}
              {contact.email
                ? ` • ${contact.email}`
                : null}
            </p>
          )}
        </header>

        {loading && (
          <p className="text-sm text-slate-600">Loading…</p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {assessment && !loading && !error && (
          <section className="space-y-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Latest assessment
            </h2>
            <p className="text-xs text-slate-700">
              Completed{" "}
              {new Date(
                assessment.completed_at
              ).toLocaleString()}{" "}
              • Score{" "}
              <span className="font-semibold text-emerald-600">
                {assessment.total_score} / 100
              </span>
            </p>
          </section>
        )}

        {assessment && (
          <>
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
                playbookLinkBase={`/coach/contacts/${contactId}/playbooks`}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

