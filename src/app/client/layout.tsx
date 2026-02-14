"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const navItems = [
  { href: "/client/dashboard", label: "Dashboard" },
  { href: "/client/playbooks", label: "Playbooks" },
  { href: "/client/goals", label: "Goals" },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingContactId, clearContactImpersonation } = useImpersonation();
  const [checking, setChecking] = useState(true);
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

  const content = (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-sky-600 to-sky-800 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              Profit System
            </p>
            <p className="text-sm font-semibold">Client</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2">
          <div className="mb-4">
            <p className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-200/80">
              Main
            </p>
            <ul className="mt-1 space-y-0.5">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/client/dashboard" && pathname?.startsWith(item.href + "/"));
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
          <p className="text-[0.7rem] text-slate-100/70">Client dashboard</p>
        </div>
      </aside>
      <main className="flex-1 bg-slate-100 px-10 pt-10 pb-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {children}
        </div>
      </main>
    </div>
  );

  if (impersonatingContactId) {
    return (
      <div className="flex min-h-screen flex-col">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-100 px-4 py-2 text-sm text-amber-900"
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
        {content}
      </div>
    );
  }

  return content;
}
