"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PlaybooksLibrary } from "@/components/playbooks/PlaybooksLibrary";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { PLAYBOOKS } from "@/lib/bossData";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";

type UnlockState = Record<string, boolean>;
type AnswersMap = Record<string, 0 | 1 | 2>;

export default function ClientPlaybooksListPage() {
  const router = useRouter();
  const { impersonatingContactId } = useImpersonation();
  const [unlocks, setUnlocks] = useState<UnlockState>({});
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [summaries, setSummaries] = useState<PlaybookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingContactId) {
        headers["x-impersonate-contact-id"] = impersonatingContactId;
      }

      const [meRes, summaryRes] = await Promise.all([
        fetch("/api/client/me", { headers }),
        fetch("/api/playbooks/summary", { headers }),
      ]);

      if (cancelled) return;

      if (!meRes.ok) {
        const body = (await meRes.json().catch(() => ({}))) as { error?: string };
        setError(body?.error ?? "Unable to load.");
        setLoading(false);
        return;
      }

      const meBody = (await meRes.json()) as {
        contact?: { id: string };
        assessment?: { answers?: AnswersMap };
      };
      const cid = meBody.contact?.id ?? null;
      setAnswers(meBody.assessment?.answers ?? {});

      if (summaryRes.ok) {
        const summaryBody = (await summaryRes.json()) as { playbooks?: PlaybookSummary[] };
        setSummaries(summaryBody.playbooks ?? []);
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

      if (cid) {
        const unlocksHeaders: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (impersonatingContactId) {
          unlocksHeaders["x-impersonate-contact-id"] = impersonatingContactId;
        }
        const unlocksRes = await fetch(
          `/api/client/playbooks/unlocks?contact_id=${encodeURIComponent(cid)}`,
          { headers: unlocksHeaders }
        );
        if (unlocksRes.ok) {
          const unlocksBody = (await unlocksRes.json()) as {
            unlocks?: string[];
          };
          const map: UnlockState = {};
          for (const ref of unlocksBody.unlocks ?? []) {
            map[ref] = true;
          }
          setUnlocks(map);
        }
      }

      setLoading(false);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingContactId]);

  return (
    <PlaybooksLibrary
      summaries={summaries}
      loading={loading}
      error={error}
      eyebrow="Profit System"
      title="Playbooks"
      description="Browse the full Profit System. Unlocked playbooks are available to you; others can be unlocked by your coach."
      buildHref={(ref) => `/client/playbooks/${ref}`}
      isLocked={(ref) => !unlocks[ref]}
      getScore={(ref) => answers[ref] as 0 | 1 | 2 | undefined}
    />
  );
}
