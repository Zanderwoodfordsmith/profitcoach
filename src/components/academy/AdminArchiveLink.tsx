"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";
import { usePathname } from "next/navigation";

import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Quiet admin-only entry to the "Not in Classroom" archive.
 * Hidden from coaches — no Programmes tab in the Classroom chrome.
 */
export function AdminArchiveLink() {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [visible, setVisible] = useState(prefix === "/admin");

  useEffect(() => {
    if (prefix === "/admin") {
      setVisible(true);
      return;
    }
    let cancelled = false;
    async function check() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (!cancelled) setVisible(roleBody.role === "admin");
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  if (!visible) return null;

  return (
    <Link
      href="/admin/academy/archive"
      title="Lessons not on Classroom (admin)"
      aria-label="Open archive of lessons not on Classroom"
      className="fixed bottom-5 right-5 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-400 shadow-sm backdrop-blur-md transition hover:border-slate-300 hover:bg-white hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <Archive className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
