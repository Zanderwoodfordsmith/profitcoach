"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachContactsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/coach/clients");
  }, [router]);

  return (
    <p className="text-sm text-slate-600">Redirecting to clients…</p>
  );
}
