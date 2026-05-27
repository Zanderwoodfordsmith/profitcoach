"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { bossProHubPath } from "@/lib/isBossWorkshopPath";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(bossProHubPath(contactId));
  }, [contactId, router]);

  return <p className="text-sm text-slate-600">Opening Boss Pro…</p>;
}
