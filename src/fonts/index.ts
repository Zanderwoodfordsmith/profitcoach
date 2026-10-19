import localFont from "next/font/local";

/**
 * Every web font the app uses, self-hosted so builds never fetch Google Fonts.
 * Files are Google's latin woff2 (variable where the family has a weight axis).
 * Import the font you need from here instead of next/font/google.
 */

export const geist = localFont({
  src: "./files/geist-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  fallback: ["system-ui", "sans-serif"],
});

export const geistMono = localFont({
  src: "./files/geist-mono-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

export const inter = localFont({
  src: "./files/inter-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  fallback: ["system-ui", "sans-serif"],
});

export const interTight = localFont({
  src: "./files/inter-tight-normal.woff2",
  weight: "100 900",
  variable: "--font-inter-tight",
  fallback: ["system-ui", "sans-serif"],
});

export const figtree = localFont({
  src: "./files/figtree-normal.woff2",
  weight: "300 900",
  variable: "--cs-font",
  fallback: ["system-ui", "sans-serif"],
});

export const outfit = localFont({
  src: "./files/outfit-normal.woff2",
  weight: "100 900",
  variable: "--font-outfit",
  fallback: ["system-ui", "sans-serif"],
});

export const plusJakartaSans = localFont({
  src: "./files/plus-jakarta-sans-normal.woff2",
  weight: "200 800",
  variable: "--font-jakarta",
  fallback: ["system-ui", "sans-serif"],
});

export const jetbrainsMono = localFont({
  src: "./files/jetbrains-mono-normal.woff2",
  weight: "100 800",
  variable: "--font-pc-ds-mono",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

export const montserrat = localFont({
  src: "./files/montserrat-normal.woff2",
  weight: "100 900",
  fallback: ["system-ui", "sans-serif"],
});

export const lato = localFont({
  src: [
    { path: "./files/lato-400.woff2", weight: "400", style: "normal" },
    { path: "./files/lato-700.woff2", weight: "700", style: "normal" },
  ],
  fallback: ["system-ui", "sans-serif"],
});

export const fraunces = localFont({
  src: [
    { path: "./files/fraunces-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./files/fraunces-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

export const caveat = localFont({
  src: "./files/caveat-normal.woff2",
  // Only the bold face was ever used; pinning it keeps the hand drawn labels bold.
  weight: "700",
  adjustFontFallback: false,
  fallback: ["cursive"],
});
