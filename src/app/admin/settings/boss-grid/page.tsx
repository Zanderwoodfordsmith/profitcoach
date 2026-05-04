"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  BossGrid,
  BossGridBordered,
  BossGridGlass,
  BossGridProfitSystemGlass,
  BossGridTransposed,
} from "@/components/BossGrid";
import { PLAYBOOKS } from "@/lib/bossData";
import type { AnswersMap } from "@/lib/bossScores";

/** Sample answers for previewing all grid variants (mix of 0, 1, 2). */
function sampleAnswers(): AnswersMap {
  const map: AnswersMap = {};
  PLAYBOOKS.forEach((p, i) => {
    map[p.ref] = (i % 3) as 0 | 1 | 2;
  });
  return map;
}

export default function AdminSettingsBossGridPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const answers = sampleAnswers();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!cancelled && body.role === "admin") setAllowed(true);
      setChecking(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-rose-600">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <StickyPageHeader
        title="Boss Grid variations"
        description="All grid components with sample data. Transposed (client dashboard) variant at the top."
        leading={
          <Link
            href="/admin/account?tab=site"
            className="text-xs text-sky-600 hover:text-sky-700"
          >
            ← Site tools
          </Link>
        }
      />

      {/* 0. Profit System Glass – full-page growth matrix (dark glass) */}
      <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        <h2 className="mb-3 px-4 pt-4 text-sm font-medium text-slate-200">
          Profit System Glass — Growth Matrix
        </h2>
        <div className="max-h-[85vh] overflow-auto">
          <BossGridProfitSystemGlass answers={answers} />
        </div>
      </section>

      {/* 1. Transposed (dark glass) – same as client dashboard */}
      <section
        className="w-full rounded-xl px-4 py-6"
        style={{
          background: [
            "radial-gradient(ellipse 70% 60% at 15% 30%, rgba(224, 242, 254, 0.5), transparent 60%)",
            "radial-gradient(ellipse 50% 70% at 85% 20%, rgba(6, 182, 212, 0.25), transparent 55%)",
            "linear-gradient(165deg, #0c5280 0%, #0f172a 35%, #0e4d6e 65%, #0c5280 100%)",
          ].join(", "),
        }}
      >
        <h2 className="mb-3 text-sm font-medium text-slate-200">
          Growth Matrix (transposed) — dark glass
        </h2>
        <div className="w-[90%] overflow-x-auto">
          <BossGridTransposed
            answers={answers}
            glass
            chromeColor="#0f172a"
            showNamesForScores={[0, 1, 2]}
          />
        </div>
      </section>

      {/* 2. Transposed light glass */}
      <section className="rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-6">
        <h2 className="mb-3 text-sm font-medium text-slate-700">
          Growth Matrix (transposed) — light glass
        </h2>
        <div className="overflow-x-auto">
          <BossGridTransposed
            answers={answers}
            glass
            glassTheme="light"
            showNamesForScores={[0, 1, 2]}
          />
        </div>
      </section>

      {/* 3. Default BossGrid */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Default grid</h2>
        <div className="overflow-x-auto">
          <BossGrid
            answers={answers}
            showDials
            showHeaders
            interactive={false}
          />
        </div>
      </section>

      {/* 4. Glass variant */}
      <section
        className="min-h-[320px] w-full rounded-xl px-4 py-6"
        style={{
          background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #a5b4fc 70%, #818cf8 100%)",
        }}
      >
        <h2 className="mb-3 text-sm font-medium text-slate-700">Glass variant</h2>
        <div className="overflow-x-auto">
          <BossGridGlass
            answers={answers}
            showDials
            showHeaders
            interactive={false}
          />
        </div>
      </section>

      {/* 5. Bordered variant */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-slate-600">
          Bordered variant (3px all sides)
        </h2>
        <div className="overflow-x-auto">
          <BossGridBordered
            answers={answers}
            showDials={false}
            showHeaders
            interactive={false}
          />
        </div>
      </section>
    </div>
  );
}
