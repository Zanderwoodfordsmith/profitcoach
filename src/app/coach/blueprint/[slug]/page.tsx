"use client";

import { notFound, useParams } from "next/navigation";

import { BlueprintTopic } from "@/components/practice/BlueprintTopic";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";

export default function PracticeTopicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  if (slug === "blueprint" || slug === "command" || !blueprintPage(slug)) notFound();
  return <BlueprintTopic slug={slug} />;
}
