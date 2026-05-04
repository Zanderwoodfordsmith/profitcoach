"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabaseClient } from "@/lib/supabaseClient";

export default function CoachAcademyNewLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
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
      const roleBody = (await roleRes.json().catch(() => ({}))) as { role?: string };
      if (cancelled) return;
      if (roleBody.role === "admin") {
        setAllowed(true);
      } else {
        router.replace("/coach/academy/programs");
        setAllowed(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (allowed === null) {
    return (
      <p className="text-sm text-slate-500" role="status">
        Checking access…
      </p>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
