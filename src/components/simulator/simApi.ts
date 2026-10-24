"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

export type SimApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Signed-in calls to the simulator API, as the coach (or the coach an admin is viewing as). */
export function useSimApi() {
  const { impersonatingCoachId } = useImpersonation();
  return useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<SimApiResult<T>> => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) return { ok: false, error: "Sign in again." };
      try {
        const res = await fetch(path, {
          method: init?.method ?? "GET",
          headers,
          body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!res.ok || !data) return { ok: false, error: data?.error || "Something went wrong." };
        return { ok: true, data };
      } catch {
        return { ok: false, error: "Couldn't reach the server." };
      }
    },
    [impersonatingCoachId]
  );
}

/** Raw authed fetch, for audio. */
export function useSimHeaders() {
  const { impersonatingCoachId } = useImpersonation();
  return useCallback(() => getCoachAuthHeaders(impersonatingCoachId), [impersonatingCoachId]);
}

export function useSimPrefix(): "/coach" | "/admin" {
  return usePathname()?.startsWith("/admin") ? "/admin" : "/coach";
}

export function formatSimDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
