"use client";

import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";

import { PageView } from "./document/DocumentParts";
import { usePractice } from "./PracticeProvider";

/** One page of the Practice Blueprint, opened on its own. Same content as the full document. */
export function BlueprintTopic({ slug }: { slug: string }) {
  const page = blueprintPage(slug);
  const { knowledge, payload } = usePractice();
  if (!page || !knowledge || !payload) return null;

  return (
    <article>
      <PageView page={page} showTitle={false} />
    </article>
  );
}
