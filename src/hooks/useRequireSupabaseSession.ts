"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildLoginUrl } from "@/lib/auth/loginReturnPath";
import { resolveSupabaseBrowserSession } from "@/lib/supabaseAccessToken";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Redirects to /login when there is no Supabase session. Uses session refresh
 * recovery so a hard refresh on mobile does not briefly show logged-out UI.
 */
export function useRequireSupabaseSession(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const wasAuthedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await resolveSupabaseBrowserSession();
      if (cancelled) return;
      if (!session?.user) {
        const returnPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : null;
        router.replace(buildLoginUrl(returnPath));
        return;
      }
      wasAuthedRef.current = true;
      setReady(true);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && wasAuthedRef.current) {
        router.replace(buildLoginUrl());
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return ready;
}
