"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const navItems = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/prospects", label: "Prospects" },
  { href: "/coach/clients", label: "Clients" },
];

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId, clearImpersonation } = useImpersonation();
  const [coachName, setCoachName] = useState<string | null>(null);

  useEffect(() => {
    if (!impersonatingCoachId) {
      setCoachName(null);
      return;
    }
    let cancelled = false;
    async function loadCoachName() {
      const res = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: impersonatingCoachId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        full_name?: string | null;
        coach_business_name?: string | null;
      };
      if (!cancelled && data) {
        const name =
          data.full_name ??
          data.coach_business_name ??
          "Coach";
        setCoachName(name);
      } else if (!cancelled) {
        setCoachName("Coach");
      }
    }
    loadCoachName();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  function handleExit() {
    clearImpersonation();
    router.push("/admin");
  }

  const content = (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-[#0c5290] to-[#0a4274] text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              BOSS Dashboard
            </p>
            <p className="text-sm font-semibold">Coach</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2">
          <div className="mb-4">
            <p className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-200/80">
              Main
            </p>
            <ul className="mt-1 space-y-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-3 py-1.5 text-sm ${
                        active
                          ? "bg-sky-500/80 text-white"
                          : "text-slate-100/90 hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-100/80">
          <p className="font-semibold">Account</p>
          <p className="text-[0.7rem] text-slate-100/70">
            Coach settings &amp; links
          </p>
        </div>
      </aside>
      <main className="flex-1 bg-slate-100 px-10 pt-10 pb-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {children}
        </div>
      </main>
    </div>
  );

  if (impersonatingCoachId) {
    return (
      <div className="flex min-h-screen flex-col">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-100 px-4 py-2 text-sm text-amber-900"
          role="banner"
        >
          <span>
            Viewing as <strong>{coachName ?? "Coach"}</strong> (Admin)
          </span>
          <button
            type="button"
            onClick={handleExit}
            className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300"
          >
            Exit coach view
          </button>
        </div>
        {content}
      </div>
    );
  }

  return content;
}
