"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  fetchCachedProfileRole,
  peekProfileRole,
} from "@/lib/getClients/cachedProfileRole";

/**
 * Admin Get Clients pages used to block on /api/profile-role every visit.
 * Cached hits paint the hub immediately and revalidate in the background.
 */
export function useRequireAdminRole(redirectTo = "/coach") {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const cachedRole =
    userId && peekProfileRole(userId)?.role === "admin" ? "admin" : null;
  const [checking, setChecking] = useState(!cachedRole);
  const [allowed, setAllowed] = useState(cachedRole === "admin");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!cancelled) setUserId(user.id);
      const peeked = peekProfileRole(user.id);
      if (peeked?.role === "admin") {
        if (!cancelled) {
          setAllowed(true);
          setChecking(false);
        }
      } else if (peeked?.role && peeked.role !== "admin") {
        router.replace(redirectTo);
        return;
      }

      try {
        const roleBody = await fetchCachedProfileRole(user.id, {
          force: peeked?.role !== "admin",
        });
        if (cancelled) return;
        if (roleBody.role !== "admin") {
          router.replace(redirectTo);
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled && peeked?.role !== "admin") {
          setAllowed(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  return { allowed, checking };
}
