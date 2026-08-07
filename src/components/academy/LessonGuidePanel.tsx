import {
  lessonGuideOutline,
  lessonGuideSections,
} from "@/lib/academy/lessonGuideOutline";

import { AcademyMarkdown } from "./AcademyMarkdown";
import { LessonGuideToc } from "./LessonGuideToc";

/** Below this a guide reads fine top to bottom and a section list is clutter. */
const MIN_SECTIONS_FOR_OUTLINE = 4;

type Props = {
  guideMarkdown: string;
};

/**
 * The Guide tab: a long written walkthrough at the full width of the lesson.
 *
 * Wide screens get a sticky table of contents in the margin; narrower ones get
 * the same sections as a jump list above the prose.
 */
export function LessonGuidePanel({ guideMarkdown }: Props) {
  if (!guideMarkdown.trim()) return null;

  const outline = lessonGuideSections(lessonGuideOutline(guideMarkdown));
  const showSections = outline.length >= MIN_SECTIONS_FOR_OUTLINE;

  return (
    <div
      className={
        showSections
          ? "w-full xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-8"
          : "w-full"
      }
    >
      <div className="min-w-0">
        {showSections ? (
          <nav
            aria-label="Guide sections"
            className="mb-8 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70 xl:hidden"
          >
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              In this guide
            </p>
            {/* Multi-column rather than a grid: sections run 1,2,3 down the first
                column before continuing in the second, so the list reads in order. */}
            <ol className="mt-3 gap-x-8 sm:columns-2">
              {outline.map((section, index) => (
                <li
                  key={`${section.slug}-${index}`}
                  className="flex gap-2.5 py-0.75 text-sm break-inside-avoid"
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">
                    {index + 1}.
                  </span>
                  <a
                    href={`#${section.slug}`}
                    className="text-slate-700 underline-offset-2 hover:text-sky-700 hover:underline"
                  >
                    {section.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <AcademyMarkdown markdown={guideMarkdown} variant="guide" />
      </div>

      {showSections ? (
        // Stretches to the row height (no `items-start`) so the rail inside has
        // the full length of the guide to stick against.
        <aside className="hidden xl:block">
          <LessonGuideToc sections={outline} />
        </aside>
      ) : null}
    </div>
  );
}
