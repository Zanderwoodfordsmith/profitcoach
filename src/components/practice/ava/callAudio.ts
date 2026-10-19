/** Unlocks speech on the click that starts the call, then plays Ava's voice later. */

/** Ava's voice plays a little faster than VocalLab's natural pace, at the same pitch. */
const SPEECH_RATE = 1.12;

/** A tiny silent WAV, played on the click so the browser lets this element speak later. */
const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let ctx: AudioContext | null = null;
let player: HTMLAudioElement | null = null;

export function primeCallAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext;
  if (!ctx) ctx = new AC();
  void ctx.resume();
  if (!player) {
    player = new Audio();
    player.preservesPitch = true;
    player.src = SILENCE;
    void player.play().catch(() => {});
  }
}

function playOnElement(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    if (!player) return resolve(false);
    const el = player;
    const url = URL.createObjectURL(blob);
    const done = (ok: boolean) => {
      el.onended = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    el.onended = () => done(true);
    el.onerror = () => done(false);
    el.src = url;
    el.preservesPitch = true;
    el.playbackRate = SPEECH_RATE;
    el.play().catch(() => done(false));
  });
}

async function playOnContext(blob: Blob): Promise<void> {
  if (!ctx) primeCallAudio();
  if (!ctx) return;
  await ctx.resume();
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  await new Promise<void>((resolve) => {
    source.onended = () => resolve();
    source.start();
  });
}

export function playSpeech(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    void (async () => {
      try {
        if (!(await playOnElement(blob))) await playOnContext(blob);
      } catch {
        // Silent failure: the question is on screen too.
      }
      resolve();
    })();
  });
}
