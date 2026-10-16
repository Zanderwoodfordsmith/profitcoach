"use client";

import { useSearchParams } from "next/navigation";

import { BlueprintDocument } from "@/components/practice/BlueprintDocument";
import { BlueprintTopic } from "@/components/practice/BlueprintTopic";
import { BlueprintHome } from "@/components/practice/BlueprintHome";
import { PRACTICE_BASE, PracticeProvider } from "@/components/practice/PracticeProvider";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";

/** Practice links stay on this coach's profile, on the Blueprint tab. */
export function coachProfileBlueprintHref(slug: string, practicePath: string): string {
  const hashAt = practicePath.indexOf("#");
  const hash = hashAt >= 0 ? practicePath.slice(hashAt) : "";
  const bare = (hashAt >= 0 ? practicePath.slice(0, hashAt) : practicePath).replace(/\/$/, "");
  const doc =
    bare === PRACTICE_BASE || !bare.startsWith(`${PRACTICE_BASE}/`)
      ? ""
      : bare.slice(PRACTICE_BASE.length + 1);
  const params = new URLSearchParams();
  params.set("tab", "blueprint");
  if (doc && doc !== "command") params.set("doc", doc);
  return `/admin/coaches/${encodeURIComponent(slug)}?${params.toString()}${hash}`;
}

function practicePathForDoc(doc: string | null): string {
  if (!doc || doc === "command" || !blueprintPage(doc)) return PRACTICE_BASE;
  return `${PRACTICE_BASE}/${doc}`;
}

function BlueprintBody({ doc }: { doc: string | null }) {
  if (!doc || doc === "command" || !blueprintPage(doc)) return <BlueprintHome />;
  if (doc === "blueprint") return <BlueprintDocument />;
  return <BlueprintTopic slug={doc} />;
}

/** The blueprint's contents column and documents, for one coach, inside their profile. */
export function CoachProfileBlueprint({
  coachId,
  coachSlug,
}: {
  coachId: string;
  coachSlug: string;
}) {
  const doc = useSearchParams().get("doc");
  const path = practicePathForDoc(doc);

  return (
    <PracticeProvider
      coachId={coachId}
      stayOnPage
      toHref={(practicePath) => coachProfileBlueprintHref(coachSlug, practicePath)}
    >
      <PracticeShell embedded path={path}>
        <BlueprintBody key={path} doc={doc} />
      </PracticeShell>
    </PracticeProvider>
  );
}
