"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PlaybooksLibrary } from "@/components/playbooks/PlaybooksLibrary";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PLAYBOOKS } from "@/lib/bossData";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";

export default function CoachPlaybooksPage() {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<PlaybookSummary[]>([]);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
        error?: string;
      };
      if (cancelled) return;
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "coach" && roleBody.role !== "admin") {
        router.replace("/login");
        return;
      }
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const [summaryRes, profileRes] = await Promise.all([
        fetch("/api/playbooks/summary", { headers }),
        fetch("/api/coach/profile", { headers }),
      ]);
      if (cancelled) return;

      if (summaryRes.ok) {
        const body = (await summaryRes.json()) as { playbooks?: PlaybookSummary[] };
        setSummaries(body.playbooks ?? []);
      } else {
        const fallback: PlaybookSummary[] = PLAYBOOKS.map((p) => ({
          ref: p.ref,
          name: p.name,
          level: p.level,
          area: p.area,
          subtitle: "",
          description: "",
          playCount: 0,
        }));
        setSummaries(fallback);
      }

      if (profileRes.ok) {
        const profileBody = (await profileRes.json()) as { coach_slug?: string | null };
        setCoachSlug(profileBody.coach_slug ?? null);
      }

      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  function hrefForRef(ref: string): string {
    const q = coachSlug ? `?coach=${encodeURIComponent(coachSlug)}` : "";
    return `/playbooks/${ref}${q}`;
  }

  return (
    <PlaybooksLibrary
      summaries={summaries}
      loading={loading}
      error={error}
      title="Playbooks"
      description="Browse the full library. Open a playbook for the client-facing overview—your coach link is applied automatically when you share it."
      buildHref={hrefForRef}
    />
  );
}
