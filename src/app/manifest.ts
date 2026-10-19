import type { MetadataRoute } from "next";

/** Lets members add the app to their phone's home screen and open it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Profit Coach",
    short_name: "Profit Coach",
    description: "Your Profit Coach practice, Classroom and Vault.",
    start_url: "/coach",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0c5290",
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/app-icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
