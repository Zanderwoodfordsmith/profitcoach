"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, Filter, LogOut, MessageSquare, MessagesSquare } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";

function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  );
}
function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
}
function IconBookOpen({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-2.992.502V6H18c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 012.5 1.1V4.502A8.967 8.967 0 0018 3.75c-1.052 0-2.062.18-2.992.502A8.967 8.967 0 0012 6.042zM12 18.042a8.967 8.967 0 006-2.292c1.052 0 2.062.18 2.992.502V18H6v-1.75c.97 0 1.885.428 2.5 1.1a3.744 3.744 0 002.5 1.1 8.967 8.967 0 006-2.292zM12 18.042a8.967 8.967 0 01-6-2.292c-1.052 0-2.062.18-2.992.502V18H18v-1.75a8.968 8.968 0 00-2.5-1.1 3.744 3.744 0 00-2.5-1.1 8.967 8.967 0 01-6 2.292z" />
    </svg>
  );
}

function IconFlower({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M3 12h3m12 0h3M5.64 18.36l2.12-2.12m8.48-8.48l2.12-2.12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconAcademy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l7-3.5L12 7 5 10.5 12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5V16.5l7 3.5 7-3.5v-6M5 16.5l7 3.5 7-3.5" />
    </svg>
  );
}

const navItems = [
  { href: "/coach/signature", label: "Signature", icon: IconFlower },
  { href: "/coach/community", label: "Community", icon: MessagesSquare },
  { href: "/coach/academy", label: "Classroom", icon: IconAcademy },
  { href: "/coach/clients", label: "Clients", icon: IconBriefcase },
  { href: "/coach/income", label: "Income", icon: Banknote },
  { href: "/coach/prospects", label: "Prospects", icon: IconUserPlus },
  { href: "/coach/playbooks", label: "Playbooks", icon: IconBookOpen },
  { href: "/coach/funnel-analyzer", label: "Funnel Analyzer", icon: Filter },
  { href: "/coach/message-generator", label: "Messages", icon: MessageSquare },
];

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    impersonatingCoachId,
    clearImpersonation,
    clearContactImpersonation,
  } = useImpersonation();
  const [coachName, setCoachName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      clearImpersonation();
      clearContactImpersonation();
      await supabaseClient.auth.signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  const isImpersonatingCoach = Boolean(impersonatingCoachId);
  const isSignaturePage = pathname === "/coach/signature";

  return (
    <div className="min-h-screen bg-slate-100 pl-64 text-slate-900">
      {isImpersonatingCoach && (
        <div
          className="fixed right-3 top-3 z-[100] flex max-w-[calc(100vw-17rem)] items-center gap-1.5 rounded-lg border border-amber-300/90 bg-amber-100 py-1 pl-2 pr-1 shadow-md sm:right-5 sm:gap-2 sm:py-1 sm:pl-2.5 sm:pr-1.5"
          role="status"
          aria-label={`Viewing coach dashboard as ${coachName ?? "Coach"}`}
        >
          <span className="shrink-0 rounded bg-amber-200/90 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-amber-950 sm:text-[10px]">
            Admin
          </span>
          <span
            className="min-w-0 truncate text-[11px] font-medium text-amber-950 sm:text-xs"
            title={`Viewing as ${coachName ?? "Coach"}`}
          >
            {coachName ?? "Coach"}
          </span>
          <button
            type="button"
            onClick={handleExit}
            className="shrink-0 rounded-md bg-amber-300/80 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-400/90 sm:text-xs"
          >
            Exit
          </button>
        </div>
      )}
      <aside
        className="fixed bottom-0 left-0 top-0 z-10 flex w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-[#0c5290] to-[#0a4274] text-white"
      >
        <div className="shrink-0 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
            BOSS Dashboard
          </p>
          <p className="text-sm font-semibold">Coach</p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/coach" &&
                  Boolean(pathname?.startsWith(`${item.href}/`)));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-base ${
                      active
                        ? "bg-sky-500/80 text-white"
                        : "text-slate-100/90 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/coach/settings"
          className={`flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-4 text-sm transition-colors ${
            pathname?.startsWith("/coach/settings")
              ? "bg-sky-500/80 text-white"
              : "text-slate-100/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconCog className="h-5 w-5 shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold">Settings</span>
            <span className="text-xs opacity-80">Profile &amp; prospect link</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="flex w-full shrink-0 items-center gap-3 border-t border-white/10 px-4 py-3 text-left text-sm text-slate-100/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="font-semibold">
            {signingOut ? "Signing out…" : "Log out"}
          </span>
        </button>
      </aside>
      <main className="min-h-screen min-w-0 w-full px-6 pb-6 pt-0">
        <div
          className={`flex w-full min-w-0 flex-col ${isSignaturePage ? "max-w-none gap-0" : "gap-4"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
