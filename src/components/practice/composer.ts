"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The Blueprint's message boxes (Ava and Comments) share two behaviours: the
 * box grows with what you write, and you can speak instead of typing.
 */

const BOX_MIN_PX = 24;

/** A textarea that starts one line high and grows with its text, up to maxPx, then scrolls. */
export function useAutoGrow(value: string, maxPx: number) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, BOX_MIN_PX), maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [value, maxPx]);
  return ref;
}

/** Half the height of the element ref points at, kept up to date, for capping the box. */
export function useHalfHeight<T extends HTMLElement>(fallback = 280) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The observer reports the first size as soon as it starts watching.
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, half: height ? Math.floor(height / 2) : fallback };
}

/** Record from the microphone, turn it into text, and hand the text back. */
export function useVoiceInput(transcribe: (blob: Blob) => Promise<string | null>, onText: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    return () => recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function toggle() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setFailed(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        const said = await transcribe(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        setTranscribing(false);
        if (said) onTextRef.current(said);
        else setFailed("Could not make that out. Try again, or type it.");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setFailed("Could not use the microphone.");
    }
  }

  return { recording, transcribing, failed, toggle };
}
