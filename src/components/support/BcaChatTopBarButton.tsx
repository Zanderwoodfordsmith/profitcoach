"use client";

import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";

import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { useCoachUnreadSupportCount } from "@/components/layout/useNewFeedbackCount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";

import { useSupportDock } from "./SupportDock";

/**
 * Support from any page (18 Nov, job 228): beside Ava in the top bar, it
 * opens the chat on the right, about the page you're on. Admins see it while
 * viewing as a coach, and write to that coach as BCA. A dot means BCA replied.
 */
export function BcaChatTopBarButton() {
  const router = useRouter();
  const dock = useSupportDock();
  const desktop = useMatchesBreakpoint("lg");
  const { profile } = useDashboardProfile();
  const { impersonatingCoachId } = useImpersonation();
  const isAdmin = profile?.role === "admin";
  const unread = useCoachUnreadSupportCount(Boolean(profile) && !isAdmin);

  if (!dock || !profile || (isAdmin && !impersonatingCoachId)) return null;
  const open = Boolean(dock.chat);
  const label = isAdmin ? "Support: message this coach" : "Support";

  return (
    <button
      type="button"
      aria-label={open ? "Close chat" : label}
      title={label}
      onClick={() => {
        if (open) return dock.close();
        if (desktop !== true) return router.push("/coach/support");
        dock.open({ kind: "list", about: `${window.location.pathname}${window.location.search}`, auto: true });
      }}
      className={`relative grid shrink-0 place-items-center rounded-full p-2 transition ${
        open ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-transparent text-slate-700 hover:bg-slate-50"
      }`}
    >
      {/* Support's own icon, as in the sidebar (18 Nov). */}
      <CircleHelp className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      {unread > 0 && !open ? (
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden />
      ) : null}
    </button>
  );
}
