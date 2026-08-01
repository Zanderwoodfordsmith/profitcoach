"use client";

import { useEffect, useState } from "react";

import type { LessonGuideHeading } from "@/lib/academy/lessonGuideOutline";

/**
 * Matches `scroll-margin-top` on guide headings in globals.css, so a section
 * lights up exactly as it settles into the place an anchor jump would leave it.
 */
const READING_LINE_PX = 112;

type Props = {
  sections: LessonGuideHeading[];
};

/**
 * Margin table of contents for the Guide tab: sticks alongside the prose and
 * follows the reader down the page.
 *
 * Relies on the heading ids `AcademyMarkdown` adds in its `guide` variant.
 */
export function LessonGuideToc({ sections }: Props) {
  const [activeSlug, setActiveSlug] = useState(sections[0]?.slug ?? "");
  // Effects should re-bind when the sections change, not on every render.
  const slugKey = sections.map((section) => section.slug).join("\n");

  useEffect(() => {
    const headings = slugKey
      .split("\n")
      .map((slug) => document.getElementById(slug))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      // Active section = the last heading to have crossed the reading line.
      let active = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > READING_LINE_PX) break;
        active = heading;
      }
      setActiveSlug(active.id);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [slugKey]);

  return (
    <nav
      aria-label="Guide sections"
      className="sticky top-8 max-h-[calc(100vh-5rem)] overflow-y-auto"
    >
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        In this guide
      </p>
      <ol className="mt-3 border-l border-slate-200">
        {sections.map((section, index) => {
          const active = section.slug === activeSlug;
          return (
            <li key={`${section.slug}-${index}`}>
              <a
                href={`#${section.slug}`}
                aria-current={active ? "true" : undefined}
                className={`-ml-px block border-l-2 py-1.5 pl-3 text-sm leading-snug transition-colors ${
                  active
                    ? "border-sky-600 font-medium text-sky-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {section.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
