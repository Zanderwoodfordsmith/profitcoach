"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { adminExtraNavLinks } from "@/config/adminExtraNavLinks";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

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
    <div className="flex flex-col gap-6">
      <StickyPageHeader
        title="Settings"
        description="Admin configuration and previews."
      />

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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Pages outside the sidebar
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Same list as{" "}
          <Link
            href="/admin/account"
            className="font-medium text-sky-600 underline hover:text-sky-700"
          >
            Account → Links
          </Link>
          . Open in a new tab when checking production.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
          {adminExtraNavLinks.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline hover:text-sky-700"
              >
                {item.label}
              </Link>
              {item.hint ? (
                <span className="text-slate-600"> — {item.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
