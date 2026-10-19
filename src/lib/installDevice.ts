import { useSyncExternalStore } from "react";

/** Which add-to-home-screen path a browser gets. "ios-chrome" covers Chrome, Edge and Firefox on iPhone; "ios-other" = an in-app browser (LinkedIn, Gmail, Google app) that can't add to the home screen. */
export type InstallDevice = "installed" | "ios-safari" | "ios-chrome" | "ios-other" | "android" | "desktop";

export function detectInstallDevice(): InstallDevice {
  if (typeof window === "undefined") return "desktop";
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true) {
    return "installed";
  }
  const ua = nav.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (ios) {
    if (/FBAN|FBAV|Instagram|LinkedInApp|GSA\/|Line\/|Twitter|GmailApp/.test(ua)) return "ios-other";
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return "ios-chrome";
    return "ios-safari";
  }
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const noSubscribe = () => () => {};

/** The device on the client, null during server render (so nothing device-specific flashes). */
export function useInstallDevice(): InstallDevice | null {
  return useSyncExternalStore<InstallDevice | null>(noSubscribe, detectInstallDevice, () => null);
}
