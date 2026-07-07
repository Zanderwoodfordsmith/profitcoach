import Link from "next/link";
import { Sparkles } from "lucide-react";

type MembershipSidebarPromoProps = {
  active?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function MembershipSidebarPromo({
  active = false,
  onNavigate,
  className = "",
}: MembershipSidebarPromoProps) {
  return (
    <Link
      href="/coach/membership#plans"
      onClick={onNavigate}
      className={`group mb-2 block rounded-lg border border-emerald-300/25 bg-gradient-to-br from-emerald-500/90 to-teal-600/90 px-3 py-2.5 shadow-sm transition hover:brightness-105 ${className}`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
          <Sparkles className="h-4 w-4 text-emerald-50" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-white">Join Premium</p>
          <p className="text-[11px] leading-snug text-emerald-50/85">Weekly calls and tools</p>
        </div>
      </div>
    </Link>
  );
}
