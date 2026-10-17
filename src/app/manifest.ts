import type { MetadataRoute } from "next";

/** Installable app ("Add to Home Screen"). Needed for push alerts on iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profit Coach",
    short_name: "Profit Coach",
    description: "Your coaching practice, with Ava's alerts when prospects reply.",
    start_url: "/coach/today",
    scope: "/",
    display: "standalone",
    background_color: "#051e36",
    theme_color: "#0c5290",
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
