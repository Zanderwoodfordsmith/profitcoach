"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAgentConversation, type AgentChatSummary } from "@/components/agent/useAgentConversation";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { AgentCoach, AgentMode } from "@/lib/agent/types";
import { deriveAiScreenContext } from "@/lib/profitCoachAi/screenContext";
import { supabaseClient } from "@/lib/supabaseClient";

import type { AvaStarterSpec } from "./AvaChat";

/**
 * One Ava conversation outside the Blueprint: who she is working for, the
 * chat itself, past chats, voice, and what she offers here. The layout holds
 * one for the whole app, so the side panel and Ava's own page share it: open
 * her full page mid-chat and the chat carries on.
 */

/**
 * What Ava offers on a new chat. Admins see exactly what coaches see (Zander,
 * 24 Oct) and name the coach in what they type, so they get the coach's view.
 */
/** The longer list behind "More ideas", grouped by area. Only jobs her skills can do today. */
const MORE_IDEAS: { group: string; prompts: string[] }[] = [
  {
    group: "Find people",
    prompts: ["Find me new prospects", "Find businesses near me on Google Maps", "Bring in people from a Sales Navigator search"],
  },
  {
    group: "Campaigns",
    prompts: [
      "Set up a new connection campaign",
      "Add my newest list to my Connector campaign",
      "Show me how my campaigns are doing",
      "Pause a campaign, or send more each day",
    ],
  },
  {
    group: "Messages and LinkedIn",
    prompts: [
      "Write the messages for my Connection campaign",
      "Write this week's LinkedIn newsletter",
      "Write a LinkedIn post about a client win",
    ],
  },
  { group: "Your Blueprint", prompts: ["Help me finish my Blueprint", "Go through my Blueprint with me"] },
  { group: "Practise and learn", prompts: ["Practise my pitch with a sceptical owner", "How do I add a list to a campaign?"] },
];

const STARTERS = [
  "Find me new prospects",
  "Add my newest list to my Connector campaign",
  "Write the messages for my Connection campaign",
  "Write this week's LinkedIn newsletter",
];

/**
 * What to offer first on the page you are on. First match wins. Only pages
 * Ava can act on: she has no Classroom or inbox skills yet.
 */
const PAGE_STARTERS: { segment: string; prompt: string }[] = [
  {
    segment: "campaigns",
    prompt: "Check my campaigns and tell me what to change",
  },
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

function useAvaSessionState(active: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const { profile } = useDashboardProfile();
  const screen = useMemo(() => deriveAiScreenContext(pathname), [pathname]);
  const [agent, setAgent] = useState<{
    mode: AgentMode;
    coach: AgentCoach | null;
  } | null>(null);
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
    if (!active) return;
    let live = true;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/agent/status", { headers }).catch(() => null);
      const body = res?.ok
        ? ((await res.json().catch(() => null)) as {
            enabled?: boolean;
            mode?: AgentMode;
            coach?: AgentCoach | null;
          } | null)
        : null;
      if (live) setAgent(body?.enabled && body.mode ? { mode: body.mode, coach: body.coach ?? null } : { mode: "coach", coach: null });
    })();
    return () => {
      live = false;
    };
  }, [active, authHeaders]);

  const loadChats = useCallback(() => {
    let live = true;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/agent/chats", { headers }).catch(() => null);
      const body = res?.ok
        ? ((await res.json().catch(() => null)) as {
            chats?: AgentChatSummary[];
          } | null)
        : null;
      if (live) setChats(body?.chats ?? []);
    })();
    return () => {
      live = false;
    };
  }, [authHeaders]);

  // Fetched again whenever a conversation starts or gets its title.
  useEffect(() => (active ? loadChats() : undefined), [active, loadChats, convo.chatId, convo.title]);

  const transcribe = useCallback(
    async (blob: Blob): Promise<string | null> => {
      const headers = await authHeaders();
      if (!headers) return null;
      const res = await fetch("/api/coach/profit-coach-ai/transcribe", {
        method: "POST",
        headers,
        body: JSON.stringify({
          audio_base64: bufferToBase64(await blob.arrayBuffer()),
        }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as {
        text?: string;
      } | null;
      return data?.text?.trim() || null;
    },
    [authHeaders],
  );

  const mode = agent?.mode ?? "coach";
  const admin = mode === "admin";
  const first = profile?.first_name?.trim() || profile?.full_name?.split(/\s+/)[0] || "";
  const subtitle = admin ? (convo.coach ? `Working on ${convo.coach.name}` : `On ${screen.label}`) : `On ${screen.label}`;

  const send = convo.send;
  const starters = useMemo<AvaStarterSpec[]>(() => {
    const here = pageStarter(pathname);
    const prompts = [...(here ? [here] : []), ...STARTERS.filter((prompt) => prompt !== here)].slice(0, 4);
    return prompts.map((prompt, i) => ({
      key: prompt,
      label: prompt,
      primary: i === 0,
      onPick: () => void send(prompt),
    }));
  }, [send, pathname]);

  const moreIdeas = useMemo(
    () =>
      MORE_IDEAS.map((g) => ({
        group: g.group,
        starters: g.prompts.map<AvaStarterSpec>((prompt) => ({ key: prompt, label: prompt, onPick: () => void send(prompt) })),
      })),
    [send],
  );

  return {
    agent,
    moreIdeas,
    convo,
    chats,
    loadChats,
    transcribe,
    starters,
    subtitle,
    admin,
    first,
    greeting: first ? `Hi ${first}, I'm Ava` : "Hi, I'm Ava",
    intro:
      "I find prospects, build lists, set up campaigns and write your messages from your Blueprint. Anything that sends, spends money or removes people waits for your OK.",
    placeholder: "Ask Ava, or tell her what to do",
    draft,
    setDraft,
  };
}

export type AvaSession = ReturnType<typeof useAvaSessionState>;

const AvaSessionContext = createContext<{ session: AvaSession; activate: () => void } | null>(null);

/** Holds Ava's one conversation for the app. Nothing loads until Ava is first opened. */
export function AvaSessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const session = useAvaSessionState(active);
  const activate = useCallback(() => setActive(true), []);
  const value = useMemo(() => ({ session, activate }), [session, activate]);
  return <AvaSessionContext.Provider value={value}>{children}</AvaSessionContext.Provider>;
}

/** The shared Ava conversation. Mounting a component that uses it wakes Ava up. */
export function useAvaSession(): AvaSession {
  const ctx = useContext(AvaSessionContext);
  if (!ctx) throw new Error("useAvaSession needs AvaSessionProvider (the coach and admin layouts have it)");
  const { activate } = ctx;
  useEffect(() => activate(), [activate]);
  return ctx.session;
}
