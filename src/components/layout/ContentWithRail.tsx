import type { ReactNode } from "react";

/**
 * Shared two-column dashboard layout: a reading-width main column and a
 * right rail. Community feed is the source of these widths; campaign steps
 * and other left/right tools should reuse this so the shape stays consistent.
 */
export const CONTENT_WITH_RAIL_ROW_CLASS =
  "flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-start lg:gap-10";

export const CONTENT_WITH_RAIL_MAIN_CLASS =
  "w-full min-w-0 max-w-3xl";

export const CONTENT_WITH_RAIL_RAIL_CLASS =
  "w-full shrink-0 lg:sticky lg:w-80 lg:self-start";

function joinClasses(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function ContentWithRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses(CONTENT_WITH_RAIL_ROW_CLASS, className)}>
      {children}
    </div>
  );
}

export function ContentWithRailMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={joinClasses(CONTENT_WITH_RAIL_MAIN_CLASS, className)}>
      {children}
    </div>
  );
}

export function ContentWithRailAside({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={joinClasses(
        CONTENT_WITH_RAIL_RAIL_CLASS,
        className ?? "lg:top-4"
      )}
    >
      {children}
    </aside>
  );
}
