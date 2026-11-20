"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import { getSessionUser } from "@/lib/supabaseAccessToken";

/** How long "typing…" stays up after the last key, and how often we re-send it. */
const SHOW_MS = 6_000;
const RESEND_MS = 2_500;

type Typer = { name: string; at: number };

/**
 * Live "X is typing…" for one Support chat, both ways (coach ↔ BCA), over a
 * Supabase broadcast channel: nothing is saved. When someone sends, the other
 * side gets `onOtherSent` so the new message shows without a reload.
 */
export function useSupportTyping(reportId: string | null | undefined, onOtherSent?: () => void) {
  const [typers, setTypers] = useState<Record<string, Typer>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<{ id: string; name: string } | null>(null);
  const lastSentRef = useRef(0);
  const onOtherSentRef = useRef(onOtherSent);
  useEffect(() => {
    onOtherSentRef.current = onOtherSent;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!user || cancelled) return;
      const { data } = await supabaseClient
        .from("profiles")
        .select("first_name, full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name =
        (data?.first_name as string | null)?.trim() ||
        (data?.full_name as string | null)?.trim().split(/\s+/)[0] ||
        "Someone";
      if (!cancelled) meRef.current = { id: user.id, name };
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reportId) return;
    const channel = supabaseClient.channel(`support-typing:${reportId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { id?: string; name?: string; stop?: boolean };
        if (!p.id || p.id === meRef.current?.id) return;
        const id = p.id;
        setTypers((current) => {
          const next = { ...current };
          if (p.stop) delete next[id];
          else next[id] = { name: p.name || "Someone", at: Date.now() };
          return next;
        });
      })
      .on("broadcast", { event: "sent" }, ({ payload }) => {
        const p = payload as { id?: string };
        if (!p.id || p.id === meRef.current?.id) return;
        const id = p.id;
        setTypers((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        onOtherSentRef.current?.();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      setTypers({});
      void supabaseClient.removeChannel(channel);
    };
  }, [reportId]);

  // Drop anyone who stopped typing without sending.
  const typing = Object.keys(typers).length > 0;
  useEffect(() => {
    if (!typing) return;
    const id = window.setInterval(() => {
      const cutoff = Date.now() - SHOW_MS;
      setTypers((current) => {
        const kept = Object.fromEntries(Object.entries(current).filter(([, t]) => t.at > cutoff));
        return Object.keys(kept).length === Object.keys(current).length ? current : kept;
      });
    }, 1_000);
    return () => window.clearInterval(id);
  }, [typing]);

  /** Call on every key in the box; sends at most every few seconds. */
  const notifyTyping = useCallback(() => {
    const me = meRef.current;
    const channel = channelRef.current;
    if (!me || !channel) return;
    const now = Date.now();
    if (now - lastSentRef.current < RESEND_MS) return;
    lastSentRef.current = now;
    void channel.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.name } });
  }, []);

  /** Call after a message is sent: clears "typing…" and tells the other side to reload. */
  const notifySent = useCallback(() => {
    const me = meRef.current;
    const channel = channelRef.current;
    lastSentRef.current = 0;
    if (!me || !channel) return;
    void channel.send({ type: "broadcast", event: "sent", payload: { id: me.id } });
  }, []);

  const names = Object.values(typers).map((t) => t.name);
  return { typingNames: names, notifyTyping, notifySent };
}

/** "Pam is typing…" with three soft dots; nothing when no one is. */
export function SupportTypingLine({ names, className = "" }: { names: string[]; className?: string }) {
  if (!names.length) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <p className={`flex items-center gap-1.5 text-xs text-slate-500 ${className}`} aria-live="polite">
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-slate-400" />
      </span>
      {who} {names.length === 1 ? "is" : "are"} typing…
    </p>
  );
}
