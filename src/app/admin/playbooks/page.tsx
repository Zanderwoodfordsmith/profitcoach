"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PlaybooksLibrary } from "@/components/playbooks/PlaybooksLibrary";
import { CoachToolsHubTabs } from "@/components/layout/CoachToolsHubTabs";
import { supabaseClient } from "@/lib/supabaseClient";
import { PLAYBOOKS } from "@/lib/bossData";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export default function AdminPlaybooksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<PlaybookSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      const user = await getSessionUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const roleBody = (await fetchProfileRole(user.id)) as {
        role?: string;
        error?: string;
      };
      if (cancelled) return;
      if (!roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "admin") {
        router.replace("/coach");
        return;
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const summaryRes = await fetch("/api/playbooks/summary", { headers });
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

      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <PlaybooksLibrary
      summaries={summaries}
      loading={loading}
      error={error}
      title="Keep Clients"
      description="Browse the library by area. Open a playbook to edit content and manage the full overview."
      buildHref={(ref) => `/admin/playbooks/${ref}`}
      tabs={<CoachToolsHubTabs hub="coach-clients" />}
    />
  );
}
