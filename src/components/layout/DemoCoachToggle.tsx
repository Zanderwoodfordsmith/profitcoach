"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveCoachIdBySlug } from "@/lib/demoCoach";
import {
  demoCoachToggleUserForEmail,
  pathAfterDemoCoachToggle,
  type DemoCoachToggleUser,
} from "@/lib/demoCoachToggle";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  /** Sidebar collapsed — show a compact chip on the avatar instead. */
  compact?: boolean;
  className?: string;
};

export function DemoCoachToggle({ compact = false, className = "" }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingCoachId, clearImpersonation } =
    useImpersonation();
  const [toggleUser, setToggleUser] = useState<DemoCoachToggleUser | null>(
    null
  );
  const [demoCoachId, setDemoCoachId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      const userConfig = demoCoachToggleUserForEmail(user?.email);
      setToggleUser(userConfig);
      if (!userConfig) {
        setDemoCoachId(null);
        return;
      }
      const id = await resolveCoachIdBySlug(userConfig.coachSlug);
      if (!cancelled) setDemoCoachId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!toggleUser) return null;

  const isDemoMode =
    Boolean(demoCoachId) && impersonatingCoachId === demoCoachId;
  const label = isDemoMode ? "Admin" : toggleUser.label;

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      if (isDemoMode) {
        clearImpersonation();
        router.push(pathAfterDemoCoachToggle(pathname ?? "/admin", "admin"));
        return;
      }

      let coachId = demoCoachId;
      if (!coachId) {
        coachId = await resolveCoachIdBySlug(toggleUser!.coachSlug);
        setDemoCoachId(coachId);
      }
      if (!coachId) {
        setError(`${toggleUser!.label} not found.`);
        return;
      }

      setImpersonatingCoachId(coachId);
      router.push(pathAfterDemoCoachToggle(pathname ?? "/admin", "coach"));
    } finally {
      setBusy(false);
    }
  }

  const baseClass =
    "inline-flex shrink-0 items-center gap-0.5 rounded-full border font-medium transition-colors disabled:opacity-60";
  const sizeClass = compact
    ? "px-1.5 py-0.5 text-[9px] leading-none"
    : "px-1.5 py-0.5 text-[10px] leading-tight";
  const toneClass = isDemoMode
    ? "border-amber-200/80 bg-amber-100/95 text-amber-950 hover:bg-amber-50"
    : "border-white/25 bg-white/15 text-white hover:bg-white/25";

  return (
    <span className={className}>
      <button
        type="button"
        onClick={(e) => void handleToggle(e)}
        disabled={busy}
        title={
          isDemoMode
            ? "Switch back to admin"
            : `Switch to ${toggleUser.label}`
        }
        aria-pressed={isDemoMode}
        className={`${baseClass} ${sizeClass} ${toneClass}`}
      >
        {busy ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
        ) : null}
        {label}
      </button>
      {error && !compact ? (
        <span className="mt-0.5 block text-[9px] leading-tight text-rose-200">
          {error}
        </span>
      ) : null}
    </span>
  );
}
