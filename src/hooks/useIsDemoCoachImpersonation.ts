"use client";

import { useEffect, useState } from "react";
import { resolveCoachIdBySlug } from "@/lib/demoCoach";
import { demoCoachToggleUserForEmail } from "@/lib/demoCoachToggle";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * True when the signed-in admin is impersonating their own one-click demo
 * coach (Zander Demo / Pam Demo). Jumping into someone else's staff demo
 * still shows the generic impersonation banner. Wait for `ready` before
 * showing that banner so it does not flash on your own demo.
 */
export function useIsDemoCoachImpersonation(
  impersonatingCoachId: string | null
): { ready: boolean; isDemoCoach: boolean } {
  const [ready, setReady] = useState(!impersonatingCoachId);
  const [isDemoCoach, setIsDemoCoach] = useState(false);

  useEffect(() => {
    if (!impersonatingCoachId) {
      setIsDemoCoach(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      const toggleUser = demoCoachToggleUserForEmail(user?.email);
      if (!toggleUser) {
        setIsDemoCoach(false);
        setReady(true);
        return;
      }
      const demoCoachId = await resolveCoachIdBySlug(toggleUser.coachSlug);
      if (cancelled) return;
      setIsDemoCoach(Boolean(demoCoachId && demoCoachId === impersonatingCoachId));
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  return { ready, isDemoCoach };
}
