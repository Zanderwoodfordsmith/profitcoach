"use client";

import { notFound, useParams } from "next/navigation";

import { BlueprintTopic } from "@/components/practice/BlueprintTopic";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";

export default function AdminBlueprintTopicPage() {
  const { slug } = useParams<{ slug: string }>();
  if (slug === "blueprint" || slug === "command" || !blueprintPage(slug)) notFound();
  return <BlueprintTopic slug={slug} />;
}
