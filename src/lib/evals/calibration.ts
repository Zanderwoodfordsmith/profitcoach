/**
 * Does the rubric predict results? Pure helpers for comparing scores with what
 * happened to real campaigns (acceptance for connection notes, replies for
 * follow-ups). Small samples, so every number comes with its n.
 */

/** Average ranks, ties shared. */
function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.x === order[i]!.x) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]!.i] = avg;
    i = j + 1;
  }
  return out;
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/** Spearman's rank correlation, -1 to 1. */
export function spearman(a: number[], b: number[]): number | null {
  return pearson(ranks(a), ranks(b));
}

/** Pooled rate for the top and bottom half by score, so the effect reads as percentage points. */
export function splitHalves(points: { score: number; hits: number; n: number }[]): { top: number | null; bottom: number | null; topN: number; bottomN: number } {
  const sorted = [...points].sort((a, b) => b.score - a.score);
  const half = Math.floor(sorted.length / 2);
  const pool = (xs: typeof points) => {
    const n = xs.reduce((s, p) => s + p.n, 0);
    return n ? xs.reduce((s, p) => s + p.hits, 0) / n : null;
  };
  return { top: pool(sorted.slice(0, half)), bottom: pool(sorted.slice(sorted.length - half)), topN: half, bottomN: half };
}

/** Plain features of a connection note, for the no-judge view. */
export function noteFeatures(text: string): Record<string, boolean | number> {
  const t = text.trim();
  return {
    blank: !t,
    length: t.length,
    question: /\?/.test(t),
    i_ask_because: /i ask because/i.test(t),
    number: /\d/.test(t.replace(/\{\{[^}]*\}\}/g, "")),
    link: /https?:\/\/|www\.|calendly/i.test(t),
    company_token: /\{\{\s*company\s*\}\}/i.test(t),
    says_coach: /\bcoach(ing)?\b/i.test(t),
    interest_cta: /of interest|worth a chat|open to/i.test(t),
  };
}
