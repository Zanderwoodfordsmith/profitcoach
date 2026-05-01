"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}
function IconFlag({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M3 21V3m0 0h4.5m13.5 0v9a2.25 2.25 0 01-2.25 2.25H12m-9-6h6.75c.621 0 1.125.504 1.125 1.125v3.75M3 3l9 6 9-6" />
    </svg>
  );
}
function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const navItems = [
  { href: "/client/dashboard", label: "Dashboard", icon: IconChart },
  { href: "/client/playbooks", label: "Playbooks", icon: IconBook },
  { href: "/client/goals", label: "Goals", icon: IconFlag },
  { href: "/client/ai-coach", label: "AI Coach", icon: IconChat },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    impersonatingContactId,
    clearContactImpersonation,
    clearImpersonation,
  } = useImpersonation();
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [impersonatingContactName, setImpersonatingContactName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setChecking(true);
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
        setChecking(false);
        return;
      }

      setRole(roleBody.role);

      if (impersonatingContactId) {
        if (roleBody.role === "admin" || roleBody.role === "coach") {
          const {
            data: { session },
          } = await supabaseClient.auth.getSession();
          if (session?.access_token) {
            const meRes = await fetch("/api/client/me", {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "x-impersonate-contact-id": impersonatingContactId,
              },
            });
            if (cancelled) return;
            if (meRes.ok) {
              const meBody = (await meRes.json()) as {
                contact?: { full_name?: string | null };
              };
              setImpersonatingContactName(
                meBody.contact?.full_name ?? "Client"
              );
            }
          }
          setChecking(false);
          return;
        }
      }

      if (roleBody.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (roleBody.role === "coach") {
        router.replace("/coach");
        return;
      }

      if (cancelled) return;

      if (roleBody.role !== "client") {
        setError("You do not have access to the client portal.");
      }

      setChecking(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  function handleExitClientView() {
    clearContactImpersonation();
    router.push(role === "admin" ? "/admin" : "/coach");
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

  const hasBanner = Boolean(impersonatingContactId);
  const sidebarTop = hasBanner ? "top-12" : "top-0";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {hasBanner && (
        <div
          className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-100 px-4 py-2 text-sm text-amber-900"
          role="banner"
        >
          <span>
            Viewing as <strong>{impersonatingContactName ?? "Client"}</strong>{" "}
            ({role === "admin" ? "Admin" : "Coach"})
          </span>
          <button
            type="button"
            onClick={handleExitClientView}
            className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-300"
          >
            Exit client view
          </button>
        </div>
      )}
      <aside
        className={`fixed left-0 bottom-0 z-10 flex w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-[#0c5290] to-[#0a4274] text-white ${sidebarTop}`}
        style={{ height: hasBanner ? "calc(100vh - 3rem)" : "100vh" }}
      >
        <div className="shrink-0 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
            Profit System
          </p>
          <p className="text-sm font-semibold">Client</p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/client/dashboard" &&
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
        <div className="shrink-0 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-4 text-sm text-slate-100/80">
            <IconCog className="h-5 w-5 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">Account</span>
              <span className="text-xs opacity-80">Client dashboard</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3 text-left text-sm text-slate-100/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="font-semibold">
              {signingOut ? "Signing out…" : "Log out"}
            </span>
          </button>
        </div>
      </aside>
      <main
        className={
          pathname === "/client/ai-coach"
            ? "min-h-screen"
            : "min-h-screen px-6 pb-6"
        }
        style={{
          marginLeft: "16rem",
          // Only offset when the impersonation banner is fixed at the top; no extra gap otherwise.
          paddingTop: hasBanner ? "3rem" : 0,
        }}
      >
        <div
          className={
            pathname === "/client/ai-coach"
              ? "flex min-h-[calc(100vh-6rem)] flex-col"
              : "flex w-full flex-col gap-4"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
