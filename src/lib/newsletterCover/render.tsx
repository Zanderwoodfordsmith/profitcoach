import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { BACKGROUND_INFO, type CoverSpec } from "./spec";

/**
 * Draws a newsletter cover (1920 × 1080) from a template, a background and a
 * few words, with the coach's cut-out photo. Backgrounds are pre-made pictures
 * (soft light and grain baked in) because the renderer can't blur.
 */

export const COVER_W = 1920;
export const COVER_H = 1080;

const ASSETS = path.join(process.cwd(), "src/lib/newsletterCover/assets");
const cache = new Map<string, Promise<Buffer>>();
const asset = (name: string) => {
  if (!cache.has(name)) cache.set(name, readFile(path.join(ASSETS, name)));
  return cache.get(name)!;
};

export type CutOut = { src: string; width: number; height: number };

/** Fetches a cut-out PNG and reads its size from the header. */
export async function loadCutOut(url: string | null): Promise<CutOut | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
    return { src: `data:image/png;base64,${buf.toString("base64")}`, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

type Theme = { ink: string; soft: string; light: boolean };

function Person({ p, h, right, left, center }: { p: CutOut; h: number; right?: number; left?: number; center?: boolean }) {
  const w = Math.round((p.width / p.height) * h);
  const x = center ? Math.round((COVER_W - w) / 2) : left != null ? left : COVER_W - w - (right ?? 0);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x + w / 2 - 520,
          top: COVER_H - h * 0.75 - 520,
          width: 1040,
          height: 1040,
          backgroundImage: "radial-gradient(circle, rgba(110,190,255,0.55), rgba(110,190,255,0) 65%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={p.src} width={w} height={h} style={{ position: "absolute", left: x, top: COVER_H - h }} />
    </>
  );
}

const ARROW_UP = "M12 20V5M5 11l7-7 7 7";
const ARROW_DOWN = "M12 4v15M5 13l7 7 7-7";

function Badge({ up }: { up: boolean }) {
  return (
    <div style={{ width: 76, height: 76, borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "center", background: up ? "#16A34A" : "#DC2626" }}>
      <svg width="44" height="44" viewBox="0 0 24 24">
        <path d={up ? ARROW_UP : ARROW_DOWN} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** "+40%" points up, "−12%" points down, anything else has no arrow. */
function direction(value: string): boolean | null {
  const v = value.trim();
  if (/^\+/.test(v)) return true;
  if (/^[-−–]/.test(v)) return false;
  return null;
}

function Card({ label, value, up, x, y, rotate, width, light, fromRight }: { label: string; value: string; up: boolean | null; x: number; y: number; rotate: number; width?: number; light: boolean; fromRight?: boolean }) {
  if (!value.trim()) return null;
  return (
    <div
      style={{
        position: "absolute",
        // The renderer ignores `right`, so a right-hand card gets a set width and is placed from the left.
        left: fromRight ? COVER_W - x - (width ?? 470) : x,
        top: y,
        ...(width || fromRight ? { width: width ?? 470 } : {}),
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: 26,
        padding: "28px 38px",
        transform: `rotate(${rotate}deg)`,
        boxShadow: light ? "0 34px 80px rgba(5,38,74,0.22)" : "0 40px 90px rgba(0,10,30,0.5)",
      }}
    >
      {label.trim() ? <div style={{ fontSize: 32, fontWeight: 500, color: "#5B6B80" }}>{label}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 6, fontSize: 92, fontWeight: 800, letterSpacing: -2.5, color: "#0F1B2D", lineHeight: 1 }}>
        <span>{value}</span>
        {up === null ? null : <Badge up={up} />}
      </div>
    </div>
  );
}

const Mark = ({ ok, size = 120 }: { ok: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 60">
    {ok ? (
      <path d="M10 32 L25 46 L52 14" fill="none" stroke="#22C55E" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M12 12 L48 48 M48 12 L12 48" stroke="#FF4B3E" strokeWidth="9" strokeLinecap="round" />
    )}
  </svg>
);

/** The biggest size that keeps one line inside the width. Figtree Black is about 0.6 em per character. */
function fit(text: string, max: number, width: number, perChar = 0.62) {
  return Math.min(max, Math.floor(width / Math.max(1, text.length * perChar)));
}

function Behind({ w, p, t }: { w: Record<string, string>; p: CutOut | null; t: Theme }) {
  const word = w.word || "";
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 60,
          width: COVER_W,
          display: "flex",
          justifyContent: "center",
          fontSize: fit(word, 400, 1700),
          fontWeight: 900,
          letterSpacing: -18,
          lineHeight: 1,
          color: "transparent",
          backgroundImage: t.light ? "linear-gradient(180deg, #0B3E70 30%, #1F7AD0)" : "linear-gradient(180deg, #FFFFFF 35%, #A9D3FA)",
          backgroundClip: "text",
        }}
      >
        {word}
      </div>
      {p ? <Person p={p} h={840} center /> : null}
      <Card label={w.leftLabel || ""} value={w.leftValue || ""} up={direction(w.leftValue || "")} x={110} y={590} rotate={-6} light={t.light} />
      <Card label={w.rightLabel || ""} value={w.rightValue || ""} up={direction(w.rightValue || "")} x={110} y={630} rotate={5} light={t.light} fromRight />
    </>
  );
}

function Face({ w, p, t, quote }: { w: Record<string, string>; p: CutOut | null; t: Theme; quote?: boolean }) {
  const big = w.big || "";
  const words = big.split(" ");
  const last = words.pop() ?? "";
  const width = p ? 960 : 1600;
  const size = big.length > 14 ? (quote ? 160 : 190) : quote ? 190 : 230;
  return (
    <>
      {p ? <Person p={p} h={quote ? 1000 : 1010} right={quote ? 40 : 80} /> : null}
      <div style={{ position: "absolute", left: 130, top: 0, height: COVER_H, width, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {w.small ? <div style={{ fontSize: 64, fontWeight: 300, color: t.soft, lineHeight: 1.1 }}>{w.small}</div> : null}
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 20, fontSize: size, fontWeight: 900, letterSpacing: -9, lineHeight: 0.95, color: t.ink }}>
          {words.length ? <span style={{ marginRight: size * 0.25 }}>{words.join(" ")}</span> : null}
          <span style={{ color: quote ? "#1F7AD0" : t.ink }}>{last}</span>
        </div>
        {quote ? null : (
          <svg width="560" height="60" viewBox="0 0 560 60" style={{ marginTop: 14 }}>
            <path d="M10 40 C 150 10, 360 12, 550 30" fill="none" stroke="#FF4B3E" strokeWidth="14" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </>
  );
}

function Cards({ w, p, t }: { w: Record<string, string>; p: CutOut | null; t: Theme }) {
  const left = p ? 900 : 560;
  return (
    <>
      {p ? <Person p={p} h={960} left={60} /> : null}
      <Card label={w.topLabel || ""} value={w.topValue || ""} up={direction(w.topValue || "") ?? true} x={left} y={170} rotate={-3} width={760} light={t.light} />
      <Card label={w.bottomLabel || ""} value={w.bottomValue || ""} up={direction(w.bottomValue || "") ?? false} x={left + 120} y={640} rotate={2.5} width={760} light={t.light} />
      <svg width="200" height="310" viewBox="0 0 200 310" style={{ position: "absolute", left: left + 740, top: 350 }}>
        <path d="M40 10 C 170 60, 190 190, 90 280" fill="none" stroke="#FF4B3E" strokeWidth="14" strokeLinecap="round" />
        <path d="M60 232 L 88 284 L 145 266" fill="none" stroke="#FF4B3E" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
}

function XTick({ w, p, t }: { w: Record<string, string>; p: CutOut | null; t: Theme }) {
  const row = (text: string, ok: boolean, top: number) => {
    const n = ok ? 12 : 26;
    const blocks = Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ flexGrow: 1 + ((i * 7) % 3), height: 50 + ((i * 13) % 3) * 14, borderRadius: 8, backgroundImage: ok ? "linear-gradient(#5AA9E6, #0C5290)" : "linear-gradient(#F87171, #B91C1C)" }} />
    ));
    return (
      <div style={{ position: "absolute", left: 130, top, width: 1000, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <span style={{ fontSize: 170, fontWeight: 900, letterSpacing: -7, lineHeight: 0.95, color: t.ink }}>{text}</span>
          <Mark ok={ok} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            marginTop: 24,
            padding: 18,
            borderRadius: 16,
            background: t.light ? "rgba(12,82,144,0.06)" : "rgba(255,255,255,0.07)",
            border: t.light ? "1.5px solid rgba(12,82,144,0.12)" : "1.5px solid rgba(255,255,255,0.14)",
          }}
        >
          {blocks}
          {ok ? <div style={{ flexGrow: 14 }} /> : null}
        </div>
      </div>
    );
  };
  return (
    <>
      {row(w.before || "", false, 100)}
      {row(w.after || "", true, 590)}
      {p ? <Person p={p} h={960} right={40} /> : null}
    </>
  );
}

export async function renderCover(spec: CoverSpec, cutOut: CutOut | null): Promise<ImageResponse> {
  const light = BACKGROUND_INFO[spec.background].light;
  const t: Theme = light ? { ink: "#0F1B2D", soft: "#64748B", light } : { ink: "#FFFFFF", soft: "#BFD8F2", light };
  const p = spec.noPhoto ? null : cutOut;
  const [bg, f300, f500, f800, f900] = await Promise.all([
    asset(`bg-${spec.background}.jpg`),
    asset("Figtree-300.ttf"),
    asset("Figtree-500.ttf"),
    asset("Figtree-800.ttf"),
    asset("Figtree-900.ttf"),
  ]);
  const w = spec.words;
  const body =
    spec.template === "behind" ? <Behind w={w} p={p} t={t} />
    : spec.template === "face" ? <Face w={w} p={p} t={t} />
    : spec.template === "quote" ? <Face w={w} p={p} t={t} quote />
    : spec.template === "cards" ? <Cards w={w} p={p} t={t} />
    : <XTick w={w} p={p} t={t} />;

  return new ImageResponse(
    (
      <div style={{ position: "relative", width: COVER_W, height: COVER_H, display: "flex", fontFamily: "Figtree", backgroundImage: `url(data:image/jpeg;base64,${bg.toString("base64")})`, backgroundSize: "100% 100%" }}>
        {body}
      </div>
    ),
    {
      width: COVER_W,
      height: COVER_H,
      fonts: [
        { name: "Figtree", data: f300, weight: 300, style: "normal" },
        { name: "Figtree", data: f500, weight: 500, style: "normal" },
        { name: "Figtree", data: f800, weight: 800, style: "normal" },
        { name: "Figtree", data: f900, weight: 900, style: "normal" },
      ],
    },
  );
}
