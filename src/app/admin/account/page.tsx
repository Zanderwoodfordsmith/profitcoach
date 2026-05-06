"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  DashboardPageSection,
  PageHeaderUnderlineTabs,
  StickyPageHeader,
} from "@/components/layout";
import {
  BossDashboardSettings,
  type BossDashboardSettingsTabId,
} from "@/components/settings/BossDashboardSettings";
import { adminExtraNavLinks } from "@/config/adminExtraNavLinks";
import { supabaseClient } from "@/lib/supabaseClient";

const linkItems = [
  { href: "/login", label: "Login" },
  { href: "/preview/thank-you", label: "Thank you (Completed)" },
];

const bossProgrammeLinks = [
  {
    href: "/landing/a?coach=BCA",
    label: "Landing page",
    hint: "Public opt-in page (variant A).",
  },
  {
    href: "/assessment/BCA",
    label: "Assessment",
    hint: "Question flow prospects complete after landing.",
  },
  {
    href: "/preview/report",
    label: "AI report preview",
    hint: "Progress bars + AI insight dashboard with seeded demo data.",
  },
  {
    href: "/preview/report-design-system",
    label: "BOSS report (design system)",
    hint: "New layout: brand canvas, glass hero, pillars/levels/areas, charts.",
  },
  {
    href: "/assessment/BCA/thank-you?preview=1",
    label: "Results page (thank-you)",
    hint: "Simpler post-assessment results experience.",
  },
  {
    href: "/admin/prospects",
    label: "Internal prospect dashboard",
    hint: "Open prospects, then select a prospect record.",
  },
] as const;

const ACCOUNT_TAB_IDS = [
  "profile",
  "account",
  "workspace",
  "links",
  "site",
] as const;

type AccountTabId = (typeof ACCOUNT_TAB_IDS)[number];

function parseAccountTab(raw: string | null): AccountTabId {
  if (raw && (ACCOUNT_TAB_IDS as readonly string[]).includes(raw)) {
    return raw as AccountTabId;
  }
  return "profile";
}

function AdminAccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseAccountTab(searchParams.get("tab"));

  const [checkingRole, setCheckingRole] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setTab = useCallback(
    (next: AccountTabId) => {
      router.replace(`/admin/account?tab=${next}`);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setCheckingRole(true);
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
        error?: string;
      };
      if (cancelled) return;
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setCheckingRole(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }
      setCheckingRole(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const tabDefs: { id: AccountTabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "account", label: "Account" },
    { id: "workspace", label: "Workspace" },
    { id: "links", label: "Links" },
    { id: "site", label: "Site tools" },
  ];

  const settingsEmbedTab: BossDashboardSettingsTabId | null =
    activeTab === "profile" || activeTab === "account" || activeTab === "workspace"
      ? activeTab
      : null;

  return (
    <DashboardPageSection
      header={
        <StickyPageHeader
          title="Account"
          description="Same profile and security options as coaches, plus admin links and site tools."
          tabs={
            <PageHeaderUnderlineTabs
              ariaLabel="Account sections"
              items={tabDefs.map((tab) => ({
                kind: "button" as const,
                id: tab.id,
                label: tab.label,
                active: activeTab === tab.id,
                onClick: () => setTab(tab.id),
              }))}
            />
          }
        />
      }
    >
      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!checkingRole && !error && settingsEmbedTab ? (
        <BossDashboardSettings
          variant="admin"
          embed={{ activeTab: settingsEmbedTab }}
        />
      ) : null}

      {!checkingRole && !error && activeTab === "links" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {linkItems.map((item) => {
                const fullUrl = origin ? `${origin}${item.href}` : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="truncate text-xs text-slate-500">
                        {fullUrl}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Boss Programme flow
            </h2>
            <ul className="divide-y divide-slate-100">
              {bossProgrammeLinks.map((item) => {
                const fullUrl = origin ? `${origin}${item.href}` : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col gap-0.5 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="truncate text-xs text-slate-500">
                          {fullUrl}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">{item.hint}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pages outside the sidebar
            </h2>
            <ul className="divide-y divide-slate-100">
              {adminExtraNavLinks.map((item) => {
                const fullUrl = origin ? `${origin}${item.href}` : item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col gap-0.5 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="truncate text-xs text-slate-500">
                          {fullUrl}
                        </span>
                      </span>
                      {item.hint ? (
                        <span className="text-xs text-slate-500">{item.hint}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      {!checkingRole && !error && activeTab === "site" ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Coaching AI</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>
                <Link
                  href="/admin/settings/ai-coach"
                  className="text-sky-600 underline hover:text-sky-700"
                >
                  AI Coach system prompt
                </Link>
                — control how the Coaching AI behaves for clients.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Previews</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
              <li>
                <Link
                  href="/admin/settings/boss-grid"
                  className="text-sky-600 underline hover:text-sky-700"
                >
                  Boss Grid variations
                </Link>
                — all grid components (transposed, default, glass, bordered).
              </li>
            </ul>
          </section>
        </div>
      ) : null}
    </DashboardPageSection>
  );
}

export default function AdminAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-6">
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      }
    >
      <AdminAccountPageContent />
    </Suspense>
  );
}
