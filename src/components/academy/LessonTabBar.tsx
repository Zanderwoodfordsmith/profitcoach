"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type LessonTab<T extends string> = {
  id: T;
  label: string;
  /** Small muted suffix, e.g. `Empty` on the Guide tab while editing. */
  hint?: string;
};

type Props<T extends string> = {
  tabs: LessonTab<T>[];
  activeTab: T;
  onSelect: (id: T) => void;
  label?: string;
};

/** The tab strip shared by the lesson player and the lesson editor. */
export function LessonTabBar<T extends string>({
  tabs,
  activeTab,
  onSelect,
  label = "Lesson sections",
}: Props<T>) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1" aria-label={label}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={`border-b-2 px-0 py-2.5 text-sm font-semibold tracking-tight transition ${
                active
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.hint ? (
                <span className="ml-1.5 text-xs font-medium text-slate-400">
                  {tab.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Keeps the open tab in `?tab=` so reloads, shared links, and switching between
 * reading and editing a lesson all land on the same section.
 */
export function useLessonTabParam<T extends string>(
  tabIds: readonly T[],
  fallback: T
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  const initialTab = useMemo(
    () => tabIds.find((id) => id === tabFromUrl) ?? fallback,
    [fallback, tabFromUrl, tabIds]
  );

  const [activeTab, setActiveTab] = useState<T>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = useCallback(
    (id: T) => {
      setActiveTab(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id === fallback) params.delete("tab");
      else params.set("tab", id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fallback, pathname, router, searchParams]
  );

  return { activeTab, selectTab };
}
