"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { coachAccountLabel } from "@/lib/admin/coachDirectoryClient";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { pathAfterDemoCoachToggle } from "@/lib/demoCoachToggle";
import {
  saveCommunityDraftHandoff,
  type CommunityDraftHandoff,
} from "@/lib/communityDraftHandoff";

type Props = {
  /** Coach the admin is viewing as (from `coachPersonaForCommunity`); null hides the notice. */
  coachPersonaId: string | null;
  /** Show once the admin has started typing. */
  active: boolean;
  /** What is typed so far; carried over when switching to the admin's own view. */
  draft: CommunityDraftHandoff;
  className?: string;
};

/**
 * Warns an admin in "view as" mode that the post or comment they are typing
 * will be published under the coach's name, not their own, and offers a
 * one-click switch to the same page in admin with the draft kept.
 */
export function ActingAsNotice({
  coachPersonaId,
  active,
  draft,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearImpersonation } = useImpersonation();
  const [name, setName] = useState<{ id: string; name: string } | null>(null);
  const remembered = coachPersonaId ? coachAccountLabel(coachPersonaId) : null;

  useEffect(() => {
    if (!coachPersonaId || !active || remembered) return;
    if (name?.id === coachPersonaId) return;
    let cancelled = false;
    void fetchProfileRole(coachPersonaId).then((data) => {
      const label =
        data.full_name?.trim() || data.coach_business_name?.trim() || "";
      if (!cancelled && label) setName({ id: coachPersonaId, name: label });
    });
    return () => {
      cancelled = true;
    };
  }, [active, coachPersonaId, name?.id, remembered]);

  if (!coachPersonaId || !active) return null;
  const label =
    remembered || (name?.id === coachPersonaId ? name.name : "this coach");

  function switchToMe() {
    saveCommunityDraftHandoff(draft);
    clearImpersonation();
    router.push(
      `${pathAfterDemoCoachToggle(pathname ?? "/coach", "admin")}${window.location.search}`
    );
  }

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-1.5 pl-2.5 pr-1.5 text-[13px] leading-snug text-amber-900 ${className}`}
    >
      <UserRoundCog className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        This will post as <span className="font-semibold">{label}</span>, not
        you. You&apos;re viewing the app as them.
      </span>
      <button
        type="button"
        onClick={switchToMe}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
      >
        Post as me
      </button>
    </div>
  );
}
