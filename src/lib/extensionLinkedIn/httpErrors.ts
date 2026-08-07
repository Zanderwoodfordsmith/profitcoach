import type { ExtensionLinkedInAuth } from "@/lib/extensionLinkedIn/access";

export function extensionAuthErrorPayload(auth: ExtensionLinkedInAuth) {
  return {
    error: auth.error ?? "Unauthorized",
    code:
      auth.error === "Feature not available for your access tier."
        ? "tier_required"
        : auth.error === "Extension not enabled for this account yet."
          ? "allowlist"
          : auth.error === "Pick a coach to act as."
            ? "need_coach"
            : "auth",
    coaches: auth.coaches,
    upgradePath: "/coach/membership",
  };
}
