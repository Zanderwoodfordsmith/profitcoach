"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

const linkItems = [
  { href: "/login", label: "Login" },
  { href: "/preview/thank-you", label: "Thank you (Completed)" },
];

type TabId = "links" | "settings";

export default function AdminAccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("links");
  const [checkingRole, setCheckingRole] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const tabs: { id: TabId; label: string }[] = [
    { id: "links", label: "Links" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          BOSS Dashboard
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin settings, links, and preferences.
        </p>
      </header>

      {checkingRole ? (
        <p className="text-sm text-slate-600">Checking access…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {!checkingRole && !error && (
        <>
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex gap-6" aria-label="Account tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === tab.id
                      ? "border-sky-600 text-sky-700"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "links" && (
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
                  Landing pages
                </h2>
                <ul className="divide-y divide-slate-100">
                  <li>
                    <Link
                      href="/landing/a?coach=BCA"
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="font-medium">Landing – Variant A (control)</span>
                      <span className="truncate text-xs text-slate-500">
                        {origin ? `${origin}/landing/a?coach=BCA` : "/landing/a?coach=BCA"}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/landing/b?coach=BCA"
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <span className="font-medium">Landing – Variant B (variation)</span>
                      <span className="truncate text-xs text-slate-500">
                        {origin ? `${origin}/landing/b?coach=BCA` : "/landing/b?coach=BCA"}
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">
                Account settings — coming soon.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
