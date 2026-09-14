"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveCoachIdBySlug } from "@/lib/demoCoach";
import {
  demoCoachToggleUserForEmail,
  pathAfterDemoCoachToggle,
  staffDemosAccessibleToEmail,
  type DemoCoachToggleUser,
} from "@/lib/demoCoachToggle";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  /** Sidebar collapsed — show a compact chip on the avatar instead. */
  compact?: boolean;
  className?: string;
  /** Account-menu rows instead of the avatar chip. */
  variant?: "chip" | "menu";
  onAction?: () => void;
};

function useStaffDemoSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const { impersonatingCoachId, setImpersonatingCoachId, clearImpersonation } =
    useImpersonation();
  const [ownDemo, setOwnDemo] = useState<DemoCoachToggleUser | null>(null);
  const [demos, setDemos] = useState<DemoCoachToggleUser[]>([]);
  const [idsBySlug, setIdsBySlug] = useState<Record<string, string | null>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (cancelled) return;
      const accessible = staffDemosAccessibleToEmail(user?.email);
      const own = demoCoachToggleUserForEmail(user?.email);
      setOwnDemo(own);
      setDemos(accessible);
      if (accessible.length === 0) {
        setIdsBySlug({});
        return;
      }
      const entries = await Promise.all(
        accessible.map(async (demo) => {
          const id = await resolveCoachIdBySlug(demo.coachSlug);
          return [demo.coachSlug, id] as const;
        })
      );
      if (!cancelled) {
        setIdsBySlug(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDemo =
    demos.find((demo) => {
      const id = idsBySlug[demo.coachSlug];
      return Boolean(id) && id === impersonatingCoachId;
    }) ?? null;
  const isOwnDemoMode =
    Boolean(ownDemo) &&
    Boolean(idsBySlug[ownDemo!.coachSlug]) &&
    impersonatingCoachId === idsBySlug[ownDemo!.coachSlug];

  async function exitToAdmin() {
    clearImpersonation();
    router.push(pathAfterDemoCoachToggle(pathname ?? "/admin", "admin"));
  }

  async function enterDemo(demo: DemoCoachToggleUser) {
    let coachId = idsBySlug[demo.coachSlug] ?? null;
    if (!coachId) {
      coachId = await resolveCoachIdBySlug(demo.coachSlug);
      setIdsBySlug((prev) => ({ ...prev, [demo.coachSlug]: coachId }));
    }
    if (!coachId) {
      setError(`${demo.label} not found.`);
      return false;
    }
    setImpersonatingCoachId(coachId);
    router.push(pathAfterDemoCoachToggle(pathname ?? "/admin", "coach"));
    return true;
  }

  async function handleSelect(demo: DemoCoachToggleUser) {
    if (busySlug) return;
    const alreadyActive =
      Boolean(idsBySlug[demo.coachSlug]) &&
      impersonatingCoachId === idsBySlug[demo.coachSlug];
    setBusySlug(demo.coachSlug);
    setError(null);
    try {
      if (alreadyActive) {
        await exitToAdmin();
        return;
      }
      await enterDemo(demo);
    } finally {
      setBusySlug(null);
    }
  }

  async function handleExit() {
    if (busySlug) return;
    setBusySlug("admin");
    setError(null);
    try {
      await exitToAdmin();
    } finally {
      setBusySlug(null);
    }
  }

  return {
    ownDemo,
    demos,
    activeDemo,
    isOwnDemoMode,
    busySlug,
    error,
    impersonatingCoachId,
    handleSelect,
    handleExit,
  };
}

export function DemoCoachToggle({
  compact = false,
  className = "",
  variant = "chip",
  onAction,
}: Props) {
  const state = useStaffDemoSwitch();
  const { demos, ownDemo, error } = state;

  if (demos.length === 0) return null;

  if (variant === "menu") {
    return (
      <StaffDemoMenuItems state={state} onAction={onAction} error={error} />
    );
  }

  if (!ownDemo) return null;

  return (
    <SingleDemoChip
      compact={compact}
      className={className}
      demo={ownDemo}
      state={state}
    />
  );
}

function StaffDemoMenuItems({
  state,
  onAction,
  error,
}: {
  state: ReturnType<typeof useStaffDemoSwitch>;
  onAction?: () => void;
  error: string | null;
}) {
  const { demos, activeDemo, busySlug, impersonatingCoachId, handleSelect, handleExit } =
    state;

  return (
    <div className="border-t border-slate-100 py-1">
      {impersonatingCoachId ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            void (async () => {
              await handleExit();
              onAction?.();
            })();
          }}
          disabled={Boolean(busySlug)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Back to admin
        </button>
      ) : null}
      {demos.map((demo) => {
        const active = activeDemo?.coachSlug === demo.coachSlug;
        return (
          <button
            key={demo.coachSlug}
            type="button"
            role="menuitem"
          onClick={() => {
            void (async () => {
              await handleSelect(demo);
              onAction?.();
            })();
          }}
            disabled={Boolean(busySlug)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span>Use as {demo.label}</span>
            {active ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
            ) : busySlug === demo.coachSlug ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
          </button>
        );
      })}
      {error ? (
        <p className="px-3 pb-1 text-[11px] text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

function SingleDemoChip({
  compact,
  className,
  demo,
  state,
}: {
  compact: boolean;
  className: string;
  demo: DemoCoachToggleUser;
  state: ReturnType<typeof useStaffDemoSwitch>;
}) {
  const { isOwnDemoMode, busySlug, error, handleSelect } = state;
  const label = isOwnDemoMode ? "Admin" : demo.label;

  return (
    <span className={className}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleSelect(demo);
        }}
        disabled={Boolean(busySlug)}
        title={isOwnDemoMode ? "Switch back to admin" : `Switch to ${demo.label}`}
        aria-pressed={isOwnDemoMode}
        className={chipClass(compact, isOwnDemoMode)}
      >
        {busySlug ? (
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

function chipClass(compact: boolean, active: boolean): string {
  const baseClass =
    "inline-flex shrink-0 items-center gap-0.5 rounded-full border font-medium transition-colors disabled:opacity-60";
  const sizeClass = compact
    ? "px-1.5 py-0.5 text-[9px] leading-none"
    : "px-1.5 py-0.5 text-[10px] leading-tight";
  const toneClass = active
    ? "border-amber-200/80 bg-amber-100/95 text-amber-950 hover:bg-amber-50"
    : "border-white/25 bg-white/15 text-white hover:bg-white/25";
  return `${baseClass} ${sizeClass} ${toneClass}`;
}
