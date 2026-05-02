"use client";

import { splitMentionSegments } from "@/lib/communityMentions";

type Props = {
  body: string;
  nameById: Record<string, string>;
  className?: string;
};

/** Renders plain text + @uuid tokens as styled @DisplayName (plain spans). */
export function MentionBody({ body, nameById, className = "" }: Props) {
  const segments = splitMentionSegments(body);

  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={i}>{seg.text}</span>;
        }
        const label = nameById[seg.userId] ?? "member";
        return (
          <span
            key={i}
            className="font-medium text-sky-700"
            title={seg.userId}
          >
            @{label}
          </span>
        );
      })}
    </div>
  );
}
