"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ContactBossWorkshopBody } from "@/components/coach/ContactBossWorkshopBody";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = use(params);
  const router = useRouter();

  return (
    <ContactBossWorkshopBody
      contactId={contactId}
      draftCoachId={null}
      variant="page"
      headerLeading={
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-xs text-slate-600 hover:text-slate-800"
            onClick={() => router.push("/coach/clients")}
          >
            ← Back to clients
          </button>
          <a
            href={`/coach/contacts/${contactId}/playbooks`}
            className="text-xs font-medium text-sky-700 hover:text-sky-800"
          >
            Playbooks →
          </a>
        </div>
      }
    />
  );
}
