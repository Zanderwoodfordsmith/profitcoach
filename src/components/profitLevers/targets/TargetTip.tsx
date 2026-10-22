"use client";

import { useId, type ReactNode } from "react";

type Props = {
  /** Shown on hover and keyboard focus. Nothing to say means no tip. */
  tip: string;
  children: ReactNode;
  /** Right-aligned cells open the tip leftwards so it stays on screen. */
  end?: boolean;
  className?: string;
};

/** A number that explains itself on hover: the counts behind it live here, not under it. */
export function TargetTip({ tip, children, end = false, className }: Props) {
  const id = useId();
  if (!tip) return <span className={className}>{children}</span>;
  return (
    <span
      className={`tgt-tip${end ? " tgt-tip--end" : ""}${className ? ` ${className}` : ""}`}
      tabIndex={0}
      aria-describedby={id}
    >
      {children}
      <span id={id} role="tooltip" className="tgt-why">
        {tip}
      </span>
    </span>
  );
}
