/** Unlocks speech on the click that starts the call, then plays Ava's voice later. */

let ctx: AudioContext | null = null;

export function primeCallAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext;
  if (!ctx) ctx = new AC();
  void ctx.resume();
}

export function playSpeech(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    void (async () => {
      try {
        if (!ctx) primeCallAudio();
        if (!ctx) return resolve();
        await ctx.resume();
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      } catch {
        resolve();
      }
    })();
  });
}
