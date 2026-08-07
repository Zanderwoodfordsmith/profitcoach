/**
 * Deterministic decorative waveform bars for lesson audio scrubbers.
 * Looks like a real waveform without needing peak analysis files.
 */
export function buildLessonWaveformBars(
  seed: string,
  count = 64
): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = (h >>> 0) / 0xffffffff;
    // Bias toward mid-height with some peaks — more “music-like”.
    const wave = 0.28 + 0.55 * Math.sin((i / count) * Math.PI * 3.2 + n * 2);
    const jitter = 0.15 + n * 0.7;
    bars.push(Math.min(1, Math.max(0.12, wave * jitter)));
  }
  return bars;
}
