import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/**
 * The app's buttons (proposed, Admin → Brand → Design). Pills, like the BCA
 * site. Main is the one action that matters on a screen; Second sits beside
 * it; Quiet is for small extras; Delete is for things that can't be undone.
 */
export type ButtonVariant = "main" | "second" | "quiet" | "delete";
export type ButtonSize = "normal" | "small";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  main: "bg-[#0c5290] text-white hover:bg-[#0a4578]",
  second: "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
  quiet: "text-[#0c5290] hover:bg-sky-50",
  delete: "bg-rose-600 text-white hover:bg-rose-700",
};

const SIZES: Record<ButtonSize, string> = {
  normal: "h-10 px-5 text-ui",
  small: "h-8 px-3.5 text-caption",
};

export function buttonClass(variant: ButtonVariant = "main", size: ButtonSize = "normal", extra = "") {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}

type Props = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "main", size = "normal", href, className = "", children, type = "button", ...rest }: Props) {
  const cls = buttonClass(variant, size, className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
