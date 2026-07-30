import { ArrowRight } from "lucide-react";

/** Optically matched to SimplifiedCardProgress (`h-6` / 24px) — +2px so the solid fill reads the same weight. */
const CONTROL =
  "box-border flex h-[26px] w-full shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-[#3d7eb0] px-3 text-xs font-semibold leading-none text-white transition group-hover:bg-[#336ea0]";

type Props = {
  children: React.ReactNode;
};

/** Footer CTA pill for simplified hub cards — matches progress-bar height. */
export function SimplifiedCardCta({ children }: Props) {
  return (
    <span className={CONTROL}>
      {children}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
    </span>
  );
}
