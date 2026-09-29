"use client";

import Link from "next/link";

import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";

import { PageView } from "./document/DocumentParts";
import { usePractice } from "./PracticeProvider";

/** One page of the Practice Blueprint, opened on its own. Same content as the full document. */
export function BlueprintTopic({ slug }: { slug: string }) {
  const page = blueprintPage(slug);
  const { knowledge, payload, href } = usePractice();
  if (!page || !knowledge || !payload) return null;

  return (
    <article>
      <PageView page={page} showTitle={false} />
      <p className="bp-no-print mt-16 border-t border-[var(--bp-rule)] pt-5 text-sm text-[var(--bp-muted)]">
        This page is part of{" "}
        <Link href={href("/coach/practice/blueprint")} className="font-semibold text-[var(--bp-blue)] hover:underline">
          your Practice Blueprint
        </Link>
        . Read it all in one document, or download it for your own AI.
      </p>
    </article>
  );
}
