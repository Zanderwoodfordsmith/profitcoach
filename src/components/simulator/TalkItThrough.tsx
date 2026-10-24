"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Loader2, PhoneOff } from "lucide-react";

import { AvaOrb } from "@/components/ava/AvaKit";
import { figtree } from "@/fonts";
import type { CallStart } from "@/lib/simulator/types";

import { useSimApi } from "./simApi";
import "./sim.css";

/** Ava talks the coach through their report by voice, in the navy room. */
export function TalkItThrough(props: { sessionId: string; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ConversationProvider>
      <Talk {...props} />
    </ConversationProvider>,
    document.body
  );
}

function Talk({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const api = useSimApi();
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const { startSession, endSession, status, isSpeaking } = useConversation({
    onMessage: ({ message, source }) => {
      if (source !== "user" && message.trim()) setCaption(message.trim());
    },
    onError: (message) => setError(typeof message === "string" ? message : "The voice line had a problem."),
  });

  const once = useRef(false);
  const hangUp = useRef<number | null>(null);
  useEffect(() => {
    // The hang-up waits a tick so React's dev double-mount doesn't end the call.
    if (hangUp.current !== null) {
      window.clearTimeout(hangUp.current);
      hangUp.current = null;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cleanup = () => {
      document.body.style.overflow = previous;
      hangUp.current = window.setTimeout(() => endSession(), 0);
    };
    if (once.current) return cleanup;
    once.current = true;
    void (async () => {
      const res = await api<{ call: CallStart }>(`/api/coach/simulator/sessions/${sessionId}/talk`, { method: "POST" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const call = res.data.call;
      try {
        startSession({
          signedUrl: call.signedUrl,
          connectionType: "websocket",
          overrides: {
            agent: { prompt: { prompt: call.prompt }, firstMessage: call.firstMessage, language: "en" },
            tts: { voiceId: call.voiceId, speed: call.speed },
          },
        });
      } catch {
        setError("Couldn't start the call. Check your microphone is allowed.");
      }
    })();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = status === "connected";
  return (
    <div className={`sim ava-ui ${figtree.className} fixed inset-0 z-[100]`} role="dialog" aria-modal="true" aria-label="Feedback with Ava">
      <div className="sim-room flex h-full flex-col items-center justify-center px-6">
        <AvaOrb size={150} motion state={!connected ? "quiet" : isSpeaking ? "speaking" : "listening"} />
        <p className="mt-8 text-[clamp(1.6rem,3vw,2.4rem)] font-light tracking-[-0.02em]">Ava</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-[var(--sim-cream-soft)]" aria-live="polite">
          {error ? null : !connected ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {error ?? (!connected ? "Connecting…" : isSpeaking ? "Speaking" : "Listening")}
        </p>
        <div className="mt-8 min-h-[5em] max-w-2xl text-center">
          {caption ? (
            <p key={caption} className="sim-caption">
              {caption}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="sim-pill sim-pill-solid mt-10"
          onClick={() => {
            endSession();
            onClose();
          }}
        >
          <PhoneOff className="h-4 w-4" aria-hidden /> Finish
        </button>
      </div>
    </div>
  );
}
