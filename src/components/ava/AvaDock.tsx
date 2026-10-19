"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Maximize2, X } from "lucide-react";

import { useAgentConversation, type AgentChatSummary } from "@/components/agent/useAgentConversation";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { AgentCoach, AgentMode } from "@/lib/agent/types";
import { deriveAiScreenContext } from "@/lib/profitCoachAi/screenContext";
import { supabaseClient } from "@/lib/supabaseClient";

import { AvaChat, type AvaStarterSpec } from "./AvaChat";
import { AvaAction, AvaOrb, AvaRoomProvider } from "./AvaKit";
import { AvaStage } from "./AvaStage";

/**
 * Ava everywhere outside the Blueprint. Opened from the top bar, she floats
 * over the right of the page (the page never moves) and can go full screen.
 * Same conversation, same parts, as Ava in the Blueprint.
 */

const STARTERS: Record<AgentMode, string[]> = {
  admin: [
    "Find prospects for a coach",
    "Set up a Connection campaign from a coach's blueprint",
    "Add a coach's newest list to their Connector campaign",
    "Turn a coach's campaign up a notch",
  ],
  coach: [
    "Find me new prospects",
    "Add my newest list to my Connector campaign",
    "Write the messages for my Connection campaign",
    "Write this week's LinkedIn newsletter",
  ],
};

/**
 * What to offer first on the page you are on. First match wins. Only pages
 * Ava can act on: she has no Classroom or inbox skills yet.
 */
const PAGE_STARTERS: { segment: string; prompt: string }[] = [
  { segment: "campaigns", prompt: "Check my campaigns and tell me what to change" },
  { segment: "prospects", prompt: "Find me new prospects" },
  { segment: "lead-finder", prompt: "How do I import from Sales Navigator?" },
  { segment: "newsletter", prompt: "Write this week's LinkedIn newsletter" },
];

function pageStarter(pathname: string): string | null {
  const parts = pathname.split("/");
  return PAGE_STARTERS.find((rule) => parts.includes(rule.segment))?.prompt ?? null;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function AvaDock({
  fullscreen,
  onToggleFullscreen,
  onClose,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { profile } = useDashboardProfile();
  const screen = useMemo(() => deriveAiScreenContext(pathname), [pathname]);
  const [agent, setAgent] = useState<{ mode: AgentMode; coach: AgentCoach | null } | null>(null);
  const [chats, setChats] = useState<AgentChatSummary[] | null>(null);
  const [draft, setDraft] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) headers["x-impersonate-coach-id"] = impersonatingCoachId;
    return headers;
  }, [impersonatingCoachId]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const convo = useAgentConversation({
    authHeaders,
    screenPath: pathname,
    defaultCoach: agent?.coach ?? null,
    onWrote: refresh,
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/agent/status", { headers }).catch(() => null);
      const body = res?.ok
        ? ((await res.json().catch(() => null)) as { enabled?: boolean; mode?: AgentMode; coach?: AgentCoach | null } | null)
        : null;
      if (live) setAgent(body?.enabled && body.mode ? { mode: body.mode, coach: body.coach ?? null } : { mode: "coach", coach: null });
    })();
    return () => {
      live = false;
    };
  }, [authHeaders]);

  const loadChats = useCallback(() => {
    let live = true;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/agent/chats", { headers }).catch(() => null);
      const body = res?.ok ? ((await res.json().catch(() => null)) as { chats?: AgentChatSummary[] } | null) : null;
      if (live) setChats(body?.chats ?? []);
    })();
    return () => {
      live = false;
    };
  }, [authHeaders]);

  // Fetched again whenever a conversation starts or gets its title.
  useEffect(() => loadChats(), [loadChats, convo.chatId, convo.title]);

  // Escape: full screen docks (the stage handles that), docked closes.
  useEffect(() => {
    if (fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, onClose]);

  const transcribe = useCallback(
    async (blob: Blob): Promise<string | null> => {
      const headers = await authHeaders();
      if (!headers) return null;
      const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
        method: "POST",
        headers,
        body: JSON.stringify({ audio_base64: bufferToBase64(await blob.arrayBuffer()) }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { text?: string } | null;
      return data?.text?.trim() || null;
    },
    [authHeaders]
  );

  const mode = agent?.mode ?? "coach";
  const admin = mode === "admin";
  const first = profile?.first_name?.trim() || profile?.full_name?.split(/\s+/)[0] || "";
  const subtitle = admin
    ? convo.coach
      ? `Working on ${convo.coach.name}`
      : `On ${screen.label}`
    : `On ${screen.label}`;

  const send = convo.send;
  const starters = useMemo<AvaStarterSpec[]>(() => {
    const here = admin ? null : pageStarter(pathname);
    const prompts = [...(here ? [here] : []), ...STARTERS[mode].filter((prompt) => prompt !== here)].slice(0, 4);
    return prompts.map((prompt, i) => ({ key: prompt, label: prompt, primary: i === 0, onPick: () => void send(prompt) }));
  }, [admin, send, mode, pathname]);

  const chat = (headerSlot: HTMLElement | null) => (
    <AvaChat
      convo={convo}
      transcribe={transcribe}
      chats={chats}
      greeting={first ? `Hi ${first}, I'm Ava` : "Hi, I'm Ava"}
      intro={
        admin
          ? "Tell me what to do and for which coach. I work on lists, campaigns, messages and Blueprints. Anything that sends, spends money or removes people waits for your OK."
          : "I find prospects, build lists, set up campaigns and write your messages from your Blueprint. Anything that sends, spends money or removes people waits for your OK."
      }
      starters={starters}
      footnote="Or ask me anything below."
      showCoach={admin}
      placeholder={admin ? "Tell me what to do, and for which coach" : "Ask Ava, or tell her what to do"}
      draft={draft}
      setDraft={setDraft}
      headerSlot={headerSlot}
      onHistory={loadChats}
      onNavigate={fullscreen ? onToggleFullscreen : undefined}
    />
  );

  if (fullscreen) {
    return (
      <AvaStage subtitle={subtitle} onDock={onToggleFullscreen} onClose={onClose}>
        {(slot) => (agent ? chat(slot) : null)}
      </AvaStage>
    );
  }

  return (
    <AvaRoomProvider room="panel">
      <button type="button" aria-label="Close Ava" onClick={onClose} className="fixed inset-0 z-[94] bg-[#051e36]/35 md:hidden" />
      <aside
        aria-label="Ava"
        className="ava-ui ava-dock fixed z-[95] flex flex-col overflow-hidden bg-white max-md:inset-x-0 max-md:bottom-0 max-md:h-[88dvh] max-md:rounded-t-3xl max-md:shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)] md:bottom-3 md:right-3 md:top-[4.25rem] md:w-[26rem] md:rounded-2xl md:border md:border-[#dde6ef] md:shadow-[0_28px_60px_-28px_rgba(5,30,54,0.5),0_4px_12px_-6px_rgba(5,30,54,0.12)]"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--ava-rule)] px-3 py-2.5">
          <AvaOrb size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold text-[var(--ava-ink)]">Ava</p>
            <p className="truncate text-xs text-[var(--ava-faint)]">{subtitle}</p>
          </div>
          <span className="max-md:hidden">
            <AvaAction iconOnly icon={<Maximize2 className="h-4 w-4" aria-hidden />} label="Full screen" onClick={onToggleFullscreen} />
          </span>
          <AvaAction iconOnly icon={<X className="h-4 w-4" aria-hidden />} label="Close Ava" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1">
          {agent ? (
            chat(null)
          ) : (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--ava-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening Ava…
            </p>
          )}
        </div>
      </aside>
    </AvaRoomProvider>
  );
}
