"use client";

import { BlueprintCover, BuildBar, ChapterView, Contents, DOCUMENT_GROUPS, StillNeeded } from "./document/DocumentParts";
import { usePractice } from "./PracticeProvider";

/** The whole Practice Blueprint as one document: cover, contents, then every chapter. */
export function BlueprintDocument() {
  const { knowledge, payload } = usePractice();
  if (!knowledge || !payload) return null;

  return (
    <article>
      <BlueprintCover />
      <div className="mt-8 space-y-4">
        <StillNeeded />
        <BuildBar />
      </div>
      <div className="mt-14">
        <Contents />
      </div>
      {DOCUMENT_GROUPS.map((group, i) => (
        <ChapterView key={group.label} group={group} index={i} />
      ))}
      <footer className="mt-24 border-t border-[var(--bp-rule)] pt-6 text-sm text-[var(--bp-muted)]">
        Prepared by Business Coach Academy. Written from what you told us and what you have done. Nothing in this
        document is invented: where a number is missing, we say so.
      </footer>
    </article>
  );
}
